// src/ModelPage.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import PartImage from "./components/PartImage";
import { makePartTitle } from "./lib/PartsTitle";

const API_BASE = "https://api.appliancepartgeeks.com";

/* ================================
   1) HELPER FUNCTIONS
   ================================ */

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
  return 9;
};

/** Stock badge (ONLY used for new parts, not offers) */
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

// Build refurb bulk map + unique MPN count from a list of offers
function buildRefurbMaps(offers) {
  const mpnSet = new Set();
  const byNorm = {};

  for (const o of offers || []) {
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
      (price != null && (existingPrice == null || price < existingPrice))
    ) {
      byNorm[normKey] = { refurb: o };
    }
  }

  return {
    bulk: byNorm,
    uniqueCount: mpnSet.size,
  };
}

/* ================================
   2) MAIN PAGE COMPONENT: ModelPage
   ================================ */

const ModelPage = () => {
  const [searchParams] = useSearchParams();

  // Handle double-encoded model strings (slashes etc.)
  const rawParam = searchParams.get("model") || "";
  let modelNumber = rawParam;
  try {
    modelNumber = decodeURIComponent(rawParam);
  } catch {
    modelNumber = rawParam;
  }

  const refurbMode = searchParams.get("refurb") === "1";
  const DEBUG = searchParams.get("debug") === "1";

  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], all: [] });
  const [brandLogos, setBrandLogos] = useState([]);
  const [error, setError] = useState(null);

  const [bulk, setBulk] = useState({});
  const [bulkReady, setBulkReady] = useState(false);
  const [bulkError, setBulkError] = useState(null);

  const [refurbItems, setRefurbItems] = useState([]);
  const [refurbSummaryCount, setRefurbSummaryCount] = useState(null);
  const [refurbSummaryLoading, setRefurbSummaryLoading] = useState(false);
  const [refurbSummaryError, setRefurbSummaryError] = useState("");

  const availRootRef = useRef(null);
  const knownRootRef = useRef(null);

  const lastModelRef = useRef(null);
  const didFetchLogosRef = useRef(false);

  /* ---- 2.3 BRAND LOGOS: FETCH ONCE ---- */
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

  /* ---- 2.4 MODEL + PARTS + REFURB DATA FETCH ---- */
  useEffect(() => {
    if (!modelNumber) return;

    const comboKey = `${modelNumber}::${refurbMode ? "refurb" : "normal"}`;
    if (lastModelRef.current === comboKey) return;
    lastModelRef.current = comboKey;

    // CLEAR STATE so old model's parts don't hang
    setModel(null);
    setParts({ priced: [], all: [] });
    setError(null);

    setBulk({});
    setBulkReady(false);
    setBulkError(null);

    setRefurbItems([]);
    setRefurbSummaryCount(null);
    setRefurbSummaryError("");
    setRefurbSummaryLoading(true);

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
        if (!res.ok) {
          console.error("❌ parts/for-model HTTP", res.status);
          setParts({ priced: [], all: [] });
          return;
        }
        const data = await res.json();
        setParts({
          all: Array.isArray(data.all) ? data.all : [],
          priced: Array.isArray(data.priced) ? data.priced : [],
        });
      } catch (err) {
        console.error("❌ Error loading parts:", err);
        setParts({ priced: [], all: [] });
      }
    };

    // ONLY trust /api/refurb/for-model/{modelNumber} here.
    const fetchRefurb = async () => {
      try {
        const primaryUrl = `${API_BASE}/api/refurb/for-model/${encodeURIComponent(
          modelNumber
        )}`;
        const res = await fetch(primaryUrl);

        if (!res.ok) {
          if (res.status !== 404) {
            throw new Error(`HTTP ${res.status}`);
          }
          // 404 = no refurb offers for this model
          setRefurbItems([]);
          setBulk({});
          setBulkReady(true);
          setRefurbSummaryCount(0);
          return;
        }

        const data = await res.json();
        const offers = Array.isArray(data)
          ? data
          : Array.isArray(data?.offers)
          ? data.offers
          : Array.isArray(data?.items)
          ? data.items
          : [];

        const { bulk: bulkMap, uniqueCount } = buildRefurbMaps(offers);

        setRefurbItems(offers);
        setBulk(bulkMap);
        setBulkReady(true);
        setRefurbSummaryCount(uniqueCount);
      } catch (e) {
        console.error("❌ Error loading refurb summary:", e);
        setRefurbSummaryError(
          e?.message || "Failed to load refurbished offers."
        );
        setBulk({});
        setBulkReady(true);
        setRefurbItems([]);
        setRefurbSummaryCount(0);
      } finally {
        setRefurbSummaryLoading(false);
      }
    };

    fetchModel();
    fetchParts();
    fetchRefurb();

    // clear any stray header input value
    const input = document.querySelector("input[type='text']");
    if (input) input.value = "";
  }, [modelNumber, refurbMode]);

  /* ---- 2.5 BRAND LOGO LOOKUP ---- */
  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const key = normalize(brand);
    const hit = brandLogos.find((b) => normalize(b.name) === key);
    return hit?.image_url || hit?.url || hit?.logo_url || hit?.src || null;
  };

  /* ---- 2.6 DERIVED LISTS & MAPS ---- */

  const allKnownOrdered = useMemo(() => {
    const list = Array.isArray(parts.all) ? [...parts.all] : [];
    list.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    return list;
  }, [parts.all]);

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

  const findSequenceForNorm = (normKey) => {
    if (!normKey) return null;
    const mapped = sequenceByNorm.get(normKey);
    if (mapped != null) return mapped;
    const hit =
      allKnownOrdered.find(
        (r) => normalize(extractRawMPN(r)) === normKey && r.sequence != null
      ) || null;
    return hit ? hit.sequence : null;
  };

  const pricedByNorm = useMemo(() => {
    const m = new Map();
    for (const p of parts.priced || []) {
      const normKey = normalize(extractRawMPN(p));
      if (normKey) m.set(normKey, p);
    }
    return m;
  }, [parts.priced]);

  /** 2.6.1 TILES = data for "Available Parts" */
  const tiles = useMemo(() => {
    if (refurbMode) return [];

    const pricedList = parts.priced || [];
    const out = [];

    // Primary: loop over priced new parts first
    for (const newPart of pricedList) {
      const normKey = normalize(extractRawMPN(newPart));
      if (!normKey) continue;

      const cmp = bulk?.[normKey] || null;
      const refurb = getRefurb(cmp);
      const refurbPrice = refurb ? numericPrice(refurb) : null;

      const sequence =
        findSequenceForNorm(normKey) ?? newPart.sequence ?? null;

      // If we have a refurb for this MPN, add a refurb tile
      if (refurb && refurbPrice != null) {
        out.push({
          type: "refurb",
          normKey,
          knownName: newPart?.name || refurb.title || null,
          newPart,
          cmp,
          sequence,
        });
      }

      // Then always add the new part tile (if in stock / backorder)
      const rank = getAvailabilityRank(newPart);
      if (rank === 1 || rank === 2) {
        out.push({
          type: "new",
          normKey,
          newPart,
          cmp,
          sequence,
        });
      }
    }

    // Fallback: refurb-only tiles if no priced parts
    if (!pricedList.length) {
      for (const [normKey, cmp] of Object.entries(bulk || {})) {
        const refurb = getRefurb(cmp);
        const refurbPrice = refurb ? numericPrice(refurb) : null;
        if (!normKey || !refurb || refurbPrice == null) continue;

        const sequence = findSequenceForNorm(normKey);

        out.push({
          type: "refurb",
          normKey,
          knownName: refurb.title || null,
          newPart: null,
          cmp,
          sequence,
        });
      }
    }

    return out;
  }, [refurbMode, parts.priced, bulk, allKnownOrdered, sequenceByNorm]);

  /** 2.6.2 SORTED TILES */
  const tilesSorted = useMemo(() => {
    if (refurbMode) return [];
    const refurbPrice = (t) => {
      const v = getRefurb(t.cmp);
      return v ? numericPrice(v) ?? Infinity : Infinity;
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

  /** 2.6.3 REFURB COUNT (fallback if summary missing) */
  const refurbCount = useMemo(() => {
    const seen = new Set();

    if (refurbMode) {
      for (const o of refurbItems || []) {
        const nk = normalize(
          o.mpn || o.mpn_normalized || o.mpn_coalesced || ""
        );
        if (nk) seen.add(nk);
      }
      return seen.size;
    }

    for (const t of tiles) {
      if (t.type === "refurb" && t.normKey) {
        seen.add(t.normKey);
      }
    }
    return seen.size;
  }, [tiles, refurbItems, refurbMode]);

  /** 2.6.4 ALL KNOWN PARTS (RIGHT COLUMN — no filtering) */
  const allKnownParts = useMemo(() => {
    return allKnownOrdered;
  }, [allKnownOrdered]);

  /* ---- 2.7 RENDER GUARDS ---- */

  if (error)
    return (
      <div className="text-red-600 text-center py-6 bg-white">{error}</div>
    );
  if (!model) return null;

  /* ---- 2.8 MAIN RENDER LAYOUT ---- */

  return (
    <>
      {/* OUTER WRAPPER WITH BLUE BACKGROUND */}
      <div className="w-full flex justify-center mt-4 mb-12 bg-[#001f3e]">
        <div className="bg-white text-black shadow-[0_0_20px_rgba(0,0,0,0.4)] rounded-md w-[90%] max-w-[1400px] pb-12 px-4 md:px-6 lg:px-8">
          {/* DEBUG STRIP */}
          {DEBUG ? (
            <div className="mb-2 text-xs rounded bg-yellow-50 border border-yellow-200 p-2 text-yellow-900">
              <div>
                bulk refurb rows: {Object.keys(bulk || {}).length} | refurbished
                parts (unique):{" "}
                {refurbSummaryCount != null
                  ? refurbSummaryCount
                  : refurbCount}
              </div>
              <div>
                available tiles (refurb + new rank 1/2): {tilesSorted.length}
              </div>
              {refurbSummaryError ? (
                <div className="mt-1 text-red-700">
                  refurb summary error: <code>{refurbSummaryError}</code>
                </div>
              ) : null}
              {bulkError ? (
                <div className="mt-1 text-red-700">
                  bulk error: <code>{bulkError}</code>
                </div>
              ) : null}
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

          {/* Header section: brand logo + model summary + exploded views */}
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
                  Known Parts: {parts.all.length} &nbsp;|&nbsp; Priced Parts:{" "}
                  {parts.priced.length} {" | "}
                  <span
                    className="inline-block px-2 py-0.5 rounded bg-gray-900 text-white"
                    title="Number of refurbished parts (unique MPNs) for this model"
                  >
                    Refurbished Parts:{" "}
                    {refurbSummaryLoading
                      ? "…"
                      : refurbSummaryCount != null
                      ? refurbSummaryCount
                      : refurbCount}
                  </span>
                </p>
              </div>

              {/* exploded views using PartImage behavior */}
              <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-2">
                {model.exploded_views?.map((v, i) => (
                  <div key={i} className="w-24 shrink-0">
                    <div className="border rounded p-1 bg-white w-full">
                      <PartImage
                        imageUrl={v.image_url}
                        alt={v.label}
                        disableHoverPreview
                        className="w-full h-14 object-contain"
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

          {/* BODY: REFURB MODE vs NORMAL MODE */}
          {refurbMode ? (
            <RefurbOnlyGrid
              items={refurbItems}
              modelNumber={model.model_number}
            />
          ) : (
            <div className="flex flex-col md:flex-row gap-6">
              {/* Available Parts */}
              <div className="md:w-3/4">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-lg font-semibold text-black">
                    Available Parts
                  </h3>
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
                          allKnown={allKnownOrdered}
                        />
                      ) : (
                        <NewCard
                          key={`new-${t.normKey}`}
                          normKey={t.normKey}
                          newPart={t.newPart}
                          modelNumber={model.model_number}
                          sequence={t.sequence}
                          allKnown={allKnownOrdered}
                        />
                      )
                    )}
                  </div>
                )}
              </div>

              {/* All Known Parts */}
              <div className="md:w-1/4">
                <h3 className="text-lg font-semibold mb-2 text-black">
                  All Known Parts
                </h3>
                {allKnownParts.length === 0 ? (
                  <p className="text-gray-500">
                    No known parts for this model.
                  </p>
                ) : (
                  <div
                    ref={knownRootRef}
                    className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1"
                  >
                    {allKnownParts.map((p, idx) => (
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
    </>
  );
};

/* ===========================================
   3) REFURB-ONLY GRID (REFURB MODE)
   =========================================== */

function RefurbOnlyGrid({ items, modelNumber }) {
  if (!items?.length)
    return (
      <p className="text-gray-600">No refurbished offers for this model.</p>
    );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((o, i) => {
        const mpn = o.mpn || o.mpn_normalized || "";
        const offerId = o.listing_id || o.offer_id || "";
        const titleText = makePartTitle(o, mpn);
        const imgMpn = mpn || o.mpn_normalized || "";

        const href = `/refurb/${encodeURIComponent(
          imgMpn
        )}${offerId ? `?offer=${encodeURIComponent(offerId)}` : ""}`;

        return (
          <div
            key={`${mpn}-${offerId || i}`}
            className="rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 transition group"
            title={titleText || mpn}
          >
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded border border-gray-100 bg-white flex items-center justify-center overflow-hidden">
                <PartImage
                  imageUrl={
                    o.image_url ||
                    o.image ||
                    o.picture ||
                    o.thumbnail ||
                    "/no-image.png"
                  }
                  mpn={imgMpn}
                  alt={titleText || mpn}
                  disableHoverPreview
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-black mb-0.5">
                  {o.quantity_available != null
                    ? `OEM Refurbished: ${o.quantity_available} Available`
                    : "OEM Refurbished"}
                </div>
                <Link
                  to={href}
                  state={{ fromModel: modelNumber }}
                  className="text-sm font-medium text-gray-900 truncate hover:underline"
                >
                  #{titleText || mpn}
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {formatPrice(o)}
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
          </div>
        );
      })}
    </div>
  );
}

/* ===========================================
   4) NORMAL-MODE CARDS
   =========================================== */

function NewCard({ newPart, modelNumber, sequence, allKnown }) {
  const rawMpn = extractRawMPN(newPart);
  const newPrice = numericPrice(newPart);

  const baseTitle =
    (newPart?.title || "").toString().trim() ||
    (newPart?.name || "").toString().trim() ||
    rawMpn;

  let seq =
    sequence ??
    newPart?.sequence ??
    (allKnown || []).find(
      (r) => normalize(extractRawMPN(r)) === normalize(rawMpn)
    )?.sequence ??
    null;

  const displayTitle = baseTitle || rawMpn;
  const imgAlt = displayTitle || rawMpn;

  return (
    <div className="relative border rounded p-3 hover:shadow transition bg-white">
      <div className="flex gap-4 items-start">
        <div className="group relative w-20 h-20 flex items-center justify-center overflow-hidden rounded bg-white border border-gray-100">
          <PartImage
            imageUrl={newPart.image_url}
            imageKey={newPart.image_key}
            mpn={newPart.mpn}
            alt={imgAlt}
            disableHoverPreview
            className="w-full h-full object-contain"
          />
        </div>
        <div className="min-w-0 flex-1">
          <Link
            to={`/parts/${encodeURIComponent(rawMpn)}`}
            state={{ fromModel: modelNumber }}
            className="font-semibold text-[15px] hover:underline line-clamp-2 text-black"
          >
            #{displayTitle}
          </Link>

          {seq != null && (
            <div className="text-[11px] text-gray-700 mt-0.5">
              Diagram #{seq}
            </div>
          )}

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
  allKnown,
}) {
  const refurb = getRefurb(cmp) || {};
  const refurbPrice = numericPrice(refurb);
  if (refurbPrice == null) return null;

  const refurbMpn = refurb?.mpn || normKey.toUpperCase();

  const basePartForTitle = newPart || refurb;
  const baseTitle = makePartTitle(basePartForTitle, refurbMpn);
  const titleText = baseTitle || knownName || normKey.toUpperCase();

  const rawMpnForUrl =
    (newPart && extractRawMPN(newPart)) || refurbMpn || normKey;

  const offerId =
    refurb?.listing_id || refurb?.offer_id || refurb?.id || null;
  const offerQS = offerId
    ? `?offer=${encodeURIComponent(String(offerId))}`
    : "";

  const hasNewPart = !!newPart;
  const newFromCmp = getNew(cmp);
  const newPrice = hasNewPart
    ? numericPrice(newPart)
    : newFromCmp
    ? numericPrice(newFromCmp)
    : null;

  const savings = calcSavings(newPrice, refurbPrice);

  const rawNorm = normalize(rawMpnForUrl);
  let seq =
    sequence ??
    newPart?.sequence ??
    (allKnown || []).find(
      (r) => normalize(extractRawMPN(r)) === rawNorm
    )?.sequence ??
    null;

  return (
    <div className="relative border border-red-300 rounded p-3 hover:shadow-md transition bg-red-50">
      <div className="flex gap-4 items-start">
        {/* Image: uses PartImage preview, not a Link */}
        <div className="group w-20 h-20 rounded bg-white flex items-center justify-center overflow-hidden border border-red-100">
          <PartImage
            imageUrl={
              refurb.image_url ||
              refurb.image ||
              refurb.picture ||
              refurb.thumbnail ||
              "/no-image.png"
            }
            mpn={refurbMpn}
            alt={titleText}
            disableHoverPreview
            className="w-full h-full object-contain"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-black mb-0.5">
            {refurb.quantity_available != null
              ? `OEM Refurbished: ${refurb.quantity_available} Available`
              : "OEM Refurbished"}
          </div>

          <Link
            to={`/refurb/${encodeURIComponent(rawMpnForUrl)}${offerQS}`}
            state={{ fromModel: modelNumber }}
            className="font-semibold text-[15px] hover:underline line-clamp-2 text-black"
          >
            #{titleText}
          </Link>

          {seq != null && (
            <div className="text-[11px] text-gray-700 mt-0.5">
              Diagram #{seq}
            </div>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              {formatPrice(refurbPrice)}
            </span>
            {savings != null && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                Save {formatPrice(savings)} vs new
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===========================================
   5) ALL KNOWN PART ROW
   =========================================== */

function OtherKnownRow({ row }) {
  const rawMpn = extractRawMPN(row);

  const title =
    (row?.title || "").toString().trim() ||
    (row?.name || "").toString().trim() ||
    rawMpn;

  return (
    <div className="border rounded px-2 py-1 bg-white">
      <div className="text-[12px] font-medium line-clamp-2 text-black">
        {title || rawMpn || "Untitled part"}
      </div>
      <div className="text-[11px] text-gray-600 mt-0.5">
        MPN: {rawMpn || "–"}
      </div>
      {row.sequence != null && (
        <div className="text-[11px] text-gray-700">Diagram #{row.sequence}</div>
      )}
    </div>
  );
}

export default ModelPage;
