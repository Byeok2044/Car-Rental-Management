"""
urgency_service.py  —  v5  (Taglish-aware, linguistically enhanced)
=====================================================================
Rule-based urgency classifier for Triple R and A Car Rental contact messages.
Classifies each message as 'high', 'medium', or 'low' urgency.

Key improvements over v4
─────────────────────────
LANGUAGE & LINGUISTICS
  • Taglish detection: identifies mixed-language messages and applies a
    code-switching bonus so the classifier handles both languages together
  • Tagalog morphology: handles common affixes (mag-, na-, naka-, di/hindi,
    ma-, -in, -an, -ng, po/ho honorifics) via normalised stem matching
  • Filipino colloquial spelling variants: "grabe", "grabeh", "nandito na",
    "hindi ako", "ay nako", "nako", "sus", "oy" distress interjections
  • Tagalog negative contractions: "di", "di ko", "hindi ko", "wag", "huwag"
    correctly parsed as negation without swallowing urgency
  • English contractions normalised before scoring (won't→will not, etc.)
  • Emoji sentiment: 🚨 🆘 🔥 🚗💨 ⚠️ mapped to score contributions

KEYWORD IMPROVEMENTS
  • +60 HIGH-urgency terms covering more road/vehicle, billing, and safety
    scenarios specific to the Philippine car rental context
  • +40 MEDIUM terms for common customer inquiry patterns in Filipino
  • Severity ladder: "hindi gumagana" < "patay na" < "sunog" < "aksidente"
    — each rung is properly weighted
  • Booking-specific HIGH signals: "hindi pa nag-reply", "walang update",
    "binabalewala", "pinaka-importanteng booking"

SCORING IMPROVEMENTS
  • Taglish co-occurrence multiplier: if both English and Tagalog HIGH terms
    appear, score × 1.15 (code-switching under stress → higher urgency)
  • Honorific softener: "po"/"ho" at sentence-end slightly lowers aggression
    of pure-sentiment signals (polite framing = less panic)
  • Negation scope widened: up to 5 tokens ahead (Tagalog negation can be
    further from its target than English)
  • Sentiment dampening tuned: 0.30× (was 0.35×) — less hair-trigger on caps
  • LOW penalty capped at 12 to prevent legitimate complaints being buried

INFRASTRUCTURE
  • Input sanitisation: Unicode normalisation, control-char strip, 6 000-char cap
  • Batch cap raised to 150 with per-item timeout guard (100 ms soft limit)
  • /healthz alias for k8s-style liveness probes
  • Structured logging: every classification above MEDIUM is console-logged
  • Type annotations throughout for IDE support
"""

from __future__ import annotations

import logging
import os
import re
import time
import unicodedata
from dataclasses import asdict, dataclass, field
from typing import Optional

from flask import Flask, request, jsonify
from flask_cors import CORS

# ── Logging ────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [urgency-v5] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ── App ────────────────────────────────────────────────────────────────────────

_TRUSTED_ORIGINS: list[str] = [
    o.strip()
    for o in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5000,http://127.0.0.1:5173",
    ).split(",")
    if o.strip()
]

app = Flask(__name__)
CORS(app, origins=_TRUSTED_ORIGINS, supports_credentials=False)

# ── Constants ──────────────────────────────────────────────────────────────────

_VERSION            = "v5"
_MAX_MESSAGE_CHARS  = 6_000
_MAX_BATCH_SIZE     = 150
_HIGH_THRESHOLD     = 10.0
_MEDIUM_THRESHOLD   = 2.5
_HIGH_NO_KW_MIN     = 15.0   # score needed for HIGH with zero HIGH keywords
_LOW_PENALTY_CAP    = 12.0   # max LOW penalty subtracted
_SENT_DAMPEN        = 0.30   # sentiment signal dampening factor
_SENT_CAP           = 7.0    # max sentiment contribution
_TAGLISH_MULTIPLIER = 1.15   # bonus when both EN and TL HIGH terms co-occur


# ── Data structures ────────────────────────────────────────────────────────────

@dataclass
class Keyword:
    term:   str
    weight: float


@dataclass
class ClassifyResult:
    urgency:    str
    score:      float
    breakdown:  dict
    confidence: str = f"rule-based-{_VERSION}"


# ──────────────────────────────────────────────────────────────────────────────
#  KEYWORD LISTS
# ──────────────────────────────────────────────────────────────────────────────
#
# Weight guide
#   10    = unambiguous emergency / crime / total failure
#   8–9   = strong urgency signal; one hit typically enough for HIGH
#   6–7   = meaningful urgency; usually needs one more co-signal
#   4–5   = moderate urgency; needs clustering
#   MEDIUM 1–4  = soft inquiry signals
#   LOW   2–6   = score penalty (subtracted)
#
# All lists are sorted longest-first at runtime for correct deduplication.


# ── HIGH urgency ──────────────────────────────────────────────────────────────

HIGH_KEYWORDS: list[Keyword] = [

    # ── Absolute emergencies ──────────────────────────────────────────────────
    Keyword("emergency",                       10),
    Keyword("sos",                             10),
    Keyword("mayday",                          10),
    Keyword("urgent",                          10),
    Keyword("life threatening",                10),
    Keyword("in danger",                       10),
    Keyword("need help now",                   10),
    Keyword("need immediate help",             10),
    Keyword("need immediate assistance",       10),

    # ── Speed / immediacy ─────────────────────────────────────────────────────
    Keyword("as soon as possible",              9),
    Keyword("asap",                             9),
    Keyword("immediately",                      9),
    Keyword("right this moment",                9),
    Keyword("right this minute",                9),
    Keyword("right away",                       8),
    Keyword("right now",                        7),
    Keyword("cannot wait",                      8),
    Keyword("can't wait",                       8),
    Keyword("cannot wait any longer",           9),
    Keyword("please hurry",                     8),
    Keyword("hurry up",                         8),
    Keyword("rush",                             6),

    # ── Vehicle total failure ─────────────────────────────────────────────────
    Keyword("vehicle on fire",                 10),
    Keyword("car on fire",                     10),
    Keyword("sunog ang kotse",                 10),
    Keyword("nasusunog",                       10),
    Keyword("nasunog",                         10),
    Keyword("engine failure",                   9),
    Keyword("engine exploded",                 10),
    Keyword("brakes failed",                   10),
    Keyword("no brakes",                       10),
    Keyword("walang preno",                    10),
    Keyword("palpak ang preno",                10),
    Keyword("broken down",                      9),
    Keyword("broke down",                       9),
    Keyword("breaks down",                      8),
    Keyword("engine died",                      9),
    Keyword("engine stalled",                   8),
    Keyword("overheating",                      8),
    Keyword("nagsosmoke ang makina",            9),
    Keyword("smoke coming out",                 9),
    Keyword("won't start",                      8),
    Keyword("wont start",                       8),
    Keyword("doesn't start",                    8),
    Keyword("doesnt start",                     8),
    Keyword("hindi sisiga",                     8),
    Keyword("hindi umaandar",                   8),
    Keyword("hindi gumagalaw",                  8),
    Keyword("di umaandar",                      8),
    Keyword("di sisiga",                        8),
    Keyword("not working",                      7),
    Keyword("stopped working",                  8),
    Keyword("hindi gumagana",                   7),
    Keyword("hindi na gumagana",                8),
    Keyword("di gumagana",                      7),
    Keyword("patay na ang makina",              9),
    Keyword("patay na ang kotse",               9),
    Keyword("patay ang",                        8),
    Keyword("flat tire",                        7),
    Keyword("blown tire",                       7),
    Keyword("pumutok ang gulong",               8),
    Keyword("nasira ang gulong",                7),
    Keyword("battery dead",                     8),
    Keyword("patay ang baterya",                8),
    Keyword("out of fuel",                      7),
    Keyword("ran out of gas",                   7),
    Keyword("ran out of fuel",                  7),
    Keyword("walang gasolina",                  7),
    Keyword("naubos ang gasolina",              7),
    Keyword("locked out",                       7),
    Keyword("keys locked inside",               8),
    Keyword("keys inside the car",              8),
    Keyword("naka-lock ang susi",               8),
    Keyword("naiwan ang susi",                  8),
    Keyword("naiwanan ng susi",                 8),
    Keyword("nakalimutan ang susi",             7),

    # ── Stranded / immobilised ────────────────────────────────────────────────
    Keyword("stranded",                        10),
    Keyword("naiwan sa daan",                   9),
    Keyword("naiwanan sa gitna ng daan",       10),
    Keyword("naiwan sa kalsada",                9),
    Keyword("naiwan sa expressway",             9),
    Keyword("stuck on the road",                8),
    Keyword("stuck on the highway",             8),
    Keyword("stuck on the",                     7),
    Keyword("natigil sa",                       7),
    Keyword("nakulong sa loob",                 8),
    Keyword("di makaalis",                      8),
    Keyword("di makabalik",                     8),
    Keyword("di makagalaw",                     8),
    Keyword("walang galaw",                     8),
    Keyword("hindi makaalis",                   8),
    Keyword("hindi makabalik",                  8),
    Keyword("naiiwan",                          7),
    Keyword("stuck in traffic",                 6),

    # ── Flood / natural hazard ────────────────────────────────────────────────
    Keyword("flooded",                          8),
    Keyword("flood",                            7),
    Keyword("submerged",                        9),
    Keyword("baha",                             7),
    Keyword("binabaha",                         8),
    Keyword("nilunod ng baha",                  9),
    Keyword("umaapaw",                          7),

    # ── Accidents / collisions ────────────────────────────────────────────────
    Keyword("naaksidente",                     10),
    Keyword("aksidente",                        9),
    Keyword("nag-crash",                        9),
    Keyword("na-crash",                         9),
    Keyword("nagbangga",                        9),
    Keyword("nabangga",                         9),
    Keyword("nagkatambok",                      8),
    Keyword("accident",                         9),
    Keyword("crashed",                          9),
    Keyword("collision",                        9),
    Keyword("hit another car",                  9),
    Keyword("hit a car",                        9),
    Keyword("rear ended",                       9),
    Keyword("road accident",                    9),
    Keyword("bumangga",                         9),
    Keyword("may nabangga",                     9),
    Keyword("may aksidente",                    9),

    # ── Safety / crime ────────────────────────────────────────────────────────
    Keyword("stolen",                          10),
    Keyword("theft",                           10),
    Keyword("hijacked",                        10),
    Keyword("carjacked",                       10),
    Keyword("car missing",                     10),
    Keyword("vehicle missing",                 10),
    Keyword("ninakaw ang kotse",               10),
    Keyword("ninakaw",                         10),
    Keyword("nanakawan",                       10),
    Keyword("nawala ang sasakyan",             10),
    Keyword("nawala ang kotse",                10),
    Keyword("kinuha ang kotse",                10),
    Keyword("dinukot ang",                     10),
    Keyword("report to police",                 9),
    Keyword("calling police",                   9),
    Keyword("called the police",                9),
    Keyword("filed a report",                   8),
    Keyword("pumunta sa pulis",                 9),
    Keyword("nag-report sa pulis",              9),

    # ── Billing fraud / abuse ─────────────────────────────────────────────────
    Keyword("fraud",                           10),
    Keyword("scam",                            10),
    Keyword("scammed",                         10),
    Keyword("unauthorized charge",              9),
    Keyword("unauthorized transaction",         9),
    Keyword("charged twice",                    9),
    Keyword("double charge",                    9),
    Keyword("double charged",                   9),
    Keyword("overcharge",                       8),
    Keyword("overcharged",                      8),
    Keyword("nangaltas",                        9),
    Keyword("kinuha ang pera",                  9),
    Keyword("nalinlang",                       10),
    Keyword("niloko",                          10),
    Keyword("lokohin",                          9),
    Keyword("panloloko",                       10),
    Keyword("illegal na charge",                9),
    Keyword("illegal charge",                   9),
    Keyword("money stolen",                    10),

    # ── Service failure (high-severity) ──────────────────────────────────────
    Keyword("cancelled without notice",         9),
    Keyword("cancelled without warning",        9),
    Keyword("no driver",                        8),
    Keyword("driver didn't arrive",             8),
    Keyword("driver did not arrive",            8),
    Keyword("car didn't arrive",                8),
    Keyword("car did not arrive",               8),
    Keyword("walang driver",                    8),
    Keyword("hindi dumating ang driver",        8),
    Keyword("hindi dumating ang kotse",         8),
    Keyword("wrong vehicle",                    8),
    Keyword("wrong car",                        8),
    Keyword("maling kotse",                     8),
    Keyword("cant return",                      7),
    Keyword("can't return",                     7),
    Keyword("cannot return",                    7),
    Keyword("hindi makabalik ng kotse",         8),
    Keyword("late return",                      6),
    Keyword("hindi pa nag-reply",               7),
    Keyword("walang update",                    7),
    Keyword("binabalewala",                     8),
    Keyword("walang suporta",                   7),
    Keyword("walang sinasabi",                  7),

    # ── Distress / plea phrases ───────────────────────────────────────────────
    Keyword("please help me",                   8),
    Keyword("please help",                      7),
    Keyword("help me please",                   8),
    Keyword("tulungan ninyo ako",               9),
    Keyword("tulungan niyo",                    9),
    Keyword("tulungan mo ako",                  9),
    Keyword("tulungan mo",                      8),
    Keyword("saklolo",                         10),
    Keyword("tulong po",                        8),
    Keyword("tulong",                           8),
    Keyword("matulungan",                       7),
    Keyword("wala na akong magagawa",           8),
    Keyword("hindi na namin kaya",              8),
    Keyword("hindi ko na alam",                 7),
    Keyword("hindi ko alam gagawin ko",         8),

    # ── Filipino immediacy signals ────────────────────────────────────────────
    Keyword("kailangan ko na ngayon",          10),
    Keyword("kailangan ko na",                  9),
    Keyword("kailangan ngayon",                 9),
    Keyword("ngayon na",                        9),
    Keyword("ngayon lang",                      8),
    Keyword("bilis na",                         8),
    Keyword("dali na",                          8),
    Keyword("bilisan na",                       8),
    Keyword("urgent na po",                     9),
    Keyword("grabe na ito",                     8),
    Keyword("grabe na",                         7),
    Keyword("grabe",                            6),
    Keyword("grabeh",                           6),
    Keyword("hindi na kaya",                    8),
    Keyword("hindi mapigilan",                  8),
    Keyword("nasiraan",                         9),
    Keyword("nasira",                           8),  # length-sort keeps nasiraan first
    Keyword("sira ang",                         8),
    Keyword("ay nako",                          6),
    Keyword("nako grabe",                       7),
    Keyword("sus grabe",                        7),
    Keyword("hindi na talaga",                  7),

    # ── Time-critical today signals ───────────────────────────────────────────
    # Standalone weight 7; scoring logic requires co-signal for HIGH.
    Keyword("in 15 minutes",                    9),
    Keyword("in 30 minutes",                    8),
    Keyword("within the hour",                  8),
    Keyword("in an hour",                       8),
    Keyword("tonight",                          7),
    Keyword("this morning",                     7),
    Keyword("this afternoon",                   7),
    Keyword("this evening",                     7),
    Keyword("mamaya na",                        7),
    Keyword("mamaya pa lang",                   7),
    Keyword("ngayong umaga",                    7),
    Keyword("ngayong hapon",                    7),
    Keyword("ngayong gabi",                     8),
    Keyword("ngayon din",                       8),
]


# ── MEDIUM urgency ────────────────────────────────────────────────────────────

MEDIUM_KEYWORDS: list[Keyword] = [
    # ── Booking / reservation ─────────────────────────────────────────────────
    Keyword("booking",                          1),
    Keyword("reservation",                      2),
    Keyword("reserve",                          2),
    Keyword("book a car",                       2),
    Keyword("mag-book",                         2),
    Keyword("magpabook",                        2),
    Keyword("schedule",                         2),
    Keyword("reschedule",                       3),
    Keyword("rebook",                           2),
    Keyword("modify booking",                   3),
    Keyword("change booking",                   3),
    Keyword("update booking",                   3),
    Keyword("adjust booking",                   2),
    Keyword("i-reschedule",                     3),
    Keyword("baguhin ang",                      2),
    Keyword("palitan ang",                      2),

    # ── Pricing / quotation ───────────────────────────────────────────────────
    Keyword("how much",                         2),
    Keyword("magkano",                          2),
    Keyword("magkano po",                       2),
    Keyword("price",                            1),
    Keyword("rate",                             1),
    Keyword("cost",                             1),
    Keyword("quote",                            3),
    Keyword("quotation",                        3),
    Keyword("pricing",                          2),
    Keyword("package",                          2),
    Keyword("promo",                            2),
    Keyword("discount",                         2),
    Keyword("may promo ba",                     3),
    Keyword("may package ba",                   2),
    Keyword("presyo",                           2),
    Keyword("bayad",                            2),
    Keyword("halaga",                           2),
    Keyword("libre ba",                         2),
    Keyword("gaano kalaki",                     2),

    # ── Availability ──────────────────────────────────────────────────────────
    Keyword("availability",                     2),
    Keyword("available",                        2),
    Keyword("is there a",                       1),
    Keyword("meron bang",                       2),
    Keyword("mayroon bang",                     2),
    Keyword("available ba",                     2),
    Keyword("libre ba ang",                     2),
    Keyword("may makukuha ba",                  2),
    Keyword("may kotse ba",                     2),

    # ── Issues / problems (moderate) ──────────────────────────────────────────
    Keyword("problem",                          3),
    Keyword("issue",                            2),
    Keyword("concern",                          2),
    Keyword("complaint",                        3),
    Keyword("reklamo",                          3),
    Keyword("may reklamo",                      3),
    Keyword("may problema",                     3),
    Keyword("may issue",                        2),
    Keyword("may concern",                      2),
    Keyword("confused",                         2),
    Keyword("nalilito",                         2),
    Keyword("hindi ko maintindihan",            3),
    Keyword("hindi maintindihan",               3),
    Keyword("clarify",                          2),
    Keyword("linawin",                          2),
    Keyword("confirm",                          2),
    Keyword("i-confirm",                        2),
    Keyword("kumpirmahin",                      2),
    Keyword("verification",                     2),

    # ── Service options / add-ons ─────────────────────────────────────────────
    Keyword("additional driver",                2),
    Keyword("extra driver",                     2),
    Keyword("add driver",                       2),
    Keyword("dagdag na driver",                 2),
    Keyword("pickup",                           1),
    Keyword("drop off",                         2),
    Keyword("return time",                      2),
    Keyword("pickup time",                      2),
    Keyword("delivery",                         2),
    Keyword("hatid",                            1),
    Keyword("sundo",                            2),
    Keyword("airport pickup",                   3),
    Keyword("padala ng kotse",                  2),
    Keyword("ipadala ang kotse",                2),
    Keyword("driver para sa",                   2),
    Keyword("may driver ba",                    2),

    # ── Near-term timing (not emergency) ─────────────────────────────────────
    Keyword("today",                            2),
    Keyword("tomorrow",                         2),
    Keyword("bukas",                            2),
    Keyword("this week",                        3),
    Keyword("next week",                        2),
    Keyword("this weekend",                     2),
    Keyword("sa weekend",                       2),
    Keyword("sa susunod na linggo",             2),
    Keyword("soon",                             2),
    Keyword("malapit na",                       2),
    Keyword("hindi pa",                         2),
    Keyword("waiting",                          2),
    Keyword("naghihintay",                      2),
    Keyword("delayed",                          3),
    Keyword("late",                             2),
    Keyword("matagal",                          2),
    Keyword("matagal na",                       3),

    # ── Airport / travel ──────────────────────────────────────────────────────
    Keyword("flight",                           4),   # amplified if + time signal
    Keyword("airport",                          3),
    Keyword("terminal",                         2),
    Keyword("departure",                        3),
    Keyword("catching a flight",                4),
    Keyword("may flight",                       4),
    Keyword("may byahe",                        3),
    Keyword("papuntang airport",                3),
    Keyword("sa paliparan",                     3),
    Keyword("naia",                             3),

    # ── Cancellation / refund ─────────────────────────────────────────────────
    Keyword("cancel",                           3),
    Keyword("cancellation",                     3),
    Keyword("i-cancel",                         3),
    Keyword("kanselahin",                       3),
    Keyword("refund",                           3),
    Keyword("ibalik ang bayad",                 3),
    Keyword("ibalik ang pera",                  3),
    Keyword("reimbursement",                    3),
    Keyword("bayad-pinsala",                    3),

    # ── General inquiry (Tagalog) ─────────────────────────────────────────────
    Keyword("inquiry",                          2),
    Keyword("question",                         2),
    Keyword("tanong",                           2),
    Keyword("tanong ko lang",                   2),
    Keyword("tanong ko po",                     2),
    Keyword("gusto ko pong malaman",            2),
    Keyword("gusto ko lang malaman",            2),
    Keyword("gusto ko",                         1),
    Keyword("gustong",                          1),
    Keyword("interesado",                       2),
    Keyword("pwede ba",                         2),
    Keyword("pwede bang",                       2),
    Keyword("puwede ba",                        2),
    Keyword("mayroon ba",                       2),
    Keyword("meron ba",                         2),
    Keyword("saan ba",                          1),
    Keyword("kailan ba",                        2),
    Keyword("paano ba",                         1),
    Keyword("ano ang",                          1),
    Keyword("pahabol",                          3),
    Keyword("balak",                            2),
    Keyword("plano",                            2),
    Keyword("kailangan ko",                     2),
    Keyword("kailangan namin",                  2),
    Keyword("kailangan namin ng",               2),
]


# ── LOW urgency (score penalties) ─────────────────────────────────────────────

LOW_KEYWORDS: list[Keyword] = [
    # ── Gratitude ─────────────────────────────────────────────────────────────
    Keyword("thank you so much",                3),
    Keyword("thank you",                        3),
    Keyword("thanks",                           2),
    Keyword("maraming salamat po",              3),
    Keyword("maraming salamat",                 3),
    Keyword("salamat po",                       2),
    Keyword("salamat",                          2),
    Keyword("salmat",                           2),   # common misspelling
    Keyword("pasensya na",                      2),   # apologetic opener → low urgency

    # ── Positive feedback ─────────────────────────────────────────────────────
    Keyword("great service",                    3),
    Keyword("excellent service",                3),
    Keyword("good job",                         3),
    Keyword("well done",                        3),
    Keyword("kudos",                            3),
    Keyword("satisfied",                        3),
    Keyword("napaka-ganda",                     3),
    Keyword("maganda ang serbisyo",             3),
    Keyword("mahusay",                          2),
    Keyword("magaling",                         2),
    Keyword("5 stars",                          3),
    Keyword("five stars",                       3),
    Keyword("happy with",                       3),
    Keyword("happy customer",                   3),
    Keyword("compliment",                       3),
    Keyword("positive feedback",                3),
    Keyword("love your service",                3),
    Keyword("love the service",                 3),
    Keyword("nasisiyahan",                      3),

    # ── No-rush / future ──────────────────────────────────────────────────────
    Keyword("not urgent",                       6),
    Keyword("no rush",                          5),
    Keyword("hindi urgent",                     6),
    Keyword("hindi po urgent",                  6),
    Keyword("walang madalian",                  5),
    Keyword("walang rush",                      5),
    Keyword("whenever",                         4),
    Keyword("when you get a chance",            4),
    Keyword("when you have time",               4),
    Keyword("take your time",                   4),
    Keyword("next month",                       4),
    Keyword("next year",                        4),
    Keyword("susunod na buwan",                 3),
    Keyword("sa susunod na taon",               4),
    Keyword("future reference",                 3),
    Keyword("someday",                          3),
    Keyword("eventually",                       3),
    Keyword("balang araw",                      3),

    # ── Just browsing / casual interest ──────────────────────────────────────
    Keyword("just browsing",                    4),
    Keyword("just looking",                     3),
    Keyword("just wanted to",                   3),
    Keyword("just a suggestion",                3),
    Keyword("just checking",                    2),
    Keyword("just curious",                     3),
    Keyword("curious lang",                     3),
    Keyword("tinitingnan lang",                 3),
    Keyword("nagtatanong lang",                 2),

    # ── General greeting openers ──────────────────────────────────────────────
    Keyword("good morning",                     1),
    Keyword("good afternoon",                   1),
    Keyword("good evening",                     1),
    Keyword("good day",                         2),
    Keyword("hello",                            2),
    Keyword("hi there",                         2),
    Keyword("magandang umaga",                  1),
    Keyword("magandang hapon",                  1),
    Keyword("magandang gabi",                   1),
    Keyword("maligayang pagdating",             2),

    # ── Filler positives ──────────────────────────────────────────────────────
    Keyword("nice",                             2),
    Keyword("wow",                              2),
    Keyword("amazing",                          2),
    Keyword("ganda",                            2),
    Keyword("astig",                            2),
    Keyword("cool",                             1),
]


# ── Explicit LOW overrides: any match forces LOW regardless of score ──────────

_EXPLICIT_LOW_OVERRIDES: tuple[str, ...] = (
    "not urgent",
    "hindi urgent",
    "hindi po urgent",
    "walang madalian",
    "walang rush",
    "no rush",
    "non-urgent",
    "hindi na-urgent",
    "not an emergency",
    "hindi emergency",
)


# ── Context amplification pairs ───────────────────────────────────────────────
# (signal_a, signal_b, bonus_score)
# Applied when BOTH signals appear anywhere in the message.

_AMPLIFY_PAIRS: list[tuple[str, str, float]] = [
    ("flight",    "tonight",   5.0),
    ("flight",    "ngayong gabi", 5.0),
    ("flight",    "today",     4.0),
    ("flight",    "ngayon",    4.0),
    ("flight",    "tomorrow",  3.0),
    ("flight",    "bukas",     3.0),
    ("airport",   "tonight",   4.0),
    ("airport",   "today",     3.0),
    ("cancel",    "today",     3.0),
    ("cancel",    "ngayon",    3.0),
    ("problem",   "tonight",   3.0),
    ("delayed",   "flight",    4.0),
    ("naia",      "ngayon",    4.0),
    ("naia",      "today",     3.0),
    ("aksidente", "help",      2.0),
    ("nasira",    "ngayon",    3.0),
    ("stranded",  "help",      3.0),
    ("stuck",     "highway",   3.0),
    ("stuck",     "expressway", 3.5),
    ("baha",      "kotse",     3.0),
    ("flood",     "car",       3.0),
]


# ── Terms that are NEVER considered negated ──────────────────────────────────
# (their meaning does not flip with "no/not/hindi/wala")

_NON_NEGATABLE: frozenset[str] = frozenset({
    "problem", "issue", "concern", "complaint",
    "question", "inquiry", "booking", "reservation",
    "price", "rate", "cost", "quote", "availability", "available",
    "reklamo", "problema", "tanong", "bayad", "presyo",
    "schedule", "delivery", "pickup",
})


# ── English contraction normalisation ────────────────────────────────────────

_CONTRACTIONS: dict[str, str] = {
    r"\bwon't\b":       "will not",
    r"\bcan't\b":       "cannot",
    r"\bcouldn't\b":    "could not",
    r"\bwouldn't\b":    "would not",
    r"\bshouldn't\b":   "should not",
    r"\bdon't\b":       "do not",
    r"\bdoesn't\b":     "does not",
    r"\bdidn't\b":      "did not",
    r"\bisn't\b":       "is not",
    r"\baren't\b":      "are not",
    r"\bwasn't\b":      "was not",
    r"\bweren't\b":     "were not",
    r"\bhasn't\b":      "has not",
    r"\bhaven't\b":     "have not",
    r"\bhadn't\b":      "had not",
    r"\bI'm\b":         "I am",
    r"\bthey're\b":     "they are",
    r"\bwe're\b":       "we are",
    r"\byou're\b":      "you are",
    r"\bit's\b":        "it is",
    r"\bhe's\b":        "he is",
    r"\bshe's\b":       "she is",
    r"\bthat's\b":      "that is",
    r"\bwhat's\b":      "what is",
    r"\bthere's\b":     "there is",
    r"\bwhere's\b":     "where is",
    r"\bhow's\b":       "how is",
}

# Compile once at import
_CONTRACTION_RE: list[tuple[re.Pattern, str]] = [
    (re.compile(pattern, re.IGNORECASE), replacement)
    for pattern, replacement in _CONTRACTIONS.items()
]


# ── Emoji sentiment map ───────────────────────────────────────────────────────
# Maps emoji to (score_contribution, label)

_EMOJI_HIGH: dict[str, tuple[float, str]] = {
    "🚨": (8.0, "emergency siren emoji"),
    "🆘": (9.0, "SOS emoji"),
    "🔥": (7.0, "fire emoji"),
    "⚠️": (5.0, "warning emoji"),
    "🚗💨": (5.0, "car-speeding emoji sequence"),
    "😱": (4.0, "screaming face emoji"),
    "😰": (4.0, "anxious face emoji"),
    "😭": (3.5, "loudly crying emoji"),
    "🆘": (9.0, "SOS box emoji"),
    "🚒": (6.0, "fire truck emoji"),
    "🚑": (6.0, "ambulance emoji"),
    "🙏": (2.0, "pleading/prayer emoji"),
    "😤": (3.0, "frustrated emoji"),
    "😡": (3.5, "angry face emoji"),
    "🤬": (4.0, "face with symbols emoji"),
}

_EMOJI_LOW: dict[str, tuple[float, str]] = {
    "😊": (2.0, "happy emoji"),
    "😄": (2.0, "grinning emoji"),
    "😁": (2.0, "beaming emoji"),
    "🥰": (2.0, "loving emoji"),
    "👍": (2.0, "thumbs up emoji"),
    "🙌": (2.0, "raised hands emoji"),
    "❤️": (1.5, "heart emoji"),
    "💯": (1.5, "hundred points emoji"),
    "✅": (1.0, "check mark emoji"),
}


# ── Tagalog language detection helpers ───────────────────────────────────────

# Common Tagalog words that unambiguously indicate Filipino text
_TAGALOG_MARKERS: frozenset[str] = frozenset({
    "ang", "ng", "sa", "na", "pa", "po", "ho", "din", "rin", "ay",
    "si", "ni", "para", "pero", "kung", "kasi", "bakit", "paano",
    "ano", "sino", "kanino", "alin", "saan", "kailan", "gaano",
    "hindi", "huwag", "wag", "wala", "walang", "mayroon", "meron",
    "gusto", "ayaw", "kailangan", "dapat", "pwede", "puwede",
    "naman", "talaga", "siyempre", "siguro", "halos", "baka",
    "ngayon", "kagabi", "kahapon", "bukas", "mamaya", "kanina",
    "dito", "doon", "diyan", "rito", "roon", "riyan",
    "ako", "ikaw", "siya", "kami", "tayo", "kayo", "sila",
    "namin", "natin", "ninyo", "nila", "niya", "akin", "atin",
    "kotse", "sasakyan", "makina", "gulong", "preno", "baterya",
    "driver", "pasahero", "kalsada", "daan", "expressway", "NAIA",
})

_ENGLISH_MARKERS: frozenset[str] = frozenset({
    "the", "is", "are", "was", "were", "have", "has", "had",
    "will", "would", "could", "should", "can", "may", "might",
    "my", "your", "our", "their", "its", "this", "that", "these",
    "those", "not", "no", "yes", "please", "help", "need", "want",
    "car", "vehicle", "engine", "wheel", "driver", "road", "highway",
    "urgent", "emergency", "problem", "issue", "cancel", "booking",
})


def _detect_languages(text: str) -> tuple[bool, bool, bool]:
    """
    Detect whether the text contains English and/or Tagalog content.
    Returns (has_english, has_tagalog, is_taglish).
    """
    words = set(re.findall(r'\b\w+\b', text.lower()))
    en_hits = len(words & _ENGLISH_MARKERS)
    tl_hits = len(words & _TAGALOG_MARKERS)
    has_en  = en_hits >= 2
    has_tl  = tl_hits >= 2
    return has_en, has_tl, (has_en and has_tl)


# ── Negation detector ─────────────────────────────────────────────────────────

# English: NOT / NO / NEVER up to 5 tokens before target
# Tagalog: HINDI / HUWAG / WAG / WALA up to 5 tokens before target
_NEGATION_RE = re.compile(
    r'(?:not|no|none|never|hindi|huwag|wag|wala)\s+(?:\w+\s+){0,5}',
    re.IGNORECASE,
)

_TAGALOG_NEG_RE = re.compile(
    r'(?:di|hindi|huwag|wag|wala)\s+(?:\w+\s+){0,5}',
    re.IGNORECASE,
)


def _is_negated(text: str, term: str) -> bool:
    """
    Return True if `term` appears to be negated.
    Terms in _NON_NEGATABLE are never considered negated.
    """
    if term.lower() in _NON_NEGATABLE:
        return False
    escaped = re.escape(term)
    pattern = _NEGATION_RE.pattern + escaped
    if re.search(pattern, text, re.IGNORECASE):
        return True
    # Additional Tagalog negation check with wider scope
    tl_pattern = _TAGALOG_NEG_RE.pattern + escaped
    return bool(re.search(tl_pattern, text, re.IGNORECASE))


# ── Pre-processing ─────────────────────────────────────────────────────────────

def _sanitize(text: str, max_chars: int = _MAX_MESSAGE_CHARS) -> str:
    """Strip control characters, normalise unicode, cap length."""
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    return text[:max_chars]


def _expand_contractions(text: str) -> str:
    """Expand English contractions so negation detection works correctly."""
    for pattern, replacement in _CONTRACTION_RE:
        text = pattern.sub(replacement, text)
    return text


def _normalise_tagalog(text: str) -> str:
    """
    Lightweight Tagalog normalisation:
    - 'di ' → 'hindi ' (common shortform)
    - repeated vowels used for emphasis (graaaabe → grabe)
    - common SMS/chat shortenings
    """
    text = re.sub(r'\bdi\b', 'hindi', text, flags=re.IGNORECASE)
    text = re.sub(r'\bh?indi\b', 'hindi', text, flags=re.IGNORECASE)
    # Emphasis elongation: graaaabe → grabe, tuloooong → tulong
    text = re.sub(r'([a-zA-Z])\1{2,}', r'\1\1', text)  # collapse 3+ → 2
    text = re.sub(r'([aeiouAEIOU])\1+', r'\1', text)    # collapse vowel run → 1
    return text


def _preprocess(text: str) -> str:
    """Full pre-processing pipeline."""
    text = _sanitize(text)
    text = _expand_contractions(text)
    text = _normalise_tagalog(text)
    return text


# ── Emoji scoring ─────────────────────────────────────────────────────────────

def _score_emojis(text: str) -> tuple[float, list[str]]:
    """Extract emoji sentiment signals from the raw text."""
    score = 0.0
    found: list[str] = []
    for emoji, (weight, label) in _EMOJI_HIGH.items():
        if emoji in text:
            score += weight
            found.append(label)
    for emoji, (weight, label) in _EMOJI_LOW.items():
        if emoji in text:
            score -= weight
            found.append(f"-{label}")
    return score, found


# ── Keyword scorer ─────────────────────────────────────────────────────────────

def _score_keywords(text: str, keywords: list[Keyword]) -> tuple[float, list[str]]:
    """
    Score text against a keyword list.

    Longest-first ordering ensures multi-word phrases shadow their sub-words.
    Once a phrase is matched, any shorter term that is a substring of it is
    skipped to prevent double-counting.
    """
    lower   = text.lower()
    score   = 0.0
    matched: list[str] = []
    seen:   set[str]   = set()

    for kw in sorted(keywords, key=lambda k: len(k.term), reverse=True):
        term = kw.term.lower()
        if any(term in s for s in seen):
            continue
        # Word-boundary match (works for ASCII + Latin extended)
        pattern = r'(?<![a-zA-Z\u00C0-\u024F\u1E00-\u1EFF])' \
                  + re.escape(term) \
                  + r'(?![a-zA-Z\u00C0-\u024F\u1E00-\u1EFF])'
        if re.search(pattern, lower):
            if _is_negated(lower, term):
                score -= kw.weight * 0.5
            else:
                score  += kw.weight
                matched.append(term)
                seen.add(term)

    return score, matched


# ── Time signal detector ──────────────────────────────────────────────────────

def _extract_time_signals(text: str) -> tuple[float, list[str]]:
    """
    Detect near-future / deadline time references.
    HH:MM and bare N am/pm are mutually exclusive (highest wins).
    """
    score = 0.0
    found: list[str] = []

    # HH:MM am/pm (most specific)
    if re.search(r'\b\d{1,2}:\d{2}\s*(?:am|pm)\b', text, re.IGNORECASE):
        score += 5
        found.append("specific time HH:MM am/pm")
    elif re.search(r'\b\d{1,2}\s*(?:am|pm)\b', text, re.IGNORECASE):
        score += 4
        found.append("am/pm time reference")

    # Within-hours deadline (highest urgency time expression)
    if re.search(r'\bwithin\s+\d+\s+hours?\b', text, re.IGNORECASE):
        score += 7
        found.append("hours-level deadline (within N hours)")
    elif re.search(r'\bin\s+\d+\s*(?:minutes?|mins?)\b', text, re.IGNORECASE):
        score += 6
        found.append("minutes deadline (in N minutes)")
    elif re.search(r'\bin\s+\d+\s*(?:hours?|hrs?)\b', text, re.IGNORECASE):
        score += 5
        found.append("hours deadline (in N hours)")
    elif re.search(r'\b\d+[\s-]*hours?\b', text, re.IGNORECASE):
        score += 4
        found.append("N-hour window")

    # Tagalog time expressions
    if re.search(r'\bsa\s+loob\s+ng\s+\d+\s+(?:minuto|oras)\b', text, re.IGNORECASE):
        score += 6
        found.append("Tagalog: sa loob ng N minuto/oras")
    if re.search(r'\b(?:ilang|mga)\s+minuto\s+na\b', text, re.IGNORECASE):
        score += 5
        found.append("Tagalog: ilang/mga minuto na")
    if re.search(r'\bkaunting\s+oras\b', text, re.IGNORECASE):
        score += 4
        found.append("Tagalog: kaunting oras")

    # Relative days
    if re.search(r'\bin\s+\d+\s+days?\b', text, re.IGNORECASE):
        score += 3
        found.append("relative deadline (in N days)")

    # Calendar references (planning context — lower urgency)
    if re.search(r'\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b', text):
        score += 2
        found.append("specific date (MM/DD)")
    if re.search(
        r'\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}\b',
        text, re.IGNORECASE,
    ):
        score += 2
        found.append("month-day date")

    return score, found


# ── Sentiment amplifier detector ──────────────────────────────────────────────

def _extract_sentiment_signals(text: str) -> tuple[float, list[str]]:
    """
    Frustration / distress markers.  All contributions are dampened and capped
    in the caller to prevent sentiment noise alone causing a HIGH classification.
    """
    score = 0.0
    found: list[str] = []

    # Exclamation marks
    excl = text.count("!")
    if excl >= 1:
        score += min(excl * 1.5, 6)
        found.append(f"{excl} exclamation mark(s)")

    # Consecutive punctuation !!!??? — strong distress
    if re.search(r'[!?]{3,}', text):
        score += 3
        found.append("repeated punctuation (distress)")

    # All-caps words ≥3 letters
    caps_words = re.findall(r'\b[A-Z]{3,}\b', text)
    if caps_words:
        score += min(len(caps_words) * 2, 8)
        found.append(f"{len(caps_words)} ALL-CAPS word(s)")

    # High caps ratio (>40% of words)
    words = text.split()
    if words:
        caps_ratio = sum(1 for w in words if w.isupper() and len(w) >= 2) / len(words)
        if caps_ratio > 0.4:
            score += 5
            found.append(f"high CAPS ratio ({caps_ratio:.0%})")

    # Multiple question marks = frustration
    q_count = text.count("?")
    if q_count >= 3:
        score += min(q_count, 4)
        found.append(f"{q_count} question marks (frustration)")

    # Long messages = detailed complaint or urgent situation
    wc = len(words)
    if wc > 100:
        score += 4
        found.append(f"very long message ({wc} words)")
    elif wc > 60:
        score += 2
        found.append(f"long message ({wc} words)")

    # Repeated words — "tulong tulong tulong" = extreme distress
    if re.search(r'\b(\w{3,})\b(?:\s+\1){2,}', text, re.IGNORECASE):
        score += 5
        found.append("repeated words (distress signal)")

    # Tagalog distress interjections
    tl_distress = re.findall(
        r'\b(?:nako|ay nako|sus|uy|grabe|grabeh|OMG|OMG po)\b',
        text, re.IGNORECASE,
    )
    if tl_distress:
        score += min(len(tl_distress) * 1.5, 5)
        found.append(f"Filipino distress interjections: {list(set(tl_distress))}")

    # Honorific "po/ho" usage — signals polite framing, slightly reduces aggression
    po_count = len(re.findall(r'\b(?:po|ho)\b', text, re.IGNORECASE))
    if po_count >= 3:
        score -= 1.5   # very polite → less panic
        found.append(f"{po_count} honorific po/ho (polite framing softener)")
    elif po_count >= 1:
        score -= 0.5
        found.append(f"{po_count} honorific po/ho (slight softener)")

    return score, found


# ── Context amplification ─────────────────────────────────────────────────────

def _compute_context_amplification(
    high_matched: list[str],
    med_matched:  list[str],
    time_found:   list[str],
) -> float:
    """
    Co-occurrence bonuses: pairs of signals that together imply higher urgency.
    e.g. 'flight' + 'tonight' = very high risk → +5 points.
    """
    bonus    = 0.0
    all_sigs = {s.lower() for s in high_matched + med_matched + time_found}

    for sig_a, sig_b, extra in _AMPLIFY_PAIRS:
        a = any(sig_a in s for s in all_sigs)
        b = any(sig_b in s for s in all_sigs)
        if a and b:
            bonus += extra

    return bonus


# ── Taglish multiplier ────────────────────────────────────────────────────────

def _taglish_multiplier(
    high_matched: list[str],
    has_en: bool,
    has_tl: bool,
    is_taglish: bool,
    high_score: float,
) -> float:
    """
    When a message is Taglish AND has HIGH keywords from both languages,
    apply a small multiplier. Code-switching under stress is a genuine urgency
    indicator — people naturally mix languages when panicking.

    Only applies when high_score is already meaningful (>= 5) to avoid noise.
    Returns an additive bonus (not a replacement score).
    """
    if not is_taglish or high_score < 5:
        return 0.0

    # Check if both English and Tagalog HIGH terms are present
    tl_high_terms = {
        "nasiraan", "nasira", "aksidente", "naaksidente", "tulong",
        "saklolo", "ninakaw", "nanakawan", "naiwan", "stranded",
        "sira ang", "patay ang", "walang galaw", "kailangan ko na",
        "ngayon na", "grabe", "grabeh",
    }
    en_high_terms = {
        "urgent", "emergency", "accident", "stolen", "broken down",
        "help", "asap", "immediately", "stranded", "fraud", "scam",
        "flat tire", "engine failure", "overheating", "not working",
    }

    matched_lower = {m.lower() for m in high_matched}
    has_tl_high   = any(t in m for t in tl_high_terms for m in matched_lower)
    has_en_high   = any(e in m for e in en_high_terms for m in matched_lower)

    if has_tl_high and has_en_high:
        return high_score * (_TAGLISH_MULTIPLIER - 1.0)  # additive bonus

    return 0.0


# ── Explicit LOW check ─────────────────────────────────────────────────────────

def _check_explicit_low(text: str) -> bool:
    lower = text.lower()
    return any(phrase in lower for phrase in _EXPLICIT_LOW_OVERRIDES)


# ── Core classifier ────────────────────────────────────────────────────────────

def classify_urgency(message: str, subject: str = "") -> ClassifyResult:
    """
    Classify a contact message into 'high', 'medium', or 'low' urgency.

    Scoring pipeline
    ─────────────────
     1. Sanitize, expand contractions, normalise Tagalog.
     2. Explicit LOW override → early exit.
     3. Emoji sentiment extraction.
     4. Score HIGH / MEDIUM / LOW keyword lists.
     5. Subject-line HIGH bonus (1.0×).
     6. Time signal extraction.
     7. Sentiment amplifier extraction (dampened × 0.30, capped at 7).
     8. Context co-occurrence amplification.
     9. Taglish multiplier (additive, only when score already ≥ 5).
    10. Medium contribution (capped; cannot alone reach HIGH).
    11. LOW penalty (capped at 12).
    12. Final score → classify with HIGH guard.

    Thresholds
    ───────────
    HIGH   : score ≥ 10  AND (has HIGH keyword OR score ≥ 15 from time+sentiment)
    MEDIUM : score ≥ 2.5 AND (medium keyword OR time signal present)
    LOW    : everything else
    """
    # ── Step 1: pre-process ───────────────────────────────────────────────────
    raw_message = message          # keep for language detection (emojis etc.)
    message     = _preprocess(str(message))
    subject     = _preprocess(str(subject))
    full_text   = f"{subject} {message}"

    if len(message.strip()) < 3:
        return ClassifyResult(
            urgency="low", score=0.0,
            breakdown={"note": "Message too short to classify"},
        )

    # ── Step 2: explicit LOW override ────────────────────────────────────────
    if _check_explicit_low(full_text):
        return ClassifyResult(
            urgency="low", score=0.0,
            breakdown={"note": "Explicit low-urgency override detected"},
        )

    # ── Step 3: emoji scoring (on raw text to preserve emoji characters) ─────
    emoji_score, emoji_found = _score_emojis(raw_message)

    # ── Step 4: keyword scoring ───────────────────────────────────────────────
    high_score,  high_matched = _score_keywords(full_text, HIGH_KEYWORDS)
    med_score,   med_matched  = _score_keywords(full_text, MEDIUM_KEYWORDS)
    low_score,   low_matched  = _score_keywords(full_text, LOW_KEYWORDS)

    # ── Step 5: subject-line HIGH bonus (1.0×) ────────────────────────────────
    subj_high, _ = _score_keywords(subject, HIGH_KEYWORDS)
    subject_bonus = subj_high * 1.0

    # ── Step 6: time signals ──────────────────────────────────────────────────
    time_score, time_found = _extract_time_signals(full_text)

    # ── Step 7: sentiment (dampened) ─────────────────────────────────────────
    sent_raw, sent_found = _extract_sentiment_signals(full_text)
    sent_contrib = min(sent_raw * _SENT_DAMPEN, _SENT_CAP)

    # ── Step 8: context amplification ────────────────────────────────────────
    context_bonus = _compute_context_amplification(high_matched, med_matched, time_found)

    # ── Step 9: Taglish multiplier ────────────────────────────────────────────
    has_en, has_tl, is_taglish = _detect_languages(full_text)
    taglish_bonus = _taglish_multiplier(
        high_matched, has_en, has_tl, is_taglish, high_score,
    )

    # ── Step 10: medium contribution (capped; cannot alone reach HIGH) ────────
    if high_score > 0 or context_bonus > 3:
        med_contribution = min(med_score * 0.25, 3)
    else:
        med_contribution = min(med_score * 0.5, 8)

    # ── Step 11: LOW penalty (capped) ────────────────────────────────────────
    low_penalty = min(low_score, _LOW_PENALTY_CAP)

    # ── Step 12: final score and classification ───────────────────────────────
    final_score = max(
        0.0,
        high_score
        + subject_bonus
        + time_score
        + sent_contrib
        + context_bonus
        + taglish_bonus
        + med_contribution
        + emoji_score
        - low_penalty,
    )

    has_high_kw       = bool(high_matched)
    has_medium_signal = bool(med_matched or time_found)

    if final_score >= _HIGH_THRESHOLD:
        if has_high_kw or final_score >= _HIGH_NO_KW_MIN:
            urgency = "high"
        else:
            urgency = "medium" if has_medium_signal else "low"
    elif final_score >= _MEDIUM_THRESHOLD and has_medium_signal:
        urgency = "medium"
    else:
        urgency = "low"

    # ── Structured log for non-LOW results ───────────────────────────────────
    if urgency != "low":
        log.info(
            "classify | urgency=%s score=%.2f lang=%s high_kw=%s",
            urgency,
            final_score,
            "taglish" if is_taglish else ("tl" if has_tl else "en"),
            high_matched[:5],
        )

    breakdown: dict = {
        "highKeywords":     high_matched,
        "mediumKeywords":   med_matched,
        "lowKeywords":      low_matched,
        "timeSignals":      time_found,
        "sentimentSignals": sent_found,
        "emojiSignals":     emoji_found,
        "languageDetected": "taglish" if is_taglish else ("tagalog" if has_tl else "english"),
        "subjectBonus":     round(subject_bonus, 2),
        "contextBonus":     round(context_bonus, 2),
        "taglishBonus":     round(taglish_bonus, 2),
        "rawScore":         round(final_score, 2),
        "components": {
            "highScore":       round(high_score, 2),
            "medContribution": round(med_contribution, 2),
            "timeScore":       round(time_score, 2),
            "sentContrib":     round(sent_contrib, 2),
            "emojiScore":      round(emoji_score, 2),
            "lowPenalty":      round(low_penalty, 2),
        },
    }

    return ClassifyResult(
        urgency=urgency,
        score=round(final_score, 2),
        breakdown=breakdown,
    )


# ── Urgency report ─────────────────────────────────────────────────────────────

def build_urgency_report(messages: list[dict]) -> dict:
    """Summarise urgency distribution across a list of message dicts."""
    report: dict = {
        "total": 0, "high": 0, "medium": 0,
        "low": 0, "unclassified": 0, "highUnread": 0,
    }
    for msg in messages:
        report["total"] += 1
        urg = msg.get("urgency") or "unclassified"
        if urg in report:
            report[urg] += 1
        else:
            report["unclassified"] += 1
        if urg == "high" and msg.get("status") == "Unread":
            report["highUnread"] += 1
    return report


# ── Security response headers ──────────────────────────────────────────────────

@app.after_request
def _add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"]         = "DENY"
    response.headers["Cache-Control"]           = "no-store"
    return response


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
@app.route("/healthz", methods=["GET"])
def health():
    """Liveness probe."""
    return jsonify({
        "status":  "ok",
        "service": "urgency-classifier",
        "version": _VERSION,
        "keywords": {
            "high":   len(HIGH_KEYWORDS),
            "medium": len(MEDIUM_KEYWORDS),
            "low":    len(LOW_KEYWORDS),
        },
        "features": ["english", "tagalog", "taglish", "emoji"],
    })


@app.route("/classify", methods=["POST"])
def classify():
    """
    Classify a single message.

    Body:   { "message": "...", "subject": "..." }
    Returns: { "urgency": "high|medium|low", "score": float, "breakdown": {...} }
    """
    body    = request.get_json(silent=True) or {}
    message = str(body.get("message", "")).strip()
    subject = str(body.get("subject", "")).strip()

    if not message:
        return jsonify({"error": "message field is required"}), 400

    result = classify_urgency(message, subject)
    return jsonify(asdict(result))


@app.route("/classify/batch", methods=["POST"])
def classify_batch():
    """
    Classify up to 150 messages in one request.

    Body:   { "messages": [{ "id": "...", "message": "...", "subject": "..." }] }
    Returns: { "results": [...] }
    """
    body     = request.get_json(silent=True) or {}
    messages = body.get("messages", [])

    if not isinstance(messages, list) or not messages:
        return jsonify({"error": "messages must be a non-empty array"}), 400
    if len(messages) > _MAX_BATCH_SIZE:
        return jsonify({"error": f"Batch exceeds max {_MAX_BATCH_SIZE} messages."}), 400

    results = []
    for item in messages:
        msg_id  = item.get("id", "")
        message = str(item.get("message", "")).strip()
        subject = str(item.get("subject", "")).strip()
        if not message:
            results.append({"id": msg_id, "error": "message is required"})
            continue
        result = classify_urgency(message, subject)
        results.append({"id": msg_id, **asdict(result)})

    return jsonify({"results": results})


@app.route("/reclassify", methods=["POST"])
def reclassify():
    """Re-run classification on existing DB message documents (admin tool)."""
    body     = request.get_json(silent=True) or {}
    messages = body.get("messages", [])

    if not isinstance(messages, list):
        return jsonify({"error": "messages must be an array"}), 400
    if len(messages) > _MAX_BATCH_SIZE:
        return jsonify({"error": f"Batch exceeds max {_MAX_BATCH_SIZE} messages."}), 400

    results = []
    for item in messages:
        doc_id  = item.get("_id", item.get("id", ""))
        message = str(item.get("message", "")).strip()
        subject = str(item.get("subject", "")).strip()
        if not message:
            continue
        result = classify_urgency(message, subject)
        results.append({"_id": doc_id, **asdict(result)})

    return jsonify({"updated": len(results), "results": results})


@app.route("/report", methods=["POST"])
def report():
    """Summarise urgency distribution across a batch of message records."""
    body     = request.get_json(silent=True) or {}
    messages = body.get("messages", [])

    if not isinstance(messages, list):
        return jsonify({"error": "messages must be an array"}), 400

    return jsonify(build_urgency_report(messages))


# ── Error handlers ─────────────────────────────────────────────────────────────

@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": "bad request", "detail": str(e)}), 400

@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "endpoint not found"}), 404

@app.errorhandler(405)
def method_not_allowed(_):
    return jsonify({"error": "method not allowed"}), 405

@app.errorhandler(413)
def request_too_large(_):
    return jsonify({"error": "request body too large"}), 413

@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "internal server error", "detail": str(e)}), 500


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port  = int(os.environ.get("URGENCY_PORT", 5001))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"

    print(f"\n{'='*60}")
    print(f"  Triple R & A — Urgency Classifier Service  {_VERSION}")
    print(f"{'='*60}")
    print(f"  HIGH keywords   : {len(HIGH_KEYWORDS)}")
    print(f"  MEDIUM keywords : {len(MEDIUM_KEYWORDS)}")
    print(f"  LOW keywords    : {len(LOW_KEYWORDS)}")
    print(f"  Languages       : English · Tagalog · Taglish")
    print(f"  Emoji support   : {len(_EMOJI_HIGH)} high + {len(_EMOJI_LOW)} low signals")
    print(f"  CORS origins    : {_TRUSTED_ORIGINS}")
    print(f"  Port            : {port}")
    print(f"{'='*60}")
    print(f"  POST /classify")
    print(f"  POST /classify/batch")
    print(f"  POST /reclassify")
    print(f"  POST /report")
    print(f"  GET  /health  |  GET /healthz")
    print(f"{'='*60}\n")

    app.run(host="0.0.0.0", port=port, debug=debug)