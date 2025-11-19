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
 * Stock badge that understands availability_rank and backorders:
 *  1 = in stock   → green
 *  2 = backorder  → red
 *  9 = unavailable → black
 *
 * Rank wins when present; if rank is missing, fall back to stock_status text.
 * Only used for NEW parts, not refurbs.
 */
const stockBadge = (input) => {
  const rank =
    input && typeof input === "object"
      ? input.availability_rank ?? null
      : null;

  const rawStatus =
    input && typeof input === "object" ? input.stock_status : input;

  const s = String(rawStatus || "").toLowerCase();

  // 1) RANK WINS WHEN PRESENT
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

  if (rank === 9) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">
        Unavailable
      </span>
    );
  }

  // 2) FALL BACK TO STATUS TEXT

  // anything that looks like backorder / special/factory order
  if (
    /\bback\s*order(ed)?\b|back-?ordered|special order|factory order/.test(
      s
    )
  ) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-red-600 text-white">
        Backorder
      </span>
    );
  }

  // true dead states
  if (/unavailable|out\s*of\s*stock|ended|obsolete|discontinued/.test(s)) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">
        Unavailable
      </span>
    );
  }

  // normal available states
  if (/(^|\s)in\s*stock(\s|$)|\bavailable\b/.test(s)) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
        In stock
      </span>
    );
  }

  // 3) Unknown → conservative default
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

    // reset refurb summary
    setRefurbSummaryCount(null);
    setRefurbSummaryError("");
    setRefurbSummaryLoading(true);
    (async () => {
      try {
        const url = `${API_BASE}/api/refurb/for-model/${encodeURIComponent(
          modelNumber
        )}?limit=200`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const offers = Array.isArray(data?.offers) ? data.offers : [];

          // UNIQUE MPNs ONLY
          const mpnSet = new Set();
          for (const o of offers) {
            const k = normalize(
              o.mpn || o.mpn_normalized || o.mpn_coalesced || ""
            );
            if (k) mpnSet.add(k);
          }
          let rawCount = mpnSet.size;

          // If for some reason offers is empty but count exists, keep that as fallback
          if (rawCount === 0 && typeof data?.count === "number") {
            rawCount = data.count;
          }

          setRefurbSummaryCount(rawCount);
        } else if (res.status === 404) {
          setRefurbSummaryCount(0);
        } else {
          setRefurbSummaryError(`HTTP ${res.status}`);
        }
      } catch (e) {
        setRefurbSummaryError(
          e?.message || "Failed to load refurbished summary."
        );
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
      // normal mode: fetch parts; refurb data will be loaded per-MPN below
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

  // keys we will use to query /api/refurb/{mpn}
  const bulkKeys = useMemo(() => {
    if (refurbMode) return [];
    const s = new Set([...pricedByNorm.keys(), ...allKnownByNorm.keys()]);
    // cap to avoid insane number of HTTP calls
    return Array.from(s).slice(0, 150);
  }, [pricedByNorm, allKnownByNorm, refurbMode]);

  // per-MPN refurb lookup using existing /api/refurb/{mpn}
  useEffect(() => {
    if (refurbMode) {
      setBulkReady(true);
      return;
    }
    if (!bulkKeys.length) {
      setBulk({});
      setBulkReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const out = {};
        for (const key of bulkKeys) {
          if (cancelled) break;
          try {
            const res = await fetch(
              `${API_BASE}/api/refurb/${encodeURIComponent(key)}?limit=1`
            );
            if (!res.ok) continue; // 404 just means no refurb for this mpn
            const data = await res.json();
            const best = data?.best_offer || null;
            if (best) {
              out[key] = { refurb: best };
            }
          } catch (e) {
            console.error("❌ Error fetching refurb for", key, e);
          }
        }
        if (!cancelled) {
          setBulk(out);
          setBulkReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          setBulkError(String(e?.message || e));
          setBulk({});
          setBulkReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bulkKeys, refurbMode]);

  // build tiles (new + refurb if present) — normal mode only
  const tiles = useMemo(() => {
    if (refurbMode) return [];
    const out = [];
    for (const p of parts.priced || []) {
      const normKey = normalize(extractRawMPN(p));
      if (!normKey) continue;

      const cmp = bulk[normKey] || null;

      // sequence: prefer priced row, else any all-known row for same MPN
      const seq =
        p.sequence ??
        allKnownByNorm.get(normKey)?.sequence ??
        null;

      // NEW tile – always include priced parts (we’re not filtering by rank here)
      out.push({
        type: "new",
        normKey,
        newPart: p,
        cmp,
        sequence: seq,
      });

      // REFURB tile (if any) ALWAYS included as separate card
      const refurb = getRefurb(cmp);
      if (refurb && refurb.price != null) {
        out.push({
          type: "refurb",
          normKey,
          knownName: p.name || null,
          newPart: p,
          cmp,
          sequence: seq,
        });
      }
    }
    return out;
  }, [parts.priced, bulk, refurbMode, allKnownByNorm]);

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

  // "Other Known Parts" = rows that *don’t* have a priced match
  const otherKnownUnavailable = useMemo(() => {
    const out = [];
    for (const row of allKnownOrdered) {
      const priced = findPriced(parts.priced, row);
      if (priced) continue; // we already show these in the left grid
      out.push(row);
    }
    return out;
  }, [allKnownOrdered, parts.priced]);

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
                  {Object.keys(bulk || {}).length} | refurb parts (tiles):{" "}
                  {refurbCount}
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
                        key={`ref-${t.normKey}-${t.sequence ?? "x"}`}
                        normKey={t.normKey}
                        knownName={t.knownName}
                        cmp={t.cmp}
                        newPart={t.newPart}
                        modelNumber={model.model_number}
                        sequence={t.sequence}
                      />
                    ) : (
                      <NewCard
                        key={`new-${t.normKey}-${t.sequence ?? "x"}`}
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

            {/* Other Known Parts */}
            <div className="md:w-1/4">
              <h3 className="text-lg font-semibold mb-2 text-black">
                Other Known Parts
              </h3>
              {otherKnownUnavailable.length === 0 ? (
                <p className="text-gray-500">
                  No additional parts found for this model.
                </p>
              ) : (
                <div
                  ref={knownRootRef}
                  className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1"
                >
                  {otherKnownUnavailable.map((p, idx) => (
                    <AllKnownRow
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

        const slugMpn =
          o.mpn_coalesced ||
          o.mpn ||
          o.mpn_normalized ||
          "";

        const offerId =
          o.offer_id ||
          o.listing_id ||
          o.ebay_listing_id ||
          o.ebay_id ||
          o.id ||
          "";

        return (
          <Link
            key={`${slugMpn || "mpn"}-${offerId || i}`}
            to={`/refurb/${encodeURIComponent(slugMpn)}${
              offerId ? `?offer=${encodeURIComponent(offerId)}` : ""
            }`}
            className="rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 transition"
            title={o.title || slugMpn}
          >
            <div className="flex gap-3">
              <img
                src={img}
                alt={o.title || slugMpn}
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
                    slugMpn}
                </div>
                <div className="text-xs text-gray-600 truncate">
                  {slugMpn}
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
          Diagram #{sequence}
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
  const refurbPrice = numericPrice(refurb);
  if (refurbPrice == null) return null;

  const slugMpn =
    refurb.mpn_coalesced ||
    refurb.mpn ||
    refurb.mpn_normalized ||
    (newPart && extractRawMPN(newPart)) ||
    normKey;

  const titleText = knownName || slugMpn || normKey.toUpperCase();
  const refurbMpn = slugMpn;

  const offerId =
    refurb.offer_id ||
    refurb.listing_id ||
    refurb.ebay_listing_id ||
    refurb.ebay_id ||
    refurb.id ||
    null;

  const offerQS = offerId
    ? `?offer=${encodeURIComponent(String(offerId))}`
    : "";

  const rawMpnForUrl = slugMpn;

  const newPrice = newPart
    ? numericPrice(newPart)
    : getNew(cmp)?.price ?? null;
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
          Diagram #{sequence}
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
            <span className="font-semibold">
              {formatPrice(refurbPrice)}
            </span>
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

function AllKnownRow({ row }) {
  const rawMpn = extractRawMPN(row);

  return (
    <div className="border rounded p-3 hover:shadow transition bg-white">
      <div className="text-sm font-medium line-clamp-2 text-black">
        {row.name || rawMpn}
      </div>
      <div className="mt-0.5 text-[13px] text-gray-700">
        MPN: {rawMpn}
      </div>
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
