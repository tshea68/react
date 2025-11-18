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
 * Stock badge that understands availability_rank:
 *  1 = in stock
 *  2 = special order
 *  9 = unavailable
 * Falls back to stock_status text if rank is missing.
 * (Only used for NEW parts, not refurbs.)
 */
const stockBadge = (input) => {
  const rank =
    input && typeof input === "object"
      ? input.availability_rank ?? null
      : null;

  const rawStatus =
    input && typeof input === "object" ? input.stock_status : input;

  const s = String(rawStatus || "").toLowerCase();

  // Rank wins when present
  if (rank === 1) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
        In stock
      </span>
    );
  }

  if (rank === 2) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white">
        Special order
      </span>
    );
  }

  if (rank === 9) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">
        Unavailable
      </span>
    );
  }

  // Fallback: infer from string status
  if (/special/.test(s)) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white">
        Special order
      </span>
    );
  }
  if (/unavailable|out\s*of\s*stock|ended|obsolete|discontinued/.test(s)) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">
        Unavailable
      </span>
    );
  }
  if (/(^|\s)in\s*stock(\s|$)|\bavailable\b/.test(s)) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
        In stock
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

/** Accept a few response shapes and return a dict-like object */
function normalizeBulkResponse(data) {
  const candidate = data?.items || data?.by_key || data?.results || data;
  return candidate && typeof candidate === "object" ? candidate : {};
}

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
  // bulk is { normKey: { refurb: {...} | null, reliable: {...} | null } }
  const [bulk, setBulk] = useState({});
  const [bulkReady, setBulkReady] = useState(false);
  const [bulkError, setBulkError] = useState(null);

  // refurb-only items (refurb mode)
  const [refurbItems, setRefurbItems] = useState([]);
  const [refurbLoading, setRefurbLoading] = useState(false);
  const [refurbError, setRefurbError] = useState("");

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
      // normal mode: fetch parts and then bulk compare NEW vs REFURB
      setBulk({});
      setBulkReady(false);
      setBulkError(null);
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

  // maps by normalized MPN (for NEW + ALL-KNOWN)
  const pricedByNorm = useMemo(() => {
    const m = new Map();
    for (const p of parts.priced || []) {
      const normKey = normalize(extractRawMPN(p));
      if (normKey) m.set(normKey, p);
    }
    return m;
  }, [parts.priced]);

  const allKnownByNorm = useMemo(() => {
    const m = new Map();
    for (const r of allKnownOrdered) {
      const normKey = normalize(extractRawMPN(r));
      if (normKey && !m.has(normKey)) m.set(normKey, r);
    }
    return m;
  }, [allKnownOrdered]);

  // keys we will send to /api/compare/batch
  const bulkKeys = useMemo(() => {
    if (refurbMode) return [];
    const s = new Set([...pricedByNorm.keys(), ...allKnownByNorm.keys()]);
    return Array.from(s).slice(0, 150); // cap payload
  }, [pricedByNorm, allKnownByNorm, refurbMode]);

  // bulk compare (normal mode, NEW+REFURB)
  useEffect(() => {
    if (refurbMode) {
      setBulkReady(true);
      return;
    }
    if (!bulkKeys.length) {
      setBulkReady(true);
      return;
    }

    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/compare/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys: bulkKeys }),
        });
        if (!r.ok) {
          const txt = await r.text();
          setBulkError(`bulk ${r.status}: ${txt?.slice(0, 160)}`);
          setBulk({});
        } else {
          const data = await r.json();
          setBulk(normalizeBulkResponse(data));
        }
      } catch (e) {
        setBulkError(String(e?.message || e));
        setBulk({});
      } finally {
        setBulkReady(true);
      }
    })();
  }, [bulkKeys, refurbMode]);

  // build tiles (new + refurb if present) — normal mode only
  const tiles = useMemo(() => {
    if (refurbMode) return [];
    const out = [];
    for (const p of parts.priced || []) {
      const normKey = normalize(extractRawMPN(p));
      if (!normKey) continue;

      const cmp = bulk[normKey] || null;

      // new tile
      out.push({ type: "new", normKey, newPart: p, cmp });

      // refurb tile (if any)
      const refurb = getRefurb(cmp);
      if (refurb && refurb.price != null) {
        out.push({
          type: "refurb",
          normKey,
          knownName: p.name || null,
          newPart: p,
          cmp,
        });
      }
    }
    return out;
  }, [parts.priced, bulk, refurbMode]);

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
      // refurb-only mode: use the actual list length
      return refurbItems.length;
    }

    // normal mode: count unique normKeys that actually have a refurb tile
    const seen = new Set();
    for (const t of tiles) {
      if (t.type === "refurb" && t.normKey) {
        seen.add(t.normKey);
      }
    }
    return seen.size;
  }, [tiles, refurbItems, refurbMode]);

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
                  bulkKeys: {bulkKeys.length} | bulk rows:{" "}
                  {Object.keys(bulk || {}).length} | refurb parts:{" "}
                  {refurbCount}
                </div>
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
                      title="Number of refurbished offers for this model"
                    >
                      Refurbished Parts:{" "}
                      {bulkReady ? refurbCount : "…"}
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
              <h3 className="text-lg font-semibold mb-2 text-black">
                Available Parts
              </h3>

              {!bulkReady ? (
                <p className="text-gray-500">Loading…</p>
              ) : tilesSorted.length === 0 ? (
                <p className="text-gray-500 mb-6">
                  No parts found for this model.
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
                      />
                    ) : (
                      <NewCard
                        key={`new-${t.normKey}`}
                        normKey={t.normKey}
                        newPart={t.newPart}
                        modelNumber={model.model_number}
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
              {allKnownOrdered.length === 0 ? (
                <p className="text-gray-500">
                  No parts found for this model.
                </p>
              ) : (
                <div
                  ref={knownRootRef}
                  className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1"
                >
                  {allKnownOrdered.map((p, idx) => {
                    const normKey = normalize(extractRawMPN(p));
                    const cmp = bulk[normKey] || null;
                    return (
                      <AllKnownRow
                        key={`${p.mpn || "row"}-${idx}`}
                        row={p}
                        priced={findPriced(parts.priced, p)}
                        cmp={cmp}
                        modelNumber={model.model_number}
                      />
                    );
                  })}
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
        // use listing_id for ?offer=; backend uses listing_id
        const offerId = o.listing_id || o.offer_id || "";
        return (
          <Link
            key={`${mpn}-${offerId || i}`}
            to={`/refurb/${encodeURIComponent(
              mpn || o.mpn_normalized || ""
            )}${
              offerId ? `?offer=${encodeURIComponent(offerId)}` : ""
            }`}
            className="rounded-lg border border-gray-200 p-3 bg-white hover:bg-gray-50 transition"
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
                {/* quantity_available doesn't exist in offers schema; keep conditional safe */}
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

function NewCard({ normKey, newPart, modelNumber }) {
  const rawMpn = extractRawMPN(newPart);
  const newPrice = numericPrice(newPart);

  return (
    <div className="border rounded p-3 hover:shadow transition bg-white">
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

function RefurbCard({ normKey, knownName, cmp, newPart, modelNumber }) {
  const refurb = getRefurb(cmp) || {};
  if (refurb.price == null) return null;

  const titleText = knownName || normKey.toUpperCase();
  const refurbMpn = refurb?.mpn || normKey.toUpperCase();

  // we want /refurb/{RAW_MPN}?offer={listing_id}
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
  const savings = calcSavings(newPrice, refurb.price);

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
    <div className="border rounded p-3 hover:shadow transition bg-white">
      <div className="flex gap-4 items-start">
        <div className="w-20 h-20 rounded bg-white flex items-center justify-center overflow-hidden">
          <div className="w-full h-full bg-gray-100 text-xs text-gray-500 flex items-center justify-center">
            MPN
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <Link
            to={`/refurb/${encodeURIComponent(rawMpnForUrl)}${offerQS}`}
            state={{ fromModel: modelNumber }}
            className="font-semibold text-[15px] hover:underline line-clamp-2 text-black"
          >
            {`Refurbished: ${titleText}`}
          </Link>
          <div className="mt-0.5 text-[13px] text-gray-800">
            MPN: {refurbMpn}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
              In stock
            </span>
            <span className="font-semibold">
              {formatPrice(refurb.price)}
            </span>
          </div>

          <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
            {compareLine || "No new part available"}
            {savings != null ? (
              <span className="ml-2 font-semibold">
                Save {formatPrice(savings)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function AllKnownRow({ row, priced, cmp, modelNumber }) {
  const rawMpn = extractRawMPN(row);
  const price = priced ? numericPrice(priced) : null;
  const refurb = getRefurb(cmp) || {};

  return (
    <div className="border rounded p-3 hover:shadow transition bg-white">
      <div className="text-xs text-gray-500 mb-1">
        {row.sequence != null
          ? `Diagram #${row.sequence}`
          : "Diagram #–"}
      </div>

      <div className="text-sm font-medium line-clamp-2 text-black">
        {row.name || rawMpn}
      </div>
      <div className="mt-0.5 text-[13px] text-gray-800">
        MPN: {rawMpn}
      </div>

      <div className="text-xs text-gray-600 mt-1 flex items-center gap-2">
        {priced ? stockBadge(priced) : stockBadge("unavailable")}
        {price != null ? (
          <span className="font-semibold">{formatPrice(price)}</span>
        ) : null}
      </div>

      {refurb.price != null && !priced ? (
        <Link
          to={`/refurb/${encodeURIComponent(rawMpn || "")}${
            refurb?.listing_id
              ? `?offer=${encodeURIComponent(
                  refurb.listing_id
                )}`
              : ""
          }`}
          state={{ fromModel: modelNumber }}
          className="mt-2 inline-block rounded bg-red-600 text-white text-xs px-2 py-1 hover:bg-red-700 text-left"
        >
          Refurbished available for {formatPrice(refurb.price)}
        </Link>
      ) : null}
    </div>
  );
}

function findPriced(pricedList, row) {
  const key = normalize(extractRawMPN(row));
  if (!key) return null;
  for (const p of pricedList || []) {
    if (normalize(extractRawMPN(p)) === key) return p;
  }
  return null;
}

export default ModelPage;
