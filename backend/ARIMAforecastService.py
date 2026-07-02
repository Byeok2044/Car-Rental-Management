"""
arima_forecast_service.py  —  ARIMA-based revenue & booking forecasting
Runs alongside urgency_service.py (default port: 5002)

Requirements:
    pip install flask flask-cors statsmodels pandas numpy scikit-learn scipy

Usage:
    python arima_forecast_service.py
"""

from __future__ import annotations

import os
import warnings
from dataclasses import dataclass, asdict, field
from datetime import datetime
from dateutil.relativedelta import relativedelta

import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

warnings.filterwarnings("ignore")

app = Flask(__name__)
CORS(app)

# ─── Try importing statsmodels ────────────────────────────────────────────────

try:
    from statsmodels.tsa.arima.model import ARIMA
    from statsmodels.tsa.statespace.sarimax import SARIMAX
    from statsmodels.tsa.stattools import adfuller
    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False
    print("⚠ statsmodels not found – ARIMA endpoints will use trend-based fallback.")

try:
    from dateutil.relativedelta import relativedelta
    DATEUTIL_AVAILABLE = True
except ImportError:
    DATEUTIL_AVAILABLE = False
    print("⚠ python-dateutil not found – installing fallback month logic.")


# ─── Data structures ──────────────────────────────────────────────────────────

@dataclass
class ForecastPoint:
    period: str
    label: str
    predicted: float
    lower: float
    upper: float
    method: str = "arima"


@dataclass
class ForecastResult:
    success: bool
    forecasts: list
    diagnostics: dict = field(default_factory=dict)
    error: str = ""


# ─── Date helpers ─────────────────────────────────────────────────────────────

def _add_months(dt: datetime, months: int) -> datetime:
    """Reliably add N months to a datetime, always landing on the 1st."""
    if DATEUTIL_AVAILABLE:
        return (dt + relativedelta(months=months)).replace(day=1)
    # Manual fallback
    month = dt.month - 1 + months
    year  = dt.year + month // 12
    month = month % 12 + 1
    return dt.replace(year=year, month=month, day=1)


def _next_n_months_from_now(n: int) -> list[tuple[str, str]]:
    """
    Returns the next n months starting from NEXT month relative to today.
    e.g. if today is April 2026, returns May, Jun, Jul, Aug, Sep, Oct 2026
    (for n=6).
    """
    # Always base on current date so forecast is relative to NOW, not
    # the last historical data point (which can be months in the past).
    base = datetime.now().replace(day=1)

    results = []
    for i in range(1, n + 1):
        dt     = _add_months(base, i)
        period = dt.strftime("%Y-%m")
        label  = dt.strftime("%b %Y")
        results.append((period, label))
    return results


def _next_n_months(last_period_str: str, n: int) -> list[tuple[str, str]]:
    """
    DEPRECATED internal helper kept only for demand_by_type which needs
    per-type period alignment.  For revenue / bookings use
    _next_n_months_from_now() instead.
    """
    try:
        base = datetime.strptime(last_period_str, "%Y-%m")
    except (ValueError, TypeError):
        base = datetime.now().replace(day=1)

    results = []
    for i in range(1, n + 1):
        dt     = _add_months(base, i)
        period = dt.strftime("%Y-%m")
        label  = dt.strftime("%b %Y")
        results.append((period, label))
    return results


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _ensure_stationary(series: pd.Series) -> tuple:
    if len(series) < 4:
        return series, 0
    try:
        result = adfuller(series.dropna())
        if result[1] <= 0.05:
            return series, 0
        diff1 = series.diff().dropna()
        result2 = adfuller(diff1)
        if result2[1] <= 0.05:
            return diff1, 1
        return diff1.diff().dropna(), 2
    except Exception:
        return series, 0


def _naive_forecast(values: list, periods: int) -> list:
    if not values:
        return [(0.0, 0.0, 0.0)] * periods
    arr = np.array(values, dtype=float)
    n   = len(arr)
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
        ci   = std_dev * 1.28
        results.append((pred, max(0.0, pred - ci), pred + ci))
    return results


def _fit_arima(series: pd.Series, periods: int,
               order=(1, 1, 1), seasonal_order=None) -> list:
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
        ci     = fc.conf_int(alpha=0.20)
        lower  = ci.iloc[:, 0].values
        upper  = ci.iloc[:, 1].values
        return [(max(0.0, float(m)), max(0.0, float(l)), max(0.0, float(u)))
                for m, l, u in zip(mean, lower, upper)]
    except Exception as exc:
        print(f"[ARIMA] fit failed ({exc}); using naive fallback.")
        return _naive_forecast(list(series), periods)


def _validate_time_series(data: list, value_key: str) -> tuple:
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
        "status":      "ok",
        "service":     "arima-forecast",
        "version":     "v3",
        "statsmodels": STATSMODELS_AVAILABLE,
        "dateutil":    DATEUTIL_AVAILABLE,
    })


@app.route("/forecast/revenue", methods=["POST"])
def forecast_revenue():
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

    use_sarima     = (frequency == "monthly" and len(values) >= 12)
    seasonal_order = (1, 1, 1, 12) if use_sarima else None
    order          = (1, d, 1)

    raw = _fit_arima(series, periods, order=order, seasonal_order=seasonal_order)

    # KEY FIX: always start forecast from current month (today), not from
    # the last historical data point.  This ensures if history ends in
    # e.g. Feb 2026 but today is April 2026 the forecast shows
    # May 2026, Jun 2026, … not Apr 2026, May 2026, …
    future_months = _next_n_months_from_now(periods)

    last_period = history[-1].get("period", "") if history else ""

    forecasts = []
    for i, ((pred, lo, hi), (period, label)) in enumerate(zip(raw, future_months)):
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
            "lastHistoricalPeriod": last_period,
            "forecastStartsFrom":   future_months[0][0] if future_months else "unknown",
        },
    })


@app.route("/forecast/bookings", methods=["POST"])
def forecast_bookings():
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

    # KEY FIX: same as revenue — anchor to current date, not last history point
    future_months = _next_n_months_from_now(periods)
    last_period   = history[-1].get("period", "") if history else ""

    forecasts = []
    for (pred, lo, hi), (period, label) in zip(raw, future_months):
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
        "diagnostics": {
            "dataPoints": len(values),
            "model":      f"ARIMA(1,{d},1)",
            "lastHistoricalPeriod": last_period,
            "forecastStartsFrom":   future_months[0][0] if future_months else "unknown",
        },
    })


@app.route("/forecast/demand_by_type", methods=["POST"])
def forecast_demand_by_type():
    body    = request.get_json(silent=True) or {}
    history = body.get("history", {})
    periods = min(int(body.get("periods", 3)), 12)

    if not isinstance(history, dict) or not history:
        return jsonify({"success": False, "error": "history must be a non-empty object", "results": {}}), 400

    # For type forecasts also anchor to current date
    future_months_global = _next_n_months_from_now(periods)

    results = {}
    for vtype, data in history.items():
        values, err = _validate_time_series(data, "bookings")
        if err or len(values) < 3:
            results[vtype] = {"error": err or "insufficient data", "forecasts": []}
            continue

        series = pd.Series(values, dtype=float)
        _, d   = _ensure_stationary(series)
        raw    = _fit_arima(series, periods, order=(1, min(d, 1), 1))

        fc_list = []
        for (pred, lo, hi), (period, label) in zip(raw, future_months_global):
            fc_list.append({
                "period":    period,
                "label":     label,
                "predicted": round(max(0, pred)),
                "lower":     round(max(0, lo)),
                "upper":     round(hi),
            })
        results[vtype] = {"forecasts": fc_list}

    return jsonify({"success": True, "results": results})


@app.route("/forecast/quick_next_month", methods=["POST"])
def quick_next_month():
    body      = request.get_json(silent=True) or {}
    rev_vals  = [float(v) for v in body.get("revenueHistory",  [])]
    book_vals = [float(v) for v in body.get("bookingHistory",  [])]

    if len(rev_vals) < 3 and len(book_vals) < 3:
        return jsonify({"success": False, "error": "Need ≥ 3 data points"}), 400

    def _predict_one(vals):
        if len(vals) < 3:
            return 0.0, 0.0, 0.0
        s   = pd.Series(vals, dtype=float)
        raw = _fit_arima(s, 1)
        return raw[0]

    rp, rl, ru = _predict_one(rev_vals)
    bp, bl, bu = _predict_one(book_vals)

    # Always next calendar month from today
    next_month = _add_months(datetime.now().replace(day=1), 1)
    label      = next_month.strftime("%B %Y")

    return jsonify({
        "success":  True,
        "label":    label,
        "revenue":  {"predicted": round(rp, 2), "lower": round(rl, 2), "upper": round(ru, 2)},
        "bookings": {"predicted": round(max(0, bp)), "lower": round(max(0, bl)), "upper": round(bu)},
    })


# ─── Error handlers ───────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(_):    return jsonify({"error": "endpoint not found"}),     404

@app.errorhandler(405)
def method_not_allowed(_): return jsonify({"error": "method not allowed"}), 405

@app.errorhandler(500)
def internal_error(e): return jsonify({"error": "internal server error", "detail": str(e)}), 500


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port  = int(os.environ.get("FORECAST_PORT", 5002))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    print(f"ARIMA Forecast Service v3  —  port {port}")
    print(f"  statsmodels : {'✓ loaded' if STATSMODELS_AVAILABLE else '✗ missing (trend fallback)'}")
    print(f"  dateutil    : {'✓ loaded' if DATEUTIL_AVAILABLE else '✗ missing (manual fallback)'}")
    print(f"  Forecast anchor: always from CURRENT month ({datetime.now().strftime('%B %Y')})")
    print(f"  POST http://localhost:{port}/forecast/revenue")
    print(f"  POST http://localhost:{port}/forecast/bookings")
    print(f"  POST http://localhost:{port}/forecast/demand_by_type")
    print(f"  POST http://localhost:{port}/forecast/quick_next_month")
    print(f"  GET  http://localhost:{port}/health")
    app.run(host="0.0.0.0", port=port, debug=debug)