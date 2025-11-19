// src/pages/ModelPage.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import PartImage from "./components/PartImage";

const API_BASE = "https://api.appliancepartgeeks.com";

/* ---------------- helpers ---------------- */
const normalize = (s) =>
  (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

const extractRawMPN = (p) => {
  let mpn =
    p?.mpn ??
    p?.MPN ??
    p?.part_number ??
    p?.partNumber ??
    p?.mpn_raw ??
    p?.listing_mpn ??
    null;
  if (!mpn && p?.reliable_sku) {
    mpn = String(p.reliable_sku).replace(/^[A-Z]{2,}\s+/, "");
  }
  return mpn ? String(mpn).trim() : "";
};

const numericPrice = (p) => {
  const n =
    p?.price_num ??
    p?.price_numeric ??
    (typeof p?.price === "number"
      ? p.price
      : Number(String(p?.price || "").replace(/[^0-9.]/g, "")));
  return Number.isFinite(Number(n)) ? Number(n) : null;
};

const formatPrice = (v, curr = "USD") => {
  const n =
    typeof v === "number"
      ? v
      : v?.price_num ??
        v?.price_numeric ??
        (typeof v?.price === "number"
          ? v.price
          : Number(String(v?.price || "").replace(/[^0-9.]/g, "")));
  if (n == null || Number.isNaN(Number(n))) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (v?.currency || curr || "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(Number(n));
  } catch {
    return "$" + Number(n).toFixed(2);
  }
};

/**
 * Normalize availability into a numeric rank:
 *  1 = in stock
 *  2 = backorder
 *  9 = unavailable
 *
 * This is used for:
 *   - deciding which parts go into Available grid (1 & 2)
 *   - deciding which parts are "Other Known" (NOT 1 & 2)
 *   - driving the stock badge.
 */
const getAvailabilityRank = (input) => {
  if (!input || typeof input !== "object") {
    const s = String(input || "").trim().toLowerCase();
    if (s === "in stock" || s === "available") return 1;
    if (
      s === "out of stock" ||
      s === "backorder" ||
      s === "back order" ||
      s === "back-ordered" ||
      s === "backordered"
    )
      return 2;
    // null / empty / weird ⇒ treat as unavailable
    return 9;
  }

  const explicitRank =
    typeof input.availability_rank === "number"
      ? input.availability_rank
      : null;
  if (explicitRank === 1 || explicitRank === 2 || explicitRank === 9) {
    return explicitRank;
  }

  const rawStatus = input.stock_status;
  const s = String(rawStatus || "").trim().toLowerCase();

  if (s === "in stock" || s === "available") return 1;
  if (
    s === "out of stock" ||
    s === "backorder" ||
    s === "back order" ||
    s === "back-ordered" ||
    s === "backordered"
  )
    return 2;
  // Null + "unavailable" + anything else ⇒ 9
  return 9;
};

/**
 * Stock badge using your mapping:
 *  - 1 → In stock (green)
 *  - 2 → Backorder (red)
 *  - 9 → Unavailable (black)
 */
const stockBadge = (input) => {
  const rank = getAvailabilityRank(input);

  if (rank === 1) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
        In stock
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-red-600 text-white">
        Backorder
      </span>
    );
  }
  return (
    <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">
      Unavailable
    </span>
  );
};

const calcSavings = (newPrice, refurbPrice) => {
  if (newPrice == null || refurbPrice == null) return null;
  const s = Number(newPrice) - Number(refurbPrice);
  return Number.isFinite(s) && s > 0 ? s : null;
};

function getRefurb(obj) {
  return (
    obj?.refurb ||
    (obj?.refurbished ? obj.refurbished : null) ||
    (obj?.offers && obj.offers.refurb) ||
    null
  );
}
function getNew(obj) {
  return obj?.reliable || obj?.new || (obj?.offers && obj.offers.new) || null;
}

/* ---------------- main ---------------- */
const ModelPage = () => {
  const [searchParams] = useSearchParams();
  const modelNumber = searchParams.get("model") || "";
  const refurbMode = searchParams.get("refurb") === "1";
  const DEBUG = searchParams.get("debug") === "1";

  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], all: [] });
  const [brandLogos, setBrandLogos] = useState([]);
  const [error, setError] = useState(null);

  // bulk compare (normal mode, NEW+REFURB)
  // bulk: { [normMpn]: { refurb: bestOfferForThatMpn } }
  const [bulk, setBulk] = useState({});
  const [bulkReady, setBulkReady] = useState(false);
  const [bulkError, setBulkError] = useState(null);

  // refurb-only items (refurb mode)
  const [refurbItems, setRefurbItems] = useState([]);
  const [refurbLoading, setRefurbLoading] = useState(false);
  const [refurbError, setRefurbError] = useState("");

  // summary count of refurbs for this model (unique MPNs)
  const [refurbSummaryCount, setRefurbSummaryCount] = useState(null);
  const [refurbSummaryLoading, setRefurbSummaryLoading] = useState(false);
  const [refurbSummaryError, setRefurbSummaryError] = useState("");

  const availRootRef = useRef(null);
  const knownRootRef = useRef(null);

  // guards
  const lastModelRef = useRef(null);
  const didFetchLogosRef = useRef(false);

  /* ---- brand logos: fetch once ---- */
  useEffect(() => {
    if (didFetchLogosRef.current) return;
    didFetchLogosRef.current = true;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/brand-logos`);
        const data = await res.json();
        setBrandLogos(Array.isArray(data) ? data : data?.logos || []);
      } catch (err) {
        console.error("❌ Error fetching brand logos:", err);
      }
    })();
  }, []);

  /* ---- model + parts / refurb data ---- */
  useEffect(() => {
    if (!modelNumber) return;

    // prevent duplicate fetches for same model + mode
    const comboKey = `${modelNumber}::${refurbMode ? "refurb" : "normal"}`;
    if (lastModelRef.current === comboKey) return;
    lastModelRef.current = comboKey;

    const fetchModel = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/models/search?q=${encodeURIComponent(modelNumber)}`
        );
        const data = await res.json();
        setModel(data && data.model_number ? data : null);
      } catch (err) {
        console.error("❌ Error loading model data:", err);
        setError("Error loading model data.");
      }
    };

    const fetchParts = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/parts/for-model/${encodeURIComponent(modelNumber)}`
        );
        if (!res.ok) throw new Error("Failed to fetch parts");
        const data = await res.json();
        setParts({
          all: Array.isArray(data.all) ? data.all : [],
          priced: Array.isArray(data.priced) ? data.priced : [],
        });
      } catch (err) {
        console.error("❌ Error loading parts:", err);
      }
    };

    setError(null);

    // reset refurb summary + bulk map
    setRefurbSummaryCount(null);
    setRefurbSummaryError("");
    setRefurbSummaryLoading(true);
    setBulk({});
    setBulkReady(false);
    setBulkError(null);

    // ONE call: refurb offers for this model → summary + bulk map
    (async () => {
      try {
        const url = `${API_BASE}/api/refurb/for-model/${encodeURIComponent(
          modelNumber
        )}?limit=200`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const offers = Array.isArray(data?.offers) ? data.offers : [];

          // UNIQUE MPNs ONLY for summary
          const mpnSet = new Set();
          const byNorm = {};

          for (const o of offers) {
            const normKey = normalize(
              o.mpn || o.mpn_normalized || o.mpn_coalesced || ""
            );
            if (!normKey) continue;

            mpnSet.add(normKey);

            const price = numericPrice(o);
            const existing = byNorm[normKey]?.refurb || null;
            const existingPrice = existing ? numericPrice(existing) : null;

            if (
              !existing ||
              (price != null &&
                (existingPrice == null || price < existingPrice))
            ) {
              byNorm[normKey] = { refurb: o };
            }
          }

          let rawCount = mpnSet.size;

          // fallback to backend count if needed
          if (rawCount === 0 && typeof data?.count === "number") {
            rawCount = data.count;
          }

          setRefurbSummaryCount(rawCount);
          setBulk(byNorm);
          setBulkReady(true);
        } else if (res.status === 404) {
          setRefurbSummaryCount(0);
          setBulk({});
          setBulkReady(true);
        } else {
          setRefurbSummaryError(`HTTP ${res.status}`);
          setBulk({});
          setBulkReady(true);
        }
      } catch (e) {
        setRefurbSummaryError(
          e?.message || "Failed to load refurbished summary."
        );
        setBulkError(e?.message || "Failed to load refurbished offers.");
        setBulk({});
        setBulkReady(true);
      } finally {
        setRefurbSummaryLoading(false);
      }
    })();

    if (refurbMode) {
      // refurb-only mode: use suggest/refurb/search
      (async () => {
        setRefurbItems([]);
        setRefurbLoading(true);
        setRefurbError("");
        try {
          const url = `${API_BASE}/api/suggest/refurb/search?model=${encodeURIComponent(
            modelNumber
          )}&limit=60`;
          const r = await fetch(url);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const data = await r.json();
          const list = Array.isArray(data?.results) ? data.results : [];
          setRefurbItems(list);
        } catch (e) {
          setRefurbError(e?.message || "Failed to load refurbished offers.");
        } finally {
          setRefurbLoading(false);
        }
      })();
    } else {
      // normal mode: fetch parts (refurb data comes from for-model call above)
      fetchParts();
    }

    fetchModel();

    // clear any stray header search input text
    const input = document.querySelector("input[type='text']");
    if (input) input.value = "";
  }, [modelNumber, refurbMode]);

  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const key = normalize(brand);
    const hit = brandLogos.find((b) => normalize(b.name) === key);
    return hit?.image_url || hit?.url || hit?.logo_url || hit?.src || null;
  };

  const allKnownOrdered = useMemo(() => {
    const list = Array.isArray(parts.all) ? [...parts.all] : [];
    list.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    return list;
  }, [parts.all]);

  // sequence by normalized MPN (from ALL rows)
  const sequenceByNorm = useMemo(() => {
    const m = new Map();
    for (const r of allKnownOrdered) {
      const normKey = normalize(extractRawMPN(r));
      if (normKey && r.sequence != null && !m.has(normKey)) {
        m.set(normKey, r.sequence);
      }
    }
    return m;
  }, [allKnownOrdered]);

  // maps by normalized MPN (for NEW + ALL-KNOWN)
  const pricedByNorm = useMemo(() => {
    const m = new Map();
    for (const p of parts.priced || []) {
      const normKey = normalize(extractRawMPN(p));
      if (normKey) m.set(normKey, p);
    }
    return m;
  }, [parts.priced]);

  // build tiles (refurb + available new (rank 1,2)) — normal mode only
  const tiles = useMemo(() => {
    if (refurbMode) return [];
    const out = [];
    for (const p of parts.priced || []) {
      const normKey = normalize(extractRawMPN(p));
      if (!normKey) continue;

      const cmp = bulk[normKey] || null;
      const refurb = getRefurb(cmp);
      const sequence =
        sequenceByNorm.get(normKey) ?? p.sequence ?? null;

      // refurb tile (if any) — ALWAYS part of Available grid
      if (refurb && refurb.price != null) {
        out.push({
          type: "refurb",
          normKey,
          knownName: p.name || null,
          newPart: p,
          cmp,
          sequence,
        });
      }

      // new tile only if availability 1 or 2
      const rank = getAvailabilityRank(p);
      if (rank === 1 || rank === 2) {
        out.push({ type: "new", normKey, newPart: p, cmp, sequence });
      }
    }
    return out;
  }, [parts.priced, bulk, refurbMode, sequenceByNorm]);

  // sort: refurb first by refurb price, then new by new price
  const tilesSorted = useMemo(() => {
    if (refurbMode) return [];
    const refurbPrice = (t) => {
      const v = getRefurb(t.cmp)?.price;
      return v == null ? Infinity : Number(v) || Infinity;
    };
    const newPrice = (t) =>
      t.newPart ? numericPrice(t.newPart) ?? Infinity : Infinity;

    const arr = [...tiles];
    arr.sort((a, b) => {
      if (a.type !== b.type) return a.type === "refurb" ? -1 : 1;
      return a.type === "refurb"
        ? refurbPrice(a) - refurbPrice(b)
        : newPrice(a) - newPrice(b);
    });
    return arr;
  }, [tiles, refurbMode]);

  const refurbCount = useMemo(() => {
    if (refurbMode) {
      return refurbItems.length;
    }
    const seen = new Set();
    for (const t of tiles) {
      if (t.type === "refurb" && t.normKey) {
        seen.add(t.normKey);
      }
    }
    return seen.size;
  }, [tiles, refurbItems, refurbMode]);

  // "Other Known Parts" = known parts whose NEW version is NOT availability 1 or 2
  const otherKnown = useMemo(() => {
    const out = [];
    for (const row of allKnownOrdered) {
      const normKey = normalize(extractRawMPN(row));
      if (!normKey) {
        out.push(row);
        continue;
      }
      const priced = pricedByNorm.get(normKey) || null;
      if (!priced) {
        // no priced row at all ⇒ treat as "other"
        out.push(row);
        continue;
      }
      const rank = getAvailabilityRank(priced);
      if (rank !== 1 && rank !== 2) {
        out.push(row);
      }
    }
    return out;
  }, [allKnownOrdered, pricedByNorm]);

  if (error)
    return (
      <div className="text-red-600 text-center py-6 bg-white">
        {error}
      </div>
    );
  if (!model) return null;

  return (
    <div className="w-full flex justify-center mt-4 mb-12">
      <div className="bg-white text-black shadow-[0_0_20px_rgba(0,0,0,0.4)] rounded-md w-[90%] max-w-[1400px] pb-12 px-4 md:px-6 lg:px-8">
        {/* optional debug strip */}
        {DEBUG ? (
          <div className="mb-2 text-xs rounded bg-yellow-50 border border-yellow-200 p-2 text-yellow-900">
            {refurbMode ? (
              <div>refurb items: {refurbItems.length}</div>
            ) : (
              <>
                <div>
                  bulk refurb rows: {Object.keys(bulk || {}).length} | refurb
                  parts (tiles): {refurbCount}
                </div>
                <div>
                  available tiles (refurb + new rank 1/2):{" "}
                  {tilesSorted.length}
                </div>
                {refurbSummaryError ? (
                  <div className="mt-1 text-red-700">
                    refurb summary error:{" "}
                    <code>{refurbSummaryError}</code>
                  </div>
                ) : null}
                {bulkError ? (
                  <div className="mt-1 text-red-700">
                    bulk error: <code>{bulkError}</code>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {/* Breadcrumb */}
        <div className="w-full border-b border-gray-200 mb-4">
          <nav className="text-sm text-gray-600 py-2 w-full">
            <ul className="flex space-x-2">
              <li>
                <Link to="/" className="hover:underline text-blue-600">
                  Home
                </Link>
                <span className="mx-1 text-gray-500">/</span>
              </li>
              <li className="font-semibold text-black">
                {refurbMode ? (
                  <>Refurbished Parts for {model.model_number}</>
                ) : (
                  <>
                    {model.brand} {model.appliance_type}{" "}
                    {model.model_number}
                  </>
                )}
              </li>
            </ul>
          </nav>
        </div>

        {/* Header section */}
        <div className="border rounded p-2 flex items-center mb-4 gap-3 max-h-[100px] overflow-hidden bg-white text-black">
          <div className="w-1/6 flex items-center justify-center">
            {getBrandLogoUrl(model.brand) ? (
              <img
                src={getBrandLogoUrl(model.brand)}
                alt={`${model.brand} Logo`}
                className="object-contain h-14"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className="text-[10px] text-gray-500">No Logo</span>
            )}
          </div>

          <div className="w-5/6 bg-gray-100 rounded p-2 flex items-center gap-3 overflow-hidden text-black">
            <div className="w-1/3 leading-tight">
              <h2 className="text-sm font-semibold truncate">
                {model.brand} - {model.model_number} -{" "}
                {model.appliance_type}
              </h2>
              <p className="text-[11px] mt-1 text-gray-700">
                {!refurbMode ? (
                  <>
                    Known Parts: {parts.all.length} &nbsp;|&nbsp;
                    Priced Parts: {parts.priced.length} {" | "}
                    <span
                      className="inline-block px-2 py-0.5 rounded bg-gray-900 text-white"
                      title="Number of refurbished parts (unique MPNs) for this model"
                    >
                      Refurbished Parts:{" "}
                      {refurbSummaryLoading
                        ? "…"
                        : refurbSummaryCount != null
                        ? refurbSummaryCount
                        : 0}
                    </span>
                  </>
                ) : (
                  <span
                    className="inline-block px-2 py-0.5 rounded bg-gray-900 text-white"
                    title="Number of refurbished offers for this model"
                  >
                    Refurbished Parts: {refurbCount}
                  </span>
                )}
              </p>
            </div>

            {/* exploded views */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-2">
              {model.exploded_views?.map((v, i) => (
                <div key={i} className="w-24 shrink-0">
                  <div className="border rounded p-1 bg-white">
                    <img
                      src={v.image_url}
                      alt={v.label}
                      className="w-full h-14 object-contain"
                      loading="lazy"
                      decoding="async"
                      onError={(e) =>
                        (e.currentTarget.src = "/no-image.png")
                      }
                    />
                    <p className="text-[10px] text-center mt-1 leading-tight truncate text-black">
                      {v.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        {refurbMode ? (
          <RefurbOnlyGrid
            items={refurbItems}
            modelNumber={model.model_number}
            loading={refurbLoading}
            error={refurbError}
          />
        ) : (
          <div className="flex flex-col md:flex-row gap-6">
            {/* Available Parts */}
            <div className="md:w-3/4">
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-lg font-semibold text-black">
                  Available Parts
                </h3>
                <span className="text-[11px] text-gray-500">
                  Refurbished offers float to the top. New parts shown only if
                  In Stock or Backorder.
                </span>
              </div>

              {!bulkReady ? (
                <p className="text-gray-500">Loading…</p>
              ) : tilesSorted.length === 0 ? (
                <p className="text-gray-500 mb-6">
                  No available parts for this model.
                </p>
              ) : (
                <div
                  ref={availRootRef}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-1"
                >
                  {tilesSorted.map((t) =>
                    t.type === "refurb" ? (
                      <RefurbCard
                        key={`ref-${t.normKey}`}
                        normKey={t.normKey}
                        knownName={t.knownName}
                        cmp={t.cmp}
                        newPart={t.newPart}
                        modelNumber={model.model_number}
                        sequence={t.sequence}
                      />
                    ) : (
                      <NewCard
                        key={`new-${t.normKey}`}
                        normKey={t.normKey}
                        newPart={t.newPart}
                        modelNumber={model.model_number}
                        sequence={t.sequence}
                      />
                    )
                  )}
                </div>
              )}
            </div>

            {/* Other Known Parts (unavailable only) */}
            <div className="md:w-1/4">
              <h3 className="text-lg font-semibold mb-2 text-black">
                Other Known Parts
              </h3>
              {otherKnown.length === 0 ? (
                <p className="text-gray-500">
                  No other known parts for this model.
                </p>
              ) : (
                <div
                  ref={knownRootRef}
                  className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1"
                >
                  {otherKnown.map((p, idx) => (
                    <OtherKnownRow
                      key={`${p.mpn || "row"}-${idx}`}
                      row={p}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------------- refurb-only subgrid ---------------- */

function RefurbOnlyGrid({ items, modelNumber, loading, error }) {
  if (loading)
    return (
      <p className="text-gray-500">Loading refurbished offers…</p>
    );
  if (error) return <p className="text-red-700">{error}</p>;
  if (!items?.length)
    return (
      <p className="text-gray-600">
        No refurbished offers for this model.
      </p>
    );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((o, i) => {
        const img = o.image_url || o.image || "/no-image.png";
        const mpn = o.mpn || o.mpn_normalized || "";
        const offerId = o.listing_id || o.offer_id || "";
        return (
          <Link
            key={`${mpn}-${offerId || i}`}
            to={`/refurb/${encodeURIComponent(
              mpn || o.mpn_normalized || ""
            )}${
              offerId ? `?offer=${encodeURIComponent(offerId)}` : ""
            }`}
            className="rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 transition"
            title={o.title || mpn}
          >
            <div className="flex gap-3">
              <img
                src={img}
                alt={o.title || mpn}
                className="w-16 h-16 object-contain rounded border border-gray-100 bg-white"
                onError={(e) =>
                  (e.currentTarget.src = "/no-image.png")
                }
                loading="lazy"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-600 text-white">
                    Refurbished
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-900 truncate">
                  {o.title ||
                    `${o.brand ? `${o.brand} ` : ""}${
                      o.part_type || ""
                    }`.trim() ||
                    mpn}
                </div>
                <div className="text-xs text-gray-600 truncate">
                  {mpn}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {formatPrice(o)}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
                    In stock
                  </span>
                </div>
                {o.quantity_available != null && (
                  <div className="text-xs text-gray-700 mt-0.5">
                    Qty available:{" "}
                    <span className="font-medium">
                      {o.quantity_available}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ---------------- subcomponents (normal mode) ---------------- */

function NewCard({ normKey, newPart, modelNumber, sequence }) {
  const rawMpn = extractRawMPN(newPart);
  const newPrice = numericPrice(newPart);

  return (
    <div className="relative border rounded p-3 hover:shadow transition bg-white">
      {sequence != null && (
        <div className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-white">
          #{sequence}
        </div>
      )}
      <div className="flex gap-4 items-start">
        <PartImage
          imageUrl={newPart.image_url}
          imageKey={newPart.image_key}
          mpn={newPart.mpn}
          alt={newPart.name}
          className="w-20 h-20 object-contain"
          imgProps={{ loading: "lazy", decoding: "async" }}
        />
        <div className="min-w-0 flex-1">
          <Link
            to={`/parts/${encodeURIComponent(rawMpn)}`}
            state={{ fromModel: modelNumber }}
            className="font-semibold text-[15px] hover:underline line-clamp-2 text-black"
          >
            {newPart.name || rawMpn}
          </Link>
          <div className="mt-0.5 text-[13px] text-gray-800">
            MPN: {rawMpn}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {stockBadge(newPart)}
            {newPrice != null ? (
              <span className="font-semibold">
                {formatPrice(newPrice)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function RefurbCard({
  normKey,
  knownName,
  cmp,
  newPart,
  modelNumber,
  sequence,
}) {
  const refurb = getRefurb(cmp) || {};
  if (refurb.price == null) return null;

  const titleText = knownName || normKey.toUpperCase();
  const refurbMpn = refurb?.mpn || normKey.toUpperCase();

  const rawMpnForUrl =
    (newPart && extractRawMPN(newPart)) || refurbMpn || normKey;

  const offerId =
    refurb?.listing_id || refurb?.offer_id || refurb?.id || null;
  const offerQS = offerId
    ? `?offer=${encodeURIComponent(String(offerId))}`
    : "";

  const newPrice = newPart
    ? numericPrice(newPart)
    : getNew(cmp)?.price ?? null;
  const refurbPrice = numericPrice(refurb);
  const savings = calcSavings(newPrice, refurbPrice);

  let compareLine = null;
  if (newPrice != null) {
    const isSpecial = String(getNew(cmp)?.stock_status || "")
      .toLowerCase()
      .includes("special");
    compareLine = isSpecial
      ? `New part can be special ordered for ${formatPrice(
          newPrice
        )}`
      : `New part available for ${formatPrice(newPrice)}`;
  }

  return (
    <div className="relative border border-red-300 rounded p-3 hover:shadow-md transition bg-red-50">
      {sequence != null && (
        <div className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-red-700 text-white">
          #{sequence}
        </div>
      )}
      <div className="flex gap-4 items-start">
        <div className="w-20 h-20 rounded bg-white flex items-center justify-center overflow-hidden border border-red-100">
          <div className="w-full h-full bg-gray-100 text-[11px] text-gray-600 flex flex-col items-center justify-center px-1 text-center">
            <span className="uppercase font-semibold tracking-wide">
              Refurb
            </span>
            <span className="text-[10px]">Save vs new</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-600 text-white">
              Refurbished
            </span>
            {savings != null ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                Save {formatPrice(savings)} vs new
              </span>
            ) : null}
          </div>

          <Link
            to={`/refurb/${encodeURIComponent(rawMpnForUrl)}${offerQS}`}
            state={{ fromModel: modelNumber }}
            className="font-semibold text-[15px] hover:underline line-clamp-2 text-black"
          >
            {titleText.startsWith("Refurbished:")
              ? titleText
              : `Refurbished: ${titleText}`}
          </Link>

          <div className="mt-0.5 text-[13px] text-gray-800">
            MPN: {refurbMpn}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
              In stock
            </span>
            {refurbPrice != null ? (
              <span className="font-semibold">
                {formatPrice(refurbPrice)}
              </span>
            ) : null}
          </div>

          {compareLine || savings != null ? (
            <div className="mt-2 text-xs text-red-700 bg-white border border-red-200 rounded px-2 py-1">
              {compareLine || "No new part available"}
              {savings != null ? (
                <span className="ml-2 font-semibold">
                  Save {formatPrice(savings)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -------- Other Known Parts (unavailable only, title + MPN) -------- */

function OtherKnownRow({ row }) {
  const rawMpn = extractRawMPN(row);

  return (
    <div className="border rounded px-2 py-1 bg-white">
      <div className="text-[12px] font-medium line-clamp-2 text-black">
        {row.name || rawMpn || "Untitled part"}
      </div>
      <div className="text-[11px] text-gray-600 mt-0.5">
        MPN: {rawMpn || "–"}
      </div>
    </div>
  );
}

/* -------- helper to find priced row by MPN -------- */

function findPriced(pricedList, row) {
  const key = normalize(extractRawMPN(row));
  if (!key) return null;
  for (const p of pricedList || []) {
    if (normalize(extractRawMPN(p)) === key) return p;
  }
  return null;
}

export default ModelPage;
