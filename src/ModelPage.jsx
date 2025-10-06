import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import PartImage from "./components/PartImage";

const API_BASE = import.meta.env.VITE_API_URL;

/* ---------------- helpers ---------------- */
const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

const extractRawMPN = (p) => {
  // Prefer the *raw/original* MPN for linking to /parts/:mpn
  let mpn =
    p?.mpn ??
    p?.MPN ??
    p?.part_number ??
    p?.partNumber ??
    p?.mpn_raw ??
    p?.listing_mpn ??
    null;

  // If only reliable_sku is present, strip leading brand code (e.g., "WPL  279780" -> "279780")
  if (!mpn && p?.reliable_sku) {
    mpn = String(p.reliable_sku).replace(/^[A-Z]{2,}\s+/, "");
  }
  return mpn ? String(mpn).trim() : "";
};

const extractKey = (p) => normalize(extractRawMPN(p) || p?.mpn_normalized || "");

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
    return `$${Number(n).toFixed(2)}`;
  }
};

const stockBadge = (raw) => {
  const s = String(raw || "").toLowerCase();
  if (/special/.test(s)) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white">
        Special order
      </span>
    );
  }
  if (/unavailable|out\s*of\s*stock|ended/.test(s)) {
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

/* ---------------- main ---------------- */
const ModelPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const modelNumber = searchParams.get("model") || "";

  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], all: [] });
  const [brandLogos, setBrandLogos] = useState([]);
  const [popupImage, setPopupImage] = useState(null);
  const [error, setError] = useState(null);

  // single bulk snapshot of refurb/new compare info for all keys
  const [bulk, setBulk] = useState({}); // { [normKey]: {refurb:{price,url}, reliable:{price,stock_status}} }
  const [bulkReady, setBulkReady] = useState(false);

  // NEW: concrete refurb offer cards (title/image/price/offer_id) for first N keys with refurb
  const [refurbCards, setRefurbCards] = useState([]);
  const [refurbLoading, setRefurbLoading] = useState(false);

  const availRootRef = useRef(null);
  const knownRootRef = useRef(null);

  useEffect(() => {
    const fetchModel = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/models/search?q=${encodeURIComponent(modelNumber)}`);
        const data = await res.json();
        setModel(data && data.model_number ? data : null);
      } catch (err) {
        console.error("❌ Error loading model data:", err);
        setError("Error loading model data.");
      }
    };

    const fetchParts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/parts/for-model/${encodeURIComponent(modelNumber)}`);
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

    const fetchBrandLogos = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/brand-logos`);
        const data = await res.json();
        setBrandLogos(Array.isArray(data) ? data : data?.logos || []);
      } catch (err) {
        console.error("❌ Error fetching brand logos:", err);
      }
    };

    if (modelNumber) {
      setBulk({});
      setBulkReady(false);
      setRefurbCards([]);
      fetchModel();
      fetchParts();
      fetchBrandLogos();
    }

    // clear header input suggestion text if present
    const input = document.querySelector("input[type='text']");
    if (input) input.value = "";
  }, [modelNumber, location]);

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

  // Build the candidate rows shown in "Available Parts" (new + refurb-only fillers)
  const availableRows = useMemo(() => {
    const seen = new Set();
    const out = [];

    const pricedMap = new Map();
    for (const p of parts.priced || []) {
      const k = extractKey(p);
      if (k) pricedMap.set(k, p);
    }

    // Primary: new parts
    for (const [k, p] of pricedMap.entries()) {
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ key: k, newPart: p, knownName: p?.name || null });
      }
    }

    // Secondary: refurb-only fillers (cap)
    const MAX_REFURB_ONLY = 200;
    for (const row of allKnownOrdered) {
      if (out.length >= pricedMap.size + MAX_REFURB_ONLY) break;
      const k = extractKey(row);
      if (!k || seen.has(k)) continue;
      if (!pricedMap.has(k)) {
        seen.add(k);
        out.push({ key: k, newPart: null, knownName: row?.name || null });
      }
    }

    return out;
  }, [parts.priced, allKnownOrdered]);

  // Bulk compare once per page of keys
  useEffect(() => {
    const keys = availableRows.map(r => r.key).filter(Boolean);
    if (!keys.length) { setBulkReady(true); return; }

    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/compare/xmarket/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys }),
        });
        const data = await r.json();
        setBulk(data?.items || {});
      } catch (e) {
        console.warn("bulk compare failed", e);
        setBulk({});
      } finally {
        setBulkReady(true);
      }
    })();
  }, [availableRows]);

  // NEW: Fetch concrete refurb offer cards for first N refurb keys (title+image)
  useEffect(() => {
    if (!bulkReady) return;
    const refurbKeys = availableRows.map(r => r.key).filter(k => bulk[k]?.refurb?.price != null);
    const LIMIT = 12;
    const top = refurbKeys.slice(0, LIMIT);
    if (!top.length) { setRefurbCards([]); return; }

    let cancelled = false;
    setRefurbLoading(true);
    Promise.all(
      top.map(async (k) => {
        try {
          const res = await fetch(`${API_BASE}/api/suggest/refurb?q=${encodeURIComponent(k)}&limit=1`);
          if (!res.ok) return null;
          const json = await res.json();
          const arr = Array.isArray(json) ? json : json?.items || json?.results || [];
          const best = arr && arr[0] ? arr[0] : null;
          if (!best) return null;
          return {
            key: k,
            mpn: best.mpn || best.mpn_full_norm || k,
            offer_id: best.offer_id || best.listing_id,
            title: best.title || best.mpn || k.toUpperCase(),
            image_url: best.image_url,
            price: best.price_num ?? best.price,
          };
        } catch {
          return null;
        }
      })
    )
      .then((cards) => {
        if (cancelled) return;
        setRefurbCards(cards.filter(Boolean));
      })
      .finally(() => !cancelled && setRefurbLoading(false));

    return () => { cancelled = true; };
  }, [bulkReady, availableRows, bulk]);

  // Stable sort once: refurb presence influences order (refurb first among refurb-only rows)
  const availableRowsSorted = useMemo(() => {
    const arr = [...availableRows];
    arr.sort((a, b) => {
      const ar = !!(bulk[a.key]?.refurb?.price != null);
      const br = !!(bulk[b.key]?.refurb?.price != null);

      // Keep actual "new" rows ahead of "refurb-only" rows overall
      const ai = a.newPart ? 0 : 1;
      const bi = b.newPart ? 0 : 1;
      if (ai !== bi) return ai - bi;

      // Within each group, show ones that also have refurb available first
      if (ar !== br) return ar ? -1 : 1;
      return 0;
    });
    return arr;
  }, [availableRows, bulk]);

  const refurbCount = useMemo(() =>
    availableRows.reduce((acc, r) => acc + (bulk[r.key]?.refurb?.price != null ? 1 : 0), 0),
  [availableRows, bulk]);

  if (error) return <div className="text-red-600 text-center py-6">{error}</div>;
  if (!model) return null;

  return (
    <div className="w-[90%] mx-auto pb-12">
      {/* Breadcrumb */}
      <div className="w-full border-b border-gray-200 mb-4">
        <nav className="text-sm text-gray-600 py-2 w-full">
          <ul className="flex space-x-2">
            <li>
              <Link to="/" className="hover:underline text-blue-600">Home</Link>
              <span className="mx-1">/</span>
            </li>
            <li className="font-semibold text-black">
              {model.brand} {model.appliance_type} {model.model_number}
            </li>
          </ul>
        </nav>
      </div>

      {/* Header section */}
      <div className="border rounded p-2 flex items-center mb-4 gap-3 max-h-[100px] overflow-hidden">
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

        <div className="w-5/6 bg-gray-500/30 rounded p-2 flex items-center gap-3 overflow-hidden">
          <div className="w-1/3 leading-tight">
            <h2 className="text-sm font-semibold truncate">
              {model.brand} - {model.model_number} - {model.appliance_type}
            </h2>
            <p className="text-[11px] mt-1 text-gray-700">
              Known Parts: {parts.all.length} &nbsp;|&nbsp; Priced Parts: {parts.priced.length}
              {" "}|{" "}
              <span className="inline-block px-2 py-0.5 rounded bg-gray-900 text-white" title="Count of parts with at least one refurbished offer">
                Refurbished Parts: {refurbCount}
              </span>
            </p>
          </div>

          {/* Exploded views strip */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-2">
            {model.exploded_views?.map((view, idx) => (
              <div key={idx} className="w-24 shrink-0">
                <div className="border rounded p-1 bg-white hover:bg-gray-200 hover:border-gray-300 transition">{/* darker hover */}
                  <img
                    src={view.image_url}
                    alt={view.label}
                    className="w-full h-14 object-contain cursor-pointer hover:scale-[1.02] transition"
                    loading="lazy"
                    decoding="async"
                    onClick={() => setPopupImage(view.image_url)}
                    onError={(e) => (e.currentTarget.src = "/no-image.png")}
                  />
                  <p className="text-[10px] text-center mt-1 leading-tight truncate">{view.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Popup Image */}
      {popupImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">{/* darker overlay */}
          <button
            className="absolute top-4 right-4 bg-white/95 rounded px-3 py-1 text-sm shadow hover:bg-white"
            onClick={() => setPopupImage(null)}
          >
            ✕ Close
          </button>
          <img src={popupImage} alt="Popup" className="max-h-[90vh] max-w-[90vw] border-2 border-gray-300 shadow-xl" />
        </div>
      )}

      {/* Body */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Available Parts */}
        <div className="md:w-3/4">
          <h3 className="text-lg font-semibold mb-2">Available Parts</h3>

          {!bulkReady ? (
            <p className="text-gray-500">Loading…</p>
          ) : availableRowsSorted.length === 0 ? (
            <p className="text-gray-500 mb-6">No priced parts available for this model.</p>
          ) : (
            <div
              ref={availRootRef}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-1"
            >
              {availableRowsSorted.map(({ key, newPart, knownName }) => (
                <AvailCard
                  key={key}
                  normKey={key}
                  newPart={newPart}
                  knownName={knownName}
                  cmp={bulk[key] || null}
                  modelNumber={model.model_number}
                />
              ))}
            </div>
          )}

          {/* NEW: Refurbished Offers (cards) */}
          {bulkReady && refurbCards.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-md font-semibold">Refurbished Offers</h4>
                <span className="text-xs text-gray-600">{refurbCards.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {refurbCards.map((o) => (
                  <Link
                    key={`${o.key}-${o.offer_id}`}
                    to={`/refurb/${encodeURIComponent(o.mpn)}?offer=${encodeURIComponent(o.offer_id)}`}
                    className="flex gap-3 p-2 rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-200"
                  >
                    <img
                      src={o.image_url || "/no-image.png"}
                      alt={o.title}
                      className="w-16 h-16 object-contain bg-white rounded border border-gray-100"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = "/no-image.png"; }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{o.title}</div>
                      <div className="text-xs text-gray-600 truncate">{o.mpn}</div>
                      <div className="text-sm font-semibold text-gray-900">{formatPrice(o.price)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {refurbLoading && <p className="mt-2 text-xs text-gray-500">Loading refurbished offers…</p>}
        </div>

        {/* All Known Parts */}
        <div className="md:w-1/4">
          <h3 className="text-lg font-semibold mb-2">All Known Parts</h3>
          {allKnownOrdered.length === 0 ? (
            <p className="text-gray-500">No parts found for this model.</p>
          ) : (
            <div ref={knownRootRef} className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
              {allKnownOrdered.map((p, idx) => (
                <AllKnownRow
                  key={`${p.mpn || idx}`}
                  row={p}
                  priced={findPriced(parts.priced, p)}
                  cmp={bulk[extractKey(p)] || null}
                  modelNumber={model.model_number}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------------- subcomponents ---------------- */

function AvailCard({ normKey, newPart, knownName, cmp, modelNumber }) {
  const refurb = cmp?.refurb || {};
  const rel = cmp?.reliable || {};

  // refurb-only tile
  if (!newPart) {
    if (refurb.price == null) return null;

    const titleText = knownName || normKey.toUpperCase();
    const refurbMpn = refurb?.mpn || normKey.toUpperCase();

    let refurbBanner = "No new part available";
    if (rel?.price != null) {
      const isSpecial = String(rel?.stock_status || "").toLowerCase().includes("special");
      refurbBanner = isSpecial
        ? `New part can be special ordered for ${formatPrice({ price: rel.price })}`
        : `New part available for ${formatPrice({ price: rel.price })}`;
    }

    return (
      <div className="border rounded p-3 hover:shadow transition">
        <div className="flex gap-4 items-start">
          <div className="w-20 h-20 rounded bg-white flex items-center justify-center overflow-hidden">
            <div className="w-full h-full bg-gray-100 text-xs text-gray-500 flex items-center justify-center">
              MPN
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <Link
              to={`/refurb/${encodeURIComponent(refurbMpn)}`}
              state={{ fromModel: modelNumber }}
              className="font-semibold text-[15px] hover:underline line-clamp-2"
            >
              {`Refurbished: ${titleText}`}
            </Link>
            <div className="mt-0.5 text-[13px] text-gray-800">MPN: {refurbMpn}</div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">In stock</span>
              <span className="font-semibold">{formatPrice(refurb.price)}</span>
            </div>
          </div>
        </div>

        <span className="mt-2 inline-block rounded bg-red-600 text-white text-xs px-2 py-1">
          {refurbBanner}
        </span>
      </div>
    );
  }

  // new-part tile
  const rawMpn = extractRawMPN(newPart);
  const newPrice = numericPrice(newPart);

  return (
    <div className="border rounded p-3 hover:shadow transition">
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
            className="font-semibold text-[15px] hover:underline line-clamp-2"
          >
            {newPart.name || rawMpn}
          </Link>
          <div className="mt-0.5 text-[13px] text-gray-800">MPN: {rawMpn}</div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {stockBadge(newPart?.stock_status)}
            {newPrice != null ? <span className="font-semibold">{formatPrice(newPrice)}</span> : null}
          </div>

          {/* Refurb price "rides shotgun" — not a link, and cannot intercept clicks */}
          {cmp?.refurb?.price != null ? (
            <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 pointer-events-none">
              Refurbished available for {formatPrice(cmp.refurb.price)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AllKnownRow({ row, priced, cmp, modelNumber }) {
  const rawMpn = extractRawMPN(row);
  const price = priced ? numericPrice(priced) : null;
  const refurb = cmp?.refurb || {};

  return (
    <div className="border rounded p-3 hover:shadow transition">
      <div className="text-xs text-gray-500 mb-1">
        {row.sequence != null ? `Diagram #${row.sequence}` : "Diagram #–"}
      </div>

      <div className="text-sm font-medium line-clamp-2">{row.name || rawMpn}</div>
      <div className="mt-0.5 text-[13px] text-gray-800">MPN: {rawMpn}</div>

      <div className="text-xs text-gray-600 mt-1 flex items-center gap-2">
        {priced ? stockBadge(priced?.stock_status) : stockBadge("unavailable")}
        {price != null ? <span className="font-semibold">{formatPrice(price)}</span> : null}
      </div>

      {/* Only the refurb-only CTA links to refurb page here */}
      {refurb.price != null && !priced ? (
        <Link
          to={`/refurb/${encodeURIComponent(rawMpn)}`}
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
  const key = extractKey(row);
  if (!key) return null;
  for (const p of pricedList || []) {
    if (extractKey(p) === key) return p;
  }
  return null;
}

export default ModelPage;


