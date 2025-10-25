# src/routers/grid.py
from fastapi import APIRouter, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Any, Dict, List, Optional, Set

from src.database import ModelSession

router = APIRouter(prefix="/grid", tags=["grid"])

def parse_bool(val: Optional[str], default: bool = False) -> bool:
    if val is None:
        return default
    v = str(val).strip().lower()
    return v in ("1", "true", "yes", "y", "on")

@router.get("")
def grid(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=50),

    q: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    appliance_type: Optional[str] = Query(None),
    part_type: Optional[str] = Query(None),

    in_stock_only: Optional[str] = Query(None),

    # CHANGED DEFAULT: include_refurb defaults to True now
    include_refurb: Optional[str] = Query("true"),

    sort: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Unified grid:
      - Up to 3 refurbished hits first (if allowed)
      - Then OEM/new parts list
      - Facets reflect total OEM/new availability for current filters
    """

    db: Session = ModelSession()

    only_stock = parse_bool(in_stock_only, default=False)
    allow_refurb = parse_bool(include_refurb, default=True)

    # -------------------------
    # WHERE clauses + params (shared)
    # -------------------------
    where_clauses: List[str] = []
    params: Dict[str, Any] = {}

    # search text
    if q:
        where_clauses.append("""
            (
                p.mpn_normalized ILIKE :q_like
                OR p.mpn ILIKE :q_like
                OR p.name ILIKE :q_like
            )
        """)
        params["q_like"] = f"%{q.strip()}%"

    # filters
    if brand:
        where_clauses.append("p.brand ILIKE :brand_exact")
        params["brand_exact"] = brand.strip()

    if appliance_type:
        where_clauses.append("p.appliance_type ILIKE :appl_exact")
        params["appl_exact"] = appliance_type.strip()

    if part_type:
        where_clauses.append("p.part_type ILIKE :part_exact")
        params["part_exact"] = part_type.strip()

    # stock gating
    if only_stock:
        where_clauses.append("""
            (
                lower(coalesce(p.stock_status,'')) ~ 'in\\s*stock'
                OR lower(coalesce(p.stock_status,'')) ~ 'special'
                OR lower(coalesce(p.stock_status,'')) ~ 'avail'
            )
        """)

    # require price
    where_clauses.append("p.price IS NOT NULL")
    where_clauses.append("COALESCE(p.price,0) > 0")

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    # -------------------------
    # ORDERING for OEM/new parts
    # -------------------------
    order_sql = """
        ORDER BY
            CASE
                WHEN lower(coalesce(p.stock_status,'')) ~ 'in\\s*stock' THEN 0
                WHEN lower(coalesce(p.stock_status,'')) ~ 'special'    THEN 1
                WHEN lower(coalesce(p.stock_status,'')) ~ 'avail'      THEN 2
                ELSE 9
            END,
            p.price ASC NULLS LAST
    """

    offset = (page - 1) * per_page
    params["limit"] = per_page
    params["offset"] = offset

    # ==========================================================
    # 1. REFURB BLOCK (offers table)
    # ==========================================================
    refurb_items: List[Dict[str, Any]] = []
    refurb_mpns: Set[str] = set()

    if allow_refurb:
        # We assume `offers` has similar columns, maybe different names.
        # We'll alias them to match what front end expects.
        refurb_where_clauses: List[str] = []
        refurb_params = {}

        # NOTE: we basically re-run the same logic but prefix table as o.
        if q:
            refurb_where_clauses.append("""
                (
                    o.mpn_normalized ILIKE :q_like
                    OR o.mpn ILIKE :q_like
                    OR o.title ILIKE :q_like
                )
            """)
            refurb_params["q_like"] = params["q_like"]

        if brand:
            refurb_where_clauses.append("o.brand ILIKE :brand_exact")
            refurb_params["brand_exact"] = params["brand_exact"]

        if appliance_type:
            refurb_where_clauses.append("o.appliance_type ILIKE :appl_exact")
            refurb_params["appl_exact"] = params["appl_exact"]

        if part_type:
            refurb_where_clauses.append("o.part_type ILIKE :part_exact")
            refurb_params["part_exact"] = params["part_exact"]

        if only_stock:
            refurb_where_clauses.append("""
                (
                    lower(coalesce(o.stock_status,'')) ~ 'in\\s*stock'
                    OR lower(coalesce(o.stock_status,'')) ~ 'special'
                    OR lower(coalesce(o.stock_status,'')) ~ 'avail'
                )
            """)

        refurb_where_clauses.append("o.price IS NOT NULL")
        refurb_where_clauses.append("COALESCE(o.price,0) > 0")

        refurb_where_sql = (
            "WHERE " + " AND ".join(refurb_where_clauses)
            if refurb_where_clauses else ""
        )

        # For refurb we don't paginate; we just want the best 3.
        # Force refurb to the FRONT by ordering:
        #   1. in stock first
        #   2. cheapest first
        refurb_sql = text(f"""
            SELECT
                o.mpn_normalized        AS mpn_normalized,
                o.mpn                   AS mpn,
                o.title                 AS title,
                o.image_url             AS image_url,
                o.brand                 AS brand,
                o.appliance_type        AS appliance_type,
                o.part_type             AS part_type,
                o.price                 AS price,
                o.stock_status          AS stock_status
            FROM offers o
            {refurb_where_sql}
            ORDER BY
                CASE
                    WHEN lower(coalesce(o.stock_status,'')) ~ 'in\\s*stock' THEN 0
                    WHEN lower(coalesce(o.stock_status,'')) ~ 'special'    THEN 1
                    WHEN lower(coalesce(o.stock_status,'')) ~ 'avail'      THEN 2
                    ELSE 9
                END,
                o.price ASC NULLS LAST
            LIMIT 3
        """)

        refurb_rows = db.execute(refurb_sql, refurb_params).mappings().all()
        refurb_items = [dict(r) for r in refurb_rows]

        # track refurb mpns so we don't duplicate them in OEM list
        for r in refurb_items:
            m = (r.get("mpn_normalized") or r.get("mpn") or "").strip()
            if m:
                refurb_mpns.add(m.lower())

    # ==========================================================
    # 2. OEM/NEW BLOCK (parts table)
    # ==========================================================
    # Exclude any MPNs we already surfaced as refurb.
    # We do that by extending WHERE with a NOT IN if refurb_mpns exists.
    oem_extra_notin = ""
    if refurb_mpns:
        # build a list like (:dedup0, :dedup1, ...)
        dedup_params = {}
        dedup_placeholders = []
        for i, val in enumerate(refurb_mpns):
            key = f"dedup_{i}"
            dedup_params[key] = val
            dedup_placeholders.append(f":{key}")

        oem_extra_notin = (
            " AND lower(COALESCE(p.mpn_normalized,p.mpn,'')) NOT IN (" +
            ", ".join(dedup_placeholders) +
            ")"
        )
        params.update(dedup_params)

    items_sql = text(f"""
        SELECT
            p.mpn_normalized                AS mpn_normalized,
            p.mpn                           AS mpn,
            p.name                          AS title,
            p.image_url                     AS image_url,
            p.brand                         AS brand,
            p.appliance_type                AS appliance_type,
            p.part_type                     AS part_type,
            p.price                         AS price,
            p.stock_status                  AS stock_status
        FROM parts p
        {where_sql}
        {oem_extra_notin}
        {order_sql}
        LIMIT :limit OFFSET :offset
    """)

    oem_rows_raw = db.execute(items_sql, params).mappings().all()
    oem_items = [dict(r) for r in oem_rows_raw]

    # ==========================================================
    # 3. Fallback (if literally nothing at all)
    # ==========================================================
    combined_items = refurb_items + oem_items

    if len(combined_items) == 0:
        fallback_sql = text("""
            SELECT
                p.mpn_normalized        AS mpn_normalized,
                p.mpn                   AS mpn,
                p.name                  AS title,
                p.image_url             AS image_url,
                p.brand                 AS brand,
                p.appliance_type        AS appliance_type,
                p.part_type             AS part_type,
                p.price                 AS price,
                p.stock_status          AS stock_status
            FROM parts p
            WHERE
                p.price IS NOT NULL
                AND COALESCE(p.price,0) > 0
            ORDER BY
                p.price ASC NULLS LAST
            LIMIT 30
        """)
        fb_rows = db.execute(fallback_sql).mappings().all()
        combined_items = [dict(r) for r in fb_rows]

    # ==========================================================
    # 4. FACETS (GLOBAL OEM COUNTS for filters)
    # ==========================================================
    counts_sql = text(f"""
        WITH filtered AS (
            SELECT
                p.brand,
                p.appliance_type,
                p.part_type
            FROM parts p
            {where_sql}
        )
        SELECT
            'brand'          AS facet_type,
            COALESCE(brand,'') AS facet_value,
            COUNT(*)         AS facet_count
        FROM filtered
        GROUP BY COALESCE(brand,'')
        UNION ALL
        SELECT
            'appliance'      AS facet_type,
            COALESCE(appliance_type,'') AS facet_value,
            COUNT(*)         AS facet_count
        FROM filtered
        GROUP BY COALESCE(appliance_type,'')
        UNION ALL
        SELECT
            'part'           AS facet_type,
            COALESCE(part_type,'') AS facet_value,
            COUNT(*)         AS facet_count
        FROM filtered
        GROUP BY COALESCE(part_type,'')
    """)

    counts_rows = db.execute(counts_sql, params).mappings().all()

    brand_counts: Dict[str, int] = {}
    appl_counts: Dict[str, int] = {}
    part_counts: Dict[str, int] = {}

    for r in counts_rows:
        facet_type = r["facet_type"]
        val = (r["facet_value"] or "").strip()
        ct = int(r["facet_count"] or 0)
        if not val:
            continue
        if facet_type == "brand":
            brand_counts[val] = ct
        elif facet_type == "appliance":
            appl_counts[val] = ct
        elif facet_type == "part":
            part_counts[val] = ct

    def bucketize(d: Dict[str, int]) -> List[Dict[str, Any]]:
        return [
            {"value": k, "count": v}
            for k, v in sorted(
                d.items(),
                key=lambda kv: (-kv[1], kv[0].lower())
            )
        ]

    facets = {
        "brands": bucketize(brand_counts),
        "appliances": bucketize(appl_counts),
        "parts": bucketize(part_counts),
    }

    return {
        "items": combined_items,
        "facets": facets,
    }
