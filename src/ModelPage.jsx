import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import PartImage from "./components/PartImage";

const API_BASE = import.meta.env.VITE_API_URL;

/* ---------------- helpers ---------------- */
const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

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
    return "$" + Number(n).toFixed(2);
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

/** Build candidate keys for matching a bulk record for this part key */
function candidateKeyVariants(k, pricedMap, allKnownMap) {
  const out = new Set();

  out.add(k);
  out.add(k.toLowerCase());
  out.add(k.toUpperCase());

  const fromPriced = pricedMap.get(k);
  const rawFromPriced = fromPriced ? extractRawMPN(fromPriced) : null;
  const fromKnown = allKnownMap.get(k);
  const rawFromKnown = fromKnown ? extractRawMPN(fromKnown) : null;

  const addRawForms = (raw) => {
    if (!raw) return;
    const r = String(raw).trim();
    const dashy = r
      .replace(/\s+/g, "")
      .replace(/[^A-Za-z0-9]/g, (m) => (m === "-" ? "-" : ""));
    const stripped = r.replace(/[^A-Za-z0-9]/g, "");
    out.add(r);
    out.add(r.toUpperCase());
    out.add(r.toLowerCase());
    out.add(dashy);
    out.add(dashy.toUpperCase());
    out.add(dashy.toLowerCase());
    out.add(stripped);
    out.add(stripped.toUpperCase());
    out.add(stripped.toLowerCase());
    out.add(normalize(r));
  };

  addRawForms(rawFromPriced);
  addRawForms(rawFromKnown);

  return Array.from(out).filter(Boolean);
}

function matchBulkForKey(bulk, k, pricedMap, allKnownMap) {
  if (!bulk) return null;
  const candidates = candidateKeyVariants(k, pricedMap, allKnownMap);
  if (bulk[k]) return bulk[k];
  for (const c of candidates) {
    if (bulk[c]) return bulk[c];
    const hit = Object.prototype.hasOwnProperty.call(bulk, c)
      ? bulk[c]
      : bulk[
          Object.keys(bulk).find(
            (bk) => String(bk).toLowerCase() === String(c).toLowerCase()
          )
        ];
    if (hit) return hit;
  }
  return null;
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
  const location = useLocation();
  const modelNumber = searchParams.get("model") || "";
  const DEBUG = searchParams.get("debug") === "1";

  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], all: [] });
  const [brandLogos, setBrandLogos] = useState([]);
  const [refurbParts, setRefurbParts] = useState([]); // ✅ new
  const [popupImage, setPopupImage] = useState(null);
  const [error, setError] = useState(null);

  const [bulk, setBulk] = useState({});
  const [bulkReady, setBulkReady] = useState(false);

  const availRootRef = useRef(null);
  const knownRootRef = useRef(null);

  useEffect(() => {
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

    const fetchRefurbParts = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/refurb/for-model/${encodeURIComponent(modelNumber)}`
        );
        if (!res.ok) throw new Error("Failed to fetch refurb parts");
        const data = await res.json();
        setRefurbParts(Array.isArray(data.refurb_parts) ? data.refurb_parts : []);
      } catch (err) {
        console.error("❌ Error loading refurb parts:", err);
        setRefurbParts([]);
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
      fetchModel();
      fetchParts();
      fetchRefurbParts(); // ✅ new call
      fetchBrandLogos();
    }

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

  const pricedMap = useMemo(() => {
    const m = new Map();
    for (const p of parts.priced || []) {
      const k = extractKey(p);
      if (k) m.set(k, p);
    }
    return m;
  }, [parts.priced]);

  const allKnownMap = useMemo(() => {
    const m = new Map();
    for (const r of allKnownOrdered) {
      const k = extractKey(r);
      if (k && !m.has(k)) m.set(k, r);
    }
    return m;
  }, [allKnownOrdered]);

  const candidateKeys = useMemo(() => {
    const set = new Set([...pricedMap.keys(), ...allKnownMap.keys()]);
    return Array.from(set);
  }, [pricedMap, allKnownMap]);

  useEffect(() => {
    if (!candidateKeys.length) {
      setBulkReady(true);
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/compare/xmarket/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys: candidateKeys }),
        });
        const data = await r.json();
        setBulk(normalizeBulkResponse(data));
      } catch (e) {
        console.warn("bulk compare failed", e);
        setBulk({});
      } finally {
        setBulkReady(true);
      }
    })();
  }, [candidateKeys]);

  const tiles = useMemo(() => {
    const out = [];
    for (const k of candidateKeys) {
      const newPart = pricedMap.get(k) || null;
      const cmp = matchBulkForKey(bulk, k, pricedMap, allKnownMap);
      if (newPart) out.push({ type: "new", key: k, newPart, cmp });
      const refurb = cmp && getRefurb(cmp);
      if (refurb && refurb.price != null) {
        const knownName =
          newPart?.name || allKnownMap.get(k)?.name || null;
        out.push({ type: "refurb", key: k, newPart, knownName, cmp });
      }
    }
    return out;
  }, [candidateKeys, pricedMap, allKnownMap, bulk]);

  const tilesSorted = useMemo(() => {
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
  }, [tiles]);

  const refurbCount = useMemo(
    () =>
      refurbParts.length > 0
        ? refurbParts.length
        : tiles.filter((t) => t.type === "refurb").length,
    [tiles, refurbParts]
  );

  if (error) return <div className="text-red-600 text-center py-6">{error}</div>;
  if (!model) return null;

  return (
    <div className="w-[90%] mx-auto pb-12">
      {/* Header */}
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
              Known Parts: {parts.all.length} &nbsp;|&nbsp; Priced Parts:{" "}
              {parts.priced.length} |{" "}
              <span className="inline-block px-2 py-0.5 rounded bg-gray-900 text-white">
                Refurbished Parts: {bulkReady ? refurbCount : "…"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Available Parts */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-3/4">
          <h3 className="text-lg font-semibold mb-2">Available Parts</h3>

          {!bulkReady ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <div
              ref={availRootRef}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-1"
            >
              {/* ✅ Refurb parts from backend first */}
              {refurbParts.length > 0 &&
                refurbParts.map((r, idx) => (
                  <div
                    key={`refurb-api-${idx}`}
                    className="border rounded p-3 hover:shadow transition"
                  >
                    <div className="flex gap-4 items-start">
                      <div className="w-20 h-20 rounded bg-white flex items-center justify-center overflow-hidden">
                        <img
                          src={r.image_url || "/no-image.png"}
                          alt={r.mpn}
                          className="object-contain w-full h-full"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/refurb/${encodeURIComponent(
                            r.mpn
                          )}?offer=${encodeURIComponent(r.listing_id)}`}
                          state={{ fromModel: model.model_number }}
                          className="font-semibold text-[15px] hover:underline line-clamp-2"
                        >
                          {r.title || `Refurbished ${r.mpn}`}
                        </Link>
                        <div className="mt-0.5 text-[13px] text-gray-800">
                          MPN: {r.mpn}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {stockBadge(r.stock_status)}
                          {r.price != null && (
                            <span className="font-semibold">
                              {formatPrice(r.price)}
                            </span>
                          )}
                        </div>
                        {r.seller_name && (
                          <div className="mt-1 text-xs text-gray-500">
                            Seller: {r.seller_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

              {/* Existing OEM + bulk refurb */}
              {tilesSorted.map((t) =>
                t.type === "refurb" ? (
                  <RefurbCard
                    key={`ref-${t.key}`}
                    normKey={t.key}
                    knownName={t.knownName}
                    cmp={t.cmp}
                    newPart={t.newPart}
                    modelNumber={model.model_number}
                  />
                ) : (
                  <NewCard
                    key={`new-${t.key}`}
                    normKey={t.key}
                    newPart={t.newPart}
                    modelNumber={model.model_number}
                  />
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelPage;
