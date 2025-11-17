# src/routers/suggest_models.py
from fastapi import APIRouter, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from sqlalchemy.exc import OperationalError
from typing import Dict, List, Optional, Any
from contextlib import contextmanager
import re, time, traceback

from src.database import ModelSession
from src.models import Model, Part, ModelPartLinks, BrandLogo  # Part / ModelPartLinks unused for now

router = APIRouter()

# ───────────────────────────────────────────────────────────────────────────────
# Brand / Appliance vocab
# ───────────────────────────────────────────────────────────────────────────────

APPLIANCE_SYNONYMS: Dict[str, List[str]] = {
    "Washer": [
        "washer",
        "washing machine",
        "laundry center",
        "combo washer dryer",
        "wash machine",
    ],
    "Dryer": ["dryer", "tumble dryer"],
    "Refrigerator": ["refrigerator", "fridge", "mini fridge"],
    "Freezer": ["freezer", "chest freezer", "upright freezer"],
    "Range": ["range", "range oven", "stove"],
    "Oven": ["oven", "wall oven", "double oven", "single oven"],
    "Microwave": ["microwave"],
    "Cooktop": ["cooktop", "cook top"],
    "Dishwasher": ["dishwasher"],
    "Ice Maker": ["ice maker", "icemaker"],
    "Wine Cooler": ["wine cooler"],
    "Air Conditioner": ["air conditioner", "ac", "a/c"],
    "Grill": ["grill", "bbq"],
    "Kegerator": ["kegerator"],
}

BRANDS: List[str] = [
    "A.O. Smith HVAC",
    "Accelerated Cooking Products",
    "Admiral",
    "Airsled",
    "Amana",
    "American Metal Filter",
    "American Vulkan Lokring",
    "Avanti",
    "Beckett Igniter",
    "Bertazzoni",
    "Blomberg",
    "Blue Star",
    "Bosch",
    "Broan",
    "Brown Stove",
    "Brushtech Brushes",
    "C&D Valves",
    "Cadet Manufacturing",
    "Café",
    "Camco",
    "Carrier",
    "Century",
    "Chromalox Heating",
    "Comfort-Aire",
    "Crestek Cleaning Center",
    "Crosley",
    "Custom Leather Craft Bags",
    "Dacor",
    "Danby",
    "Deflecto",
    "Dormont",
    "Dundas Jafine",
    "Dutro",
    "ESD Coin Box",
    "Electrolux",
    "Estate",
    "Exact Replacement",
    "Ez-Flo",
    "Fasco",
    "Feit Electric",
    "Fisher & Paykel",
    "Frigidaire",
    "GE",
    "Gaggenau",
    "Gibson",
    "Goodman Replacement",
    "Gorilla Glue",
    "Greenwald",
    "Haier",
    "Honeywell",
    "Hotpoint",
    "Huebsch",
    "HydroBalance",
    "Inglis",
    "International Restaurant Supply",
    "Ipso",
    "insignia",
    "Jason Industrial",
    "Jenn-Air",
    "John Guest Fittings",
    "Kelvinator",
    "Kenmore",
    "KitchenAid",
    "Klein Tools",
    "LG",
    "Lennox",
    "MARS",
    "Magic Chef",
    "Marvel",
    "Mastercool",
    "Maytag",
    "Menumaster",
    "Miele",
    "Modern Home Products",
    "Monogram",
    "Monti",
    "Music City Metals Gas Grills",
    "Norge",
    "Nu-Calgon",
    "Nutone",
    "Packard",
    "Panasonic",
    "Peerless",
    "Performance Tool",
    "Primus",
    "RCA",
    "Repco",
    "Resideo Replacement",
    "Rheem",
    "Rinnai",
    "Ritchie Yellow Jacket",
    "Robertshaw",
    "Roper",
    "Samsung",
    "Scotsman Ice",
    "Sensible Products",
    "Speed Queen",
    "Sprayway Glass",
    "Summit Brands",
    "Supco",
    "Tappan",
    "Thermador",
    "Trane",
    "U-Line",
    "UEI Test Instruments",
    "UniMac",
    "USD Products",
    "Vapco",
    "Weber",
    "Westinghouse",
    "Whirlpool",
    "White Rodgers",
    "Williams Furnace",
    "Yeats",
    "York",
]

_APPLIANCE_KEYWORDS = {
    synonym.lower()
    for canon, synonyms in APPLIANCE_SYNONYMS.items()
    for synonym in [canon] + list(synonyms)
}
_BRAND_KEYWORDS = {b.lower() for b in BRANDS}


def _normalize_q(s: str) -> str:
    return (s or "").strip().lower()


def _is_brand_word(q: str) -> bool:
    return _normalize_q(q) in _BRAND_KEYWORDS


def _is_appliance_word(q: str) -> bool:
    return _normalize_q(q) in _APPLIANCE_KEYWORDS


def _looks_like_modelish(q: str) -> bool:
    """
    Treat as *model-ish* when:
      - at least 2 normalized chars
      - not exactly a known brand or appliance keyword.

    We deliberately do NOT require a digit here, so prefixes like "wrx"
    count as model-ish and go down the model path instead of brand browse.
    """
    if not q:
        return False
    qn = re.sub(r"[^a-z0-9]", "", q.strip().lower())
    if len(qn) < 2:
        return False
    if _is_brand_word(q) or _is_appliance_word(q):
        return False
    return True


# ───────────────────────────────────────────────────────────────────────────────
# Timing + vocab state
# ───────────────────────────────────────────────────────────────────────────────

@contextmanager
def _stage(timer_dict: dict, key: str):
    t0 = time.perf_counter()
    try:
        yield
    finally:
        timer_dict[key] = timer_dict.get(key, 0.0) + (
            time.perf_counter() - t0
        ) * 1000.0  # ms


CANDIDATE_CAP = 200       # max models to consider in slow path
FAST_CANDIDATE_CAP = 60   # max models in fast path
MIN_PREFIX_LEN = 2        # block single-char brandless search
VOCAB_TTL_SEC = 3600.0    # 1 hour

_BRAND_SET: set = set()
_BRAND_DISPLAY: Dict[str, str] = {}
_TYPE_SET: set = set()
_VOCAB_LOADED_AT = 0.0


def _fmt_brand_label(b: str) -> str:
    v = (b or "").strip()
    if v.lower() in {"ge", "lg", "3m"}:
        return v.upper()
    return " ".join(w.capitalize() for w in v.split())


def _fmt_type_label(t: str) -> str:
    v = (t or "").strip().lower()
    return "-".join(piece.capitalize() for piece in v.split("-"))


def _load_vocab(db: Session):
    """
    Build simple vocab for sidebar links:
      - brands from BrandLogo or Model.brand
      - appliance types from Model.appliance_type
    """
    global _BRAND_SET, _BRAND_DISPLAY, _TYPE_SET, _VOCAB_LOADED_AT
    now = time.time()
    if now - _VOCAB_LOADED_AT < VOCAB_TTL_SEC and _BRAND_SET and _TYPE_SET:
        return

    _BRAND_SET = set()
    _BRAND_DISPLAY = {}

    # Prefer BrandLogo as source of canonical brand spellings
    try:
        rows = db.query(BrandLogo).all()
        for row in rows:
            b = (row.brand or "").strip()
            if not b:
                continue
            key = b.lower()
            _BRAND_SET.add(key)
            _BRAND_DISPLAY[key] = b
    except Exception:
        pass

    # Fallback: discover brands from Model.brand
    if not _BRAND_SET:
        discovered = {
            (b[0] or "").strip().lower()
            for b in (
                db.query(Model.brand)
                .filter(Model.brand.isnot(None))
                .distinct()
                .all()
            )
            if (b[0] or "").strip()
        }
        _BRAND_SET |= discovered
        for b in discovered:
            _BRAND_DISPLAY.setdefault(b, _fmt_brand_label(b))

    # Appliance types from Model.appliance_type
    _TYPE_SET = {
        (t[0] or "").strip().lower()
        for t in (
            db.query(Model.appliance_type)
            .filter(Model.appliance_type.isnot(None))
            .distinct()
            .all()
        )
        if (t[0] or "").strip()
    }

    _VOCAB_LOADED_AT = now


# ───────────────────────────────────────────────────────────────────────────────
# FAST PATH: search-bar model suggest (include_counts = false)
# ───────────────────────────────────────────────────────────────────────────────

def _fast_model_suggest(
    db: Session,
    raw_q: str,
    effective_brand: str,
    effective_type: str,
    wanted: int,
    with_counts: bool,  # kept for compatibility; not used
) -> Dict[str, Any]:
    """
    Fast path for model-bar / search-bar when include_counts = false.

    TEMP SIMPLE VERSION:

      * ONLY queries the `models` table (+ BrandLogo for logos)
      * Does NOT touch `model_part_links` or `parts`
      * Returns total_parts = 0, priced_parts = 0, refurb_count = 0

    This keeps searchbars fast even for popular prefixes like "WRX".
    """

    t0 = time.perf_counter()

    like_val = (raw_q or "").strip().lower() + "%"
    cand_limit = min(max(wanted * 3, wanted), FAST_CANDIDATE_CAP)

    # candidate models (lightweight fields)
    q_models = db.query(
        Model.model_number,
        Model.brand,
        Model.appliance_type,
    )

    if effective_brand:
        q_models = q_models.filter(
            func.lower(func.btrim(Model.brand)) == effective_brand.strip().lower()
        )

    if effective_type:
        q_models = q_models.filter(
            func.lower(func.btrim(Model.appliance_type))
            == effective_type.strip().lower()
        )

    q_models = (
        q_models.filter(func.lower(Model.model_number).like(like_val))
        .order_by(
            func.lower(Model.brand),
            func.lower(Model.model_number),
        )
        .limit(cand_limit)
    )

    rows = q_models.all()

    if not rows:
        total_ms = (time.perf_counter() - t0) * 1000.0
        return {
            "with_priced_parts": [],
            "without_priced_parts": [],
            "total_models": 0,
            "metrics": {
                "elapsed_ms": int(total_ms),
                "timing": {"fast_path": round(total_ms, 1)},
            },
            "refurb_only_models": [],
        }

    # load brand logos just for brands in this batch
    brands_in_batch = {
        (r.brand or "").strip().lower()
        for r in rows
        if r.brand
    }

    brand_logo_map: Dict[str, str] = {}
    if brands_in_batch:
        logo_rows = (
            db.query(BrandLogo)
            .filter(func.lower(func.btrim(BrandLogo.brand)).in_(brands_in_batch))
            .all()
        )
        for lr in logo_rows:
            key = (lr.brand or "").strip().lower()
            if key and lr.image_url:
                brand_logo_map[key] = lr.image_url

    # Cheap model count for header (models table only)
    count_q = db.query(func.count()).select_from(Model)
    count_q = count_q.filter(func.lower(Model.model_number).like(like_val))
    if effective_brand:
        count_q = count_q.filter(
            func.lower(func.btrim(Model.brand)) == effective_brand.strip().lower()
        )
    if effective_type:
        count_q = count_q.filter(
            func.lower(func.btrim(Model.appliance_type))
            == effective_type.strip().lower()
        )
    total_models = int(count_q.scalar() or 0)

    # Build items WITHOUT any part counts
    items: List[dict] = []
    for r in rows:
        items.append(
            {
                "model_number": r.model_number,
                "brand": r.brand,
                "appliance_type": r.appliance_type,
                "total_parts": 0,
                "priced_parts": 0,
                "refurb_count": 0,
                "brand_logo_url": brand_logo_map.get(
                    (r.brand or "").strip().lower()
                ),
            }
        )

    # Simple stable sort: brand + model
    items.sort(
        key=lambda x: (
            (x["brand"] or "").lower(),
            (x["model_number"] or "").lower(),
        )
    )

    out_with = items[:wanted]
    out_without: List[dict] = []

    total_ms = (time.perf_counter() - t0) * 1000.0
    return {
        "with_priced_parts": out_with,
        "without_priced_parts": out_without,
        "total_models": total_models,
        "metrics": {
            "elapsed_ms": int(total_ms),
            "timing": {"fast_path": round(total_ms, 1)},
        },
        "refurb_only_models": [],
    }


# ───────────────────────────────────────────────────────────────────────────────
# Endpoint
# ───────────────────────────────────────────────────────────────────────────────

@router.get("/suggest")
def suggest_models(
    q: Optional[str] = Query(None),
    limit: int = Query(15, ge=1, le=200),
    brand: Optional[str] = Query(None),
    appliance_type: Optional[str] = Query(None),
    part_type: Optional[str] = Query(None),       # kept for future use
    include_counts: bool = Query(True),           # when false: FAST path (search bar)
    src: Optional[str] = Query(None),             # optional hint: "modelbar", "grid_sidebar", etc.
    response: Response = None,
):
    """
    Normalization-free suggest endpoint.

    Uses brand/appliance vocab to distinguish:
      * model-ish q (>=2 chars, not a brand word / appliance word) → model search
      * brand / appliance words → browse mode

    For now, we DO NOT compute part-based counts at all; those are handled
    by the model / parts endpoints on the model page.
    """
    t_all0 = time.perf_counter()
    t: Dict[str, float] = {}
    db: Session = ModelSession()

    try:
        # ── parse / classify
        with _stage(t, "parse"):
            raw_q = (q or "").strip()
            raw_brand_param = (brand or "").strip()
            raw_type_param = (appliance_type or "").strip()
            wanted = max(1, min(int(limit or 15), 30))

            q_norm = re.sub(r"[^a-z0-9]", "", raw_q.lower())
            q_norm_len = len(q_norm)

            is_modelish = _looks_like_modelish(raw_q) if raw_q else False
            is_brand_word = _is_brand_word(raw_q) if raw_q else False
            is_type_word = _is_appliance_word(raw_q) if raw_q else False

            # infer brand/type from q when q is a pure brand / type word
            effective_brand = raw_brand_param or (raw_q if is_brand_word else "")
            effective_type = raw_type_param or (raw_q if is_type_word else "")

            is_brand_only_browse = bool(
                effective_brand and not raw_q and not effective_type
            )

            print(
                f"[SUGGEST PERF] START q={raw_q!r} brand_param={raw_brand_param!r} "
                f"type_param={raw_type_param!r} eff_brand={effective_brand!r} "
                f"eff_type={effective_type!r} is_modelish={is_modelish} "
                f"is_brand_only_browse={is_brand_only_browse} "
                f"limit={wanted} include_counts={include_counts} src={src!r}"
            )

            # Nothing specified → nothing to suggest
            if not raw_q and not effective_brand and not effective_type:
                total_ms = (time.perf_counter() - t_all0) * 1000.0
                print(
                    f"[SUGGEST PERF] EARLY_RETURN empty filters "
                    f"total_ms={total_ms:.1f}ms"
                )
                if response is not None:
                    response.headers["Server-Timing"] = (
                        f"total;dur={total_ms:.1f}"
                    )
                return {
                    "with_priced_parts": [],
                    "without_priced_parts": [],
                    "total_models": 0,
                    "metrics": {"elapsed_ms": int(total_ms)},
                    "refurb_only_models": [],
                    "sidebar_links": {"brands": [], "appliance_types": []},
                }

        # ── vocab + sidebar links (skip for model-ish)
        sidebar_links = {"brands": [], "appliance_types": []}
        if raw_q and not is_modelish:
            with _stage(t, "vocab"):
                _load_vocab(db)

            q_lc = raw_q.lower()
            if q_lc:
                brands = sorted([b for b in _BRAND_SET if b.startswith(q_lc)])[:8]
                sidebar_links["brands"] = [
                    {
                        "label": _BRAND_DISPLAY.get(b, _fmt_brand_label(b)),
                        "href": f"/grid?brand={b}",
                        "type": "brand",
                        "value": b,
                    }
                    for b in brands
                ]
                ats = sorted([tt for tt in _TYPE_SET if tt.startswith(q_lc)])[:8]
                sidebar_links["appliance_types"] = [
                    {
                        "label": _fmt_type_label(tt),
                        "href": f"/grid?appliance_type={tt}",
                        "type": "appliance_type",
                        "value": tt,
                    }
                    for tt in ats
                ]

        # guard: forbid 1-char brandless global prefix (but allow model-ish)
        if (
            not effective_brand
            and raw_q
            and not is_modelish
            and len(re.sub(r"\s+", "", raw_q)) < MIN_PREFIX_LEN
        ):
            total_ms = (time.perf_counter() - t_all0) * 1000.0
            print(
                f"[SUGGEST PERF] EARLY_RETURN short_prefix q={raw_q!r} "
                f"total_ms={total_ms:.1f}ms"
            )
            if response is not None:
                response.headers["Server-Timing"] = (
                    f"total;dur={total_ms:.1f}"
                )
            return {
                "with_priced_parts": [],
                "without_priced_parts": [],
                "total_models": 0,
                "metrics": {"elapsed_ms": int(total_ms)},
                "refurb_only_models": [],
                "sidebar_links": sidebar_links,
            }

        # ── FAST PATH: search-bar style (include_counts = False AND model-ish query)
        if not include_counts and raw_q and is_modelish and q_norm_len >= 2:
            with_counts_fast = False  # we are not computing part counts at all
            try:
                fast_result = _fast_model_suggest(
                    db=db,
                    raw_q=raw_q,
                    effective_brand=effective_brand,
                    effective_type=effective_type,
                    wanted=wanted,
                    with_counts=with_counts_fast,
                )
                total_ms = fast_result["metrics"]["elapsed_ms"]
                print(
                    f"[SUGGEST PERF] FAST_PATH q={raw_q!r} eff_brand={effective_brand!r} "
                    f"eff_type={effective_type!r} q_norm_len={q_norm_len} "
                    f"with_counts={with_counts_fast} total_ms={total_ms}ms "
                    f"with_priced={len(fast_result['with_priced_parts'])} "
                    f"without_priced={len(fast_result['without_priced_parts'])}"
                )
                if response is not None:
                    response.headers["Server-Timing"] = (
                        f"fast_path;dur={total_ms:.1f}, total;dur={total_ms:.1f}"
                    )
                fast_result["sidebar_links"] = sidebar_links
                return fast_result
            except OperationalError:
                traceback.print_exc()
                print("[SUGGEST PERF] FAST_PATH ERROR – falling back to normal path")

        # ────────────────────────────────────────────────────────────
        # SLOW PATH (include_counts=True or non-modelish)
        # still only hits Model + BrandLogo, no parts counts
        # ────────────────────────────────────────────────────────────

        # ── candidate harvest
        with _stage(t, "candidates"):
            q_models = db.query(
                Model.model_number,
                Model.brand,
                Model.appliance_type,
            )

            if effective_brand:
                q_models = q_models.filter(
                    func.lower(func.btrim(Model.brand)) == effective_brand.lower()
                )

            if effective_type:
                q_models = q_models.filter(
                    func.lower(func.btrim(Model.appliance_type))
                    == effective_type.lower()
                )

            if raw_q:
                like_val = raw_q.lower() + "%"
                q_models = q_models.filter(
                    func.lower(Model.model_number).like(like_val)
                )

            rows = (
                q_models.order_by(
                    func.lower(Model.brand),
                    func.lower(Model.model_number),
                )
                .limit(CANDIDATE_CAP)
                .all()
            )

            candidates: List[dict] = [
                {
                    "model_number": m.model_number,
                    "brand": m.brand,
                    "appliance_type": m.appliance_type,
                }
                for m in rows
            ]

        print(
            f"[SUGGEST PERF] candidates count={len(candidates)} "
            f"candidates_ms={t.get('candidates', 0):.1f}ms "
            f"eff_brand={effective_brand!r} eff_type={effective_type!r} q={raw_q!r}"
        )

        # early out if no candidates
        if not candidates:
            total_ms = (time.perf_counter() - t_all0) * 1000.0
            print(
                f"[SUGGEST PERF] EARLY_RETURN no_candidates q={raw_q!r} "
                f"total_ms={total_ms:.1f}ms timings="
                f"{ {kk: round(v,1) for kk,v in t.items()} }"
            )
            if response is not None:
                response.headers["Server-Timing"] = (
                    f"candidates;dur={t.get('candidates',0):.1f},"
                    f"total;dur={total_ms:.1f}"
                )
            return {
                "with_priced_parts": [],
                "without_priced_parts": [],
                "total_models": 0,
                "metrics": {
                    "elapsed_ms": int(total_ms),
                    "timing": {kk: round(v, 1) for kk, v in t.items()},
                },
                "refurb_only_models": [],
                "sidebar_links": sidebar_links,
            }

        # ── totals: cheap count on models only
        with _stage(t, "totals"):
            q_count = db.query(func.count()).select_from(Model)
            if effective_brand:
                q_count = q_count.filter(
                    func.lower(func.btrim(Model.brand)) == effective_brand.lower()
                )
            if effective_type:
                q_count = q_count.filter(
                    func.lower(func.btrim(Model.appliance_type))
                    == effective_type.lower()
                )
            if raw_q:
                like_val = raw_q.lower() + "%"
                q_count = q_count.filter(
                    func.lower(Model.model_number).like(like_val)
                )
            total_models = int(q_count.scalar() or 0)

        # ── assemble (no part counts)
        with _stage(t, "assemble"):
            wanted_slice = min(len(candidates), max(wanted * 2, wanted))
            slice_candidates = candidates[:wanted_slice]

            brands_in_batch = {
                (c["brand"] or "").strip().lower()
                for c in slice_candidates
                if c.get("brand")
            }

            brand_logo_map: Dict[str, str] = {}
            if brands_in_batch:
                logo_rows = (
                    db.query(BrandLogo)
                    .filter(
                        func.lower(func.btrim(BrandLogo.brand)).in_(brands_in_batch)
                    )
                    .all()
                )
                for lr in logo_rows:
                    key = (lr.brand or "").strip().lower()
                    if key and lr.image_url:
                        brand_logo_map[key] = lr.image_url

            items: List[dict] = []
            for c in slice_candidates:
                mn = c["model_number"]
                items.append(
                    {
                        "model_number": mn,
                        "brand": c["brand"],
                        "appliance_type": c["appliance_type"],
                        "total_parts": 0,
                        "priced_parts": 0,
                        "refurb_count": 0,
                        "brand_logo_url": brand_logo_map.get(
                            (c["brand"] or "").strip().lower()
                        ),
                    }
                )

        # ── rank + split (everyone in with_priced_parts for now)
        with _stage(t, "rank_split"):
            items.sort(
                key=lambda x: (
                    (x["brand"] or "").lower(),
                    (x["model_number"] or "").lower(),
                )
            )

            with_priced_parts: List[dict] = items[:wanted]
            without_priced_parts: List[dict] = []

        total_ms = (time.perf_counter() - t_all0) * 1000.0
        breakdown = {kk: round(v, 1) for kk, v in t.items()}

        print(
            f"[SUGGEST PERF] DONE q={raw_q!r} eff_brand={effective_brand!r} "
            f"eff_type={effective_type!r} wanted={wanted} total_models={total_models} "
            f"with_priced={len(with_priced_parts)} without_priced={len(without_priced_parts)} "
            f"total_ms={total_ms:.1f}ms breakdown_ms={breakdown}"
        )

        if response is not None:
            keys = [
                "parse",
                "vocab",
                "candidates",
                "totals",
                "assemble",
                "rank_split",
            ]
            header_parts = [
                f"{k};dur={t.get(k, 0):.1f}"
                for k in keys
                if k in t
            ] + [f"total;dur={total_ms:.1f}"]
            response.headers["Server-Timing"] = "; ".join(header_parts)

        return {
            "with_priced_parts": with_priced_parts,
            "without_priced_parts": without_priced_parts,
            "total_models": int(total_models),
            "metrics": {
                "elapsed_ms": int(total_ms),
                "timing": breakdown,
            },
            "refurb_only_models": [],
            "sidebar_links": sidebar_links,
        }

    except Exception as e:
        traceback.print_exc()
        print(
            f"[SUGGEST PERF] ERROR q={q!r} brand={brand!r} "
            f"type={appliance_type!r} error={e}"
        )
        db.rollback()
        return {
            "with_priced_parts": [],
            "without_priced_parts": [],
            "total_models": 0,
            "refurb_only_models": [],
            "sidebar_links": {"brands": [], "appliance_types": []},
        }
    finally:
        db.close()
