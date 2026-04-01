"""
arima_forecast_service.py  —  ARIMA-based revenue & booking forecasting
Runs alongside urgency_service.py (default port: 5002)

Requirements:
    pip install flask flask-cors statsmodels pandas numpy scikit-learn scipy

Usage:
    python arima_forecast_service.py
or in package.json scripts:
    "start:forecast": "python arima_forecast_service.py"
"""

from __future__ import annotations

import os
import json
import warnings
from dataclasses import dataclass, asdict, field
from typing import Optional
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

warnings.filterwarnings("ignore")          # suppress ARIMA convergence warnings

app = Flask(__name__)
CORS(app)

# ─── Try importing statsmodels; graceful fallback if missing ──────────────────

try:
    from statsmodels.tsa.arima.model import ARIMA
    from statsmodels.tsa.statespace.sarimax import SARIMAX
    from statsmodels.tsa.stattools import adfuller
    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False
    print("⚠ statsmodels not found – ARIMA endpoints will use trend-based fallback.")

# ─── Data structures ──────────────────────────────────────────────────────────

@dataclass
class ForecastPoint:
    period: str          # e.g. "2025-08" or "Week 1"
    label: str
    predicted: float
    lower: float         # 80 % confidence interval
    upper: float
    method: str = "arima"


@dataclass
class ForecastResult:
    success: bool
    forecasts: list[ForecastPoint]
    diagnostics: dict = field(default_factory=dict)
    error: str = ""

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _ensure_stationary(series: pd.Series) -> tuple[pd.Series, int]:
    """Return (differenced_series, d) where d is the degree of differencing."""
    if len(series) < 4:
        return series, 0
    try:
        result = adfuller(series.dropna())
        if result[1] <= 0.05:          # already stationary
            return series, 0
        diff1 = series.diff().dropna()
        result2 = adfuller(diff1)
        if result2[1] <= 0.05:
            return diff1, 1
        return diff1.diff().dropna(), 2
    except Exception:
        return series, 0


def _naive_forecast(values: list[float], periods: int) -> list[tuple[float, float, float]]:
    """Simple trend + seasonality fallback when statsmodels is unavailable."""
    if not values:
        return [(0.0, 0.0, 0.0)] * periods
    arr = np.array(values, dtype=float)
    n   = len(arr)
    # Linear trend
    if n >= 2:
        xs    = np.arange(n)
        slope = np.polyfit(xs, arr, 1)[0]
    else:
        slope = 0.0
    last    = arr[-1]
    std_dev = float(np.std(arr)) if n > 1 else last * 0.15
    results = []
    for i in range(1, periods + 1):
        pred = max(0.0, last + slope * i)
        ci   = std_dev * 1.28          # ~80 % CI
        results.append((pred, max(0.0, pred - ci), pred + ci))
    return results


def _fit_arima(series: pd.Series, periods: int,
               order=(1, 1, 1), seasonal_order=None) -> list[tuple[float, float, float]]:
    """Fit ARIMA / SARIMA and return (pred, lower80, upper80) per period."""
    if not STATSMODELS_AVAILABLE or len(series) < 6:
        return _naive_forecast(list(series), periods)

    try:
        if seasonal_order and len(series) >= 12:
            model  = SARIMAX(series, order=order,
                             seasonal_order=seasonal_order,
                             enforce_stationarity=False,
                             enforce_invertibility=False)
        else:
            model  = ARIMA(series, order=order)

        fitted = model.fit(disp=False)
        fc     = fitted.get_forecast(steps=periods)
        mean   = fc.predicted_mean.values
        ci     = fc.conf_int(alpha=0.20)       # 80 %
        lower  = ci.iloc[:, 0].values
        upper  = ci.iloc[:, 1].values
        return [(max(0.0, float(m)), max(0.0, float(l)), max(0.0, float(u)))
                for m, l, u in zip(mean, lower, upper)]

    except Exception as exc:
        print(f"[ARIMA] fit failed ({exc}); using naive fallback.")
        return _naive_forecast(list(series), periods)

# ─── Route helpers ────────────────────────────────────────────────────────────

def _validate_time_series(data: list[dict], value_key: str) -> tuple[list, str]:
    """Return (clean_values, error_msg)."""
    if not isinstance(data, list) or len(data) < 3:
        return [], "Need at least 3 data points for forecasting."
    values = []
    for item in data:
        v = item.get(value_key, 0)
        try:
            values.append(float(v))
        except (TypeError, ValueError):
            values.append(0.0)
    return values, ""

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":        "ok",
        "service":       "arima-forecast",
        "version":       "v1",
        "statsmodels":   STATSMODELS_AVAILABLE,
    })


@app.route("/forecast/revenue", methods=["POST"])
def forecast_revenue():
    """
    Forecast monthly / weekly revenue using ARIMA.

    Body:
    {
      "history": [
        {"period": "2025-01", "revenue": 45000, "label": "Jan 2025"},
        ...
      ],
      "periods": 6,          // how many future periods to predict
      "frequency": "monthly" // "monthly" | "weekly"
    }

    Response:
    {
      "success": true,
      "forecasts": [
        {"period": "2025-07", "label": "Jul 2025",
         "predicted": 52000, "lower": 41000, "upper": 63000,
         "method": "arima"}
      ],
      "diagnostics": { "dataPoints": 12, "model": "ARIMA(1,1,1)" }
    }
    """
    body      = request.get_json(silent=True) or {}
    history   = body.get("history", [])
    periods   = min(int(body.get("periods", 6)), 24)
    frequency = body.get("frequency", "monthly")

    values, err = _validate_time_series(history, "revenue")
    if err:
        return jsonify({"success": False, "error": err, "forecasts": []}), 400

    series   = pd.Series(values, dtype=float)
    _, d     = _ensure_stationary(series)
    d        = min(d, 2)

    # Use seasonal ARIMA for monthly data with ≥ 12 points
    use_sarima     = (frequency == "monthly" and len(values) >= 12)
    seasonal_order = (1, 1, 1, 12) if use_sarima else None
    order          = (1, d, 1)

    raw = _fit_arima(series, periods, order=order, seasonal_order=seasonal_order)

    # Build future period labels
    last_period = history[-1].get("period", "") if history else ""
    forecasts   = []
    for i, (pred, lo, hi) in enumerate(raw, 1):
        if frequency == "monthly" and last_period:
            try:
                dt      = datetime.strptime(last_period, "%Y-%m") + timedelta(days=32 * i)
                dt      = dt.replace(day=1)
                period  = dt.strftime("%Y-%m")
                label   = dt.strftime("%b %Y")
            except ValueError:
                period  = f"M+{i}"
                label   = f"Period +{i}"
        else:
            period = f"W+{i}"
            label  = f"Week +{i}"

        forecasts.append(ForecastPoint(
            period=period, label=label,
            predicted=round(pred, 2),
            lower=round(lo, 2),
            upper=round(hi, 2),
            method="sarima" if use_sarima else ("arima" if STATSMODELS_AVAILABLE else "trend"),
        ))

    model_name = ("SARIMA(1,%d,1)(1,1,1)12" % d) if use_sarima else ("ARIMA(1,%d,1)" % d)
    return jsonify({
        "success":     True,
        "forecasts":   [asdict(f) for f in forecasts],
        "diagnostics": {
            "dataPoints": len(values),
            "model":      model_name,
            "stationary": d == 0,
        },
    })


@app.route("/forecast/bookings", methods=["POST"])
def forecast_bookings():
    """
    Forecast monthly booking counts using ARIMA.

    Body:
    {
      "history": [
        {"period": "2025-01", "bookings": 12, "label": "Jan 2025"},
        ...
      ],
      "periods": 3
    }
    """
    body    = request.get_json(silent=True) or {}
    history = body.get("history", [])
    periods = min(int(body.get("periods", 3)), 12)

    values, err = _validate_time_series(history, "bookings")
    if err:
        return jsonify({"success": False, "error": err, "forecasts": []}), 400

    series = pd.Series(values, dtype=float)
    _, d   = _ensure_stationary(series)
    d      = min(d, 2)
    raw    = _fit_arima(series, periods, order=(1, d, 1))

    last_period = history[-1].get("period", "") if history else ""
    forecasts   = []
    for i, (pred, lo, hi) in enumerate(raw, 1):
        try:
            dt     = datetime.strptime(last_period, "%Y-%m") + timedelta(days=32 * i)
            dt     = dt.replace(day=1)
            period = dt.strftime("%Y-%m")
            label  = dt.strftime("%b %Y")
        except ValueError:
            period = f"M+{i}"
            label  = f"Period +{i}"

        forecasts.append(ForecastPoint(
            period=period, label=label,
            predicted=round(max(0, pred)),
            lower=round(max(0, lo)),
            upper=round(hi),
            method="arima" if STATSMODELS_AVAILABLE else "trend",
        ))

    return jsonify({
        "success":   True,
        "forecasts": [asdict(f) for f in forecasts],
        "diagnostics": {"dataPoints": len(values), "model": f"ARIMA(1,{d},1)"},
    })


@app.route("/forecast/demand_by_type", methods=["POST"])
def forecast_demand_by_type():
    """
    Forecast demand for each vehicle type independently.

    Body:
    {
      "history": {
        "Sedan": [{"period": "2025-01", "bookings": 5}, ...],
        "SUV":   [{"period": "2025-01", "bookings": 3}, ...]
      },
      "periods": 3
    }
    """
    body    = request.get_json(silent=True) or {}
    history = body.get("history", {})
    periods = min(int(body.get("periods", 3)), 12)

    if not isinstance(history, dict) or not history:
        return jsonify({"success": False, "error": "history must be a non-empty object", "results": {}}), 400

    results = {}
    for vtype, data in history.items():
        values, err = _validate_time_series(data, "bookings")
        if err or len(values) < 3:
            results[vtype] = {"error": err or "insufficient data", "forecasts": []}
            continue

        series = pd.Series(values, dtype=float)
        _, d   = _ensure_stationary(series)
        raw    = _fit_arima(series, periods, order=(1, min(d, 1), 1))

        last_period = data[-1].get("period", "") if data else ""
        fc_list = []
        for i, (pred, lo, hi) in enumerate(raw, 1):
            try:
                dt     = datetime.strptime(last_period, "%Y-%m") + timedelta(days=32 * i)
                dt     = dt.replace(day=1)
                period = dt.strftime("%Y-%m")
                label  = dt.strftime("%b %Y")
            except ValueError:
                period = f"M+{i}"
                label  = f"Period +{i}"
            fc_list.append({"period": period, "label": label,
                            "predicted": round(max(0, pred)),
                            "lower": round(max(0, lo)),
                            "upper": round(hi)})
        results[vtype] = {"forecasts": fc_list}

    return jsonify({"success": True, "results": results})


@app.route("/forecast/quick_next_month", methods=["POST"])
def quick_next_month():
    """
    Lightweight single-call endpoint: returns next-month revenue & booking predictions.

    Body:
    {
      "revenueHistory":  [45000, 52000, 38000, ...],   // raw numbers, oldest first
      "bookingHistory":  [12, 15, 10, ...]
    }
    """
    body           = request.get_json(silent=True) or {}
    rev_vals       = [float(v) for v in body.get("revenueHistory",  [])]
    book_vals      = [float(v) for v in body.get("bookingHistory",  [])]

    if len(rev_vals) < 3 and len(book_vals) < 3:
        return jsonify({"success": False, "error": "Need ≥ 3 data points"}), 400

    def _predict_one(vals):
        if len(vals) < 3:
            return 0.0, 0.0, 0.0
        s = pd.Series(vals, dtype=float)
        raw = _fit_arima(s, 1)
        return raw[0]

    rp, rl, ru = _predict_one(rev_vals)
    bp, bl, bu = _predict_one(book_vals)

    next_month  = (datetime.now().replace(day=1) + timedelta(days=32)).replace(day=1)
    label       = next_month.strftime("%B %Y")

    return jsonify({
        "success": True,
        "label":   label,
        "revenue": {"predicted": round(rp, 2), "lower": round(rl, 2), "upper": round(ru, 2)},
        "bookings": {"predicted": round(max(0, bp)), "lower": round(max(0, bl)), "upper": round(bu)},
    })


# ─── Error handlers ───────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(_): return jsonify({"error": "endpoint not found"}), 404

@app.errorhandler(405)
def method_not_allowed(_): return jsonify({"error": "method not allowed"}), 405

@app.errorhandler(500)
def internal_error(e): return jsonify({"error": "internal server error", "detail": str(e)}), 500


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port  = int(os.environ.get("FORECAST_PORT", 5002))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    print(f"ARIMA Forecast Service  —  port {port}")
    print(f"  statsmodels : {'✓ loaded' if STATSMODELS_AVAILABLE else '✗ missing (using trend fallback)'}")
    print(f"  POST http://localhost:{port}/forecast/revenue")
    print(f"  POST http://localhost:{port}/forecast/bookings")
    print(f"  POST http://localhost:{port}/forecast/demand_by_type")
    print(f"  POST http://localhost:{port}/forecast/quick_next_month")
    print(f"  GET  http://localhost:{port}/health")
    app.run(host="0.0.0.0", port=port, debug=debug)