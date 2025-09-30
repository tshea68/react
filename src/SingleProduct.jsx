import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCart } from "./context/CartContext";

const BASE_URL = import.meta.env.VITE_API_URL;
const AVAIL_URL = import.meta.env.VITE_AVAIL_URL; // if you keep it; otherwise unused

const DEFAULT_QTY = 1;
const QTY_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);
const FALLBACK_IMG =
  "https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg";

/** Safe helpers **/
const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

const priceNumber = (p) => {
  const n =
    p?.price_num ??
    p?.price_numeric ??
    (typeof p?.price === "number"
      ? p.price
      : Number(String(p?.price || "").replace(/[^0-9.]/g, "")));
  return Number.isFinite(Number(n)) ? Number(n) : null;
};

const money = (v, curr = "USD") => {
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

const badge = (raw) => {
  const s = String(raw || "").toLowerCase();
  if (/special/.test(s)) return <span className="text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white">Special order</span>;
  if (/unavailable|out\s*of\s*stock|ended/.test(s)) return <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">Unavailable</span>;
  if (/(^|\s)in\s*stock(\s|$)|\bavailable\b/.test(s)) return <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">In stock</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">Unavailable</span>;
};

export default function SingleProduct() {
  const { mpn: routeMpn } = useParams();
  const navigate = useNavigate();
  const { addToCart, buyNow } = useCart();

  const [loading, setLoading] = useState(true);
  const [part, setPart] = useState(null);
  const [brandLogo, setBrandLogo] = useState(null);
  const [related, setRelated] = useState([]);
  const [qty, setQty] = useState(DEFAULT_QTY);
  const [error, setError] = useState(null);

  const rightColRef = useRef(null);

  // Load part + related
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const detailRes = await fetch(`${BASE_URL}/api/parts/${encodeURIComponent(routeMpn)}`);
        if (!detailRes.ok) throw new Error("Failed to fetch part");
        const partData = await detailRes.json();

        setPart(partData || null);

        // Brand logo via dedicated table
        if (partData?.brand) {
          const logosRes = await fetch(`${BASE_URL}/api/brand-logos`);
          const all = await logosRes.json();
          const list = Array.isArray(all) ? all : all?.logos || [];
          const hit = list.find((b) => normalize(b.name) === normalize(partData.brand));
          setBrandLogo(hit?.image_url || hit?.url || hit?.logo_url || hit?.src || null);
        } else {
          setBrandLogo(null);
        }

        // Related (top 6 priced with images)
        if (partData?.model_number) {
          const relRes = await fetch(`${BASE_URL}/api/parts/for-model/${encodeURIComponent(partData.model_number)}`);
          const relData = await relRes.json();
          const priced = Array.isArray(relData?.priced) ? relData.priced : [];
          const cleaned = priced
            .filter((p) => p?.image_url || p?.image_key)
            .sort((a, b) => (priceNumber(b) ?? 0) - (priceNumber(a) ?? 0))
            .slice(0, 6);
          setRelated(cleaned);
        } else {
          setRelated([]);
        }
      } catch (e) {
        console.error(e);
        setError("Error loading part details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [routeMpn]);

  const price = useMemo(() => priceNumber(part), [part]);

  const handleAdd = () => {
    if (!part) return;
    addToCart({
      mpn: part.mpn || routeMpn,
      name: part.name || (part.mpn || routeMpn),
      price: price ?? 0,
      qty,
    });
  };

  const handleBuyNow = () => {
    if (!part) return;
    buyNow({
      mpn: part.mpn || routeMpn,
      name: part.name || (part.mpn || routeMpn),
      price: price ?? 0,
      qty,
    });
  };

  if (loading) return <div className="w-[90%] mx-auto py-8 text-gray-600">Loading…</div>;
  if (error) return <div className="w-[90%] mx-auto py-8 text-red-600">{error}</div>;
  if (!part) return null;

  return (
    <div className="w-[90%] mx-auto py-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-600 mb-4">
        <Link to="/" className="text-blue-600 hover:underline">Home</Link>
        <span className="mx-1">/</span>
        {part.brand ? <span>{part.brand}</span> : null}
        {part.appliance_type ? <span className="mx-1">/</span> : null}
        {part.appliance_type ? <span>{part.appliance_type}</span> : null}
        {part.model_number ? <span className="mx-1">/</span> : null}
        {part.model_number ? (
          <Link
            to={`/model?model=${encodeURIComponent(part.model_number)}`}
            className="text-blue-600 hover:underline"
          >
            {part.model_number}
          </Link>
        ) : null}
        <span className="mx-1">/</span>
        <span className="font-semibold">{part.mpn || routeMpn}</span>
      </div>

      {/* Top area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: image */}
        <div className="md:col-span-1">
          <div className="border rounded p-3 bg-white flex items-center justify-center min-h-[260px]">
            <img
              src={part.image_url || FALLBACK_IMG}
              alt={part.name || part.mpn || "Part image"}
              className="max-h-[320px] object-contain"
              loading="lazy"
              decoding="async"
              onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
            />
          </div>
          {brandLogo ? (
            <div className="mt-3 flex items-center justify-center">
              <img src={brandLogo} alt="Brand" className="h-10 object-contain" loading="lazy" />
            </div>
          ) : null}
        </div>

        {/* Middle: details + buttons */}
        <div className="md:col-span-1">
          <h1 className="text-xl font-semibold leading-snug">{part.name || (part.mpn || routeMpn)}</h1>
          <div className="mt-1 text-sm text-gray-800">MPN: {part.mpn || routeMpn}</div>
          <div className="mt-2 flex items-center gap-2">
            {badge(part?.stock_status)}
            {price != null ? <span className="text-lg font-semibold">{money(price)}</span> : null}
          </div>

          {/* Qty + Buttons */}
          <div className="mt-4 flex items-end gap-3">
            <label className="text-sm">
              Qty
              <select
                className="ml-2 border rounded px-2 py-1"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              >
                {QTY_OPTIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </label>

            <button
              onClick={handleAdd}
              className="px-4 py-2 rounded bg-gray-900 text-white hover:bg-black transition"
            >
              Add to Cart
            </button>
            <button
              onClick={handleBuyNow}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Buy Now
            </button>
          </div>

          {/* Replaces previous parts — plain black text on light gray */}
          {Array.isArray(part?.replaces_previous_parts) && part.replaces_previous_parts.length > 0 ? (
            <div className="mt-5 bg-gray-100 border border-gray-200 rounded p-3">
              <div className="text-sm font-medium mb-1">Parts Replaced</div>
              <div className="text-sm text-black flex flex-wrap gap-2">
                {part.replaces_previous_parts.map((r, i) => (
                  <span key={i} className="px-2 py-0.5 bg-white border border-gray-300 rounded">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right: other available products (scrolling column) */}
        <div className="md:col-span-1">
          <h3 className="text-lg font-semibold mb-2">Other Available Products</h3>
          <div
            ref={rightColRef}
            className="border rounded p-2 max-h-[420px] overflow-y-auto space-y-3"
          >
            {related.length === 0 ? (
              <div className="text-sm text-gray-600">No other priced items found.</div>
            ) : (
              related.map((p, idx) => (
                <Link
                  key={idx}
                  to={`/parts/${encodeURIComponent(p.mpn || p.mpn_raw || p.part_number || "")}`}
                  className="flex gap-3 items-start border rounded p-2 hover:shadow transition"
                >
                  <img
                    src={p.image_url || FALLBACK_IMG}
                    alt={p.name || p.mpn}
                    className="w-16 h-16 object-contain"
                    onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium line-clamp-2">{p.name || (p.mpn || "")}</div>
                    <div className="text-xs text-gray-700 mt-0.5">MPN: {p.mpn}</div>
                    <div className="text-sm font-semibold mt-0.5">{money(priceNumber(p))}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Fit checker */}
      <div className="mt-8 border-t pt-6">
        <h3 className="text-lg font-semibold mb-2">Does this fit my model?</h3>
        <FitChecker />
      </div>
    </div>
  );
}

/* --- tiny fit checker (client-only) --- */
function FitChecker() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);

  const onCheck = async () => {
    if (!q.trim()) return;
    try {
      setLoading(true);
      setRes(null);
      // very lightweight: attempt to fetch model + some parts (truthy = exists)
      const url = `${BASE_URL}/api/models/search?q=${encodeURIComponent(q.trim())}`;
      const r = await fetch(url);
      const data = await r.json();
      setRes(data && data.model_number ? data : { error: "Model not found" });
    } catch (e) {
      setRes({ error: "Lookup failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
      <div className="flex-1">
        <label className="text-sm block mb-1">Enter your model number</label>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="e.g. GFD55ESSN0WW"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <button
        onClick={onCheck}
        className="px-4 py-2 rounded bg-gray-900 text-white hover:bg-black transition"
      >
        Check
      </button>

      <div className="min-h-[28px] text-sm text-gray-700 sm:ml-3">
        {loading ? "Checking…" : res?.model_number ? (
          <Link
            to={`/model?model=${encodeURIComponent(res.model_number)}`}
            className="text-blue-600 hover:underline"
          >
            View model {res.model_number}
          </Link>
        ) : res?.error ? (
          <span className="text-red-600">{res.error}</span>
        ) : null}
      </div>
    </div>
  );
}


