import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCart } from "./context/CartContext";

const BASE_URL = import.meta.env.VITE_API_URL;
const AVAIL_URL = import.meta.env.VITE_AVAIL_URL; // inventory service

const DEFAULT_QTY = 1;
const QTY_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);
const FALLBACK_IMG =
  "https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg";

/** helpers **/
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
  if (/special/.test(s))
    return <span className="text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white">Special order</span>;
  if (/unavailable|out\s*of\s*stock|ended/.test(s))
    return <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">Unavailable</span>;
  if (/(^|\s)in\s*stock(\s|$)|\bavailable\b/.test(s))
    return <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">In stock</span>;
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

  // inventory panel
  const [invOpen, setInvOpen] = useState(false);
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState(null);
  const [invRows, setInvRows] = useState([]);

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

        // Related (priority 1: other priced parts for THIS model)
        let finalRelated = [];
        if (partData?.model_number) {
          const relRes = await fetch(
            `${BASE_URL}/api/parts/for-model/${encodeURIComponent(partData.model_number)}`
          );
          const relData = await relRes.json();
          const priced = Array.isArray(relData?.priced) ? relData.priced : [];
          finalRelated = priced
            .filter(
              (p) =>
                (p?.image_url || p?.image_key) &&
                (p?.mpn || "").toString().trim() !== (partData?.mpn || "").toString().trim()
            )
            .sort((a, b) => (priceNumber(b) ?? 0) - (priceNumber(a) ?? 0))
            .slice(0, 6);
        }

        // Fallback (priority 2): suggest-like by similar MPN prefix
        if (finalRelated.length === 0 && (partData?.mpn || partData?.mpn_raw)) {
          const norm = normalize(partData.mpn || partData.mpn_raw);
          const prefix = norm.slice(0, 6);
          try {
            const sRes = await fetch(
              `${BASE_URL}/api/suggest/parts?q=${encodeURIComponent(prefix)}&limit=12`
            );
            const sData = await sRes.json();
            const items = Array.isArray(sData?.results) ? sData.results : Array.isArray(sData) ? sData : [];
            finalRelated = items
              .filter((p) => (p?.image_url || p?.image_key) && normalize(p?.mpn || "") !== normalize(partData?.mpn || ""))
              .slice(0, 6);
          } catch {
            /* ignore fallback errors */
          }
        }

        setRelated(finalRelated);
      } catch (e) {
        console.error(e);
        setError("Error loading part details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [routeMpn]);

  const price = useMemo(() => priceNumber(part), [part]);
  const isInStock = useMemo(() => {
    const s = String(part?.stock_status || "").toLowerCase();
    return /(in\s*stock|available)/.test(s);
  }, [part]);

  const handleAdd = () => {
    if (!part) return;
    addToCart({ mpn: part.mpn || routeMpn, name: part.name || part.mpn || routeMpn, price: price ?? 0, qty });
  };

  const handleBuyNow = () => {
    if (!part) return;
    buyNow({ mpn: part.mpn || routeMpn, name: part.name || part.mpn || routeMpn, price: price ?? 0, qty });
  };

  const handlePickup = () => {
    navigate(`/pickup?mpn=${encodeURIComponent(part?.mpn || routeMpn)}`);
  };

  // ---------- INVENTORY: POST JSON (HTTPS) ----------
  const handleCheckInventory = async () => {
    const safeAvail = (AVAIL_URL || "").replace("http://", "https://");
    if (!safeAvail) {
      setInvError("Inventory service unavailable.");
      setInvOpen(true);
      return;
    }
    try {
      setInvLoading(true);
      setInvError(null);
      setInvOpen(true);

      const payload = {
        partNumber: part?.mpn || routeMpn,
        postalCode: "10001", // TODO: plug in shopper ZIP if you collect it
        quantity: qty || 1,
      };

      const r = await fetch(`${safeAvail}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) throw new Error(`Inventory request failed: ${r.status}`);
      const data = await r.json();
      const rows = Array.isArray(data?.locations) ? data.locations : Array.isArray(data) ? data : [];
      setInvRows(rows);
    } catch (e) {
      console.error(e);
      setInvError("No live inventory returned.");
      setInvRows([]);
    } finally {
      setInvLoading(false);
    }
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
          <Link to={`/model?model=${encodeURIComponent(part.model_number)}`} className="text-blue-600 hover:underline">
            {part.model_number}
          </Link>
        ) : null}
        <span className="mx-1">/</span>
        <span className="font-semibold">{part.mpn || routeMpn}</span>
      </div>

      {/* Top area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: primary image with overlaid brand logo */}
        <div className="md:col-span-1 relative">
          {brandLogo ? (
            <img
              src={brandLogo}
              alt="Brand"
              className="absolute left-3 top-3 h-12 md:h-16 lg:h-20 opacity-95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)] pointer-events-none select-none"
              loading="eager"
            />
          ) : null}
          <div className="border rounded p-3 bg-white flex items-center justify-center min-h-[260px]">
            <img
              src={part.image_url || FALLBACK_IMG}
              alt={part.name || part.mpn || "Part image"}
              className="max-h-[320px] object-contain"
              loading="eager"
              decoding="async"
              onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
            />
          </div>
        </div>

        {/* Middle: details/CTA + fit checker locked to its own row */}
        <div className="md:col-span-1">
          <h1 className="text-xl font-semibold leading-snug">{part.name || (part.mpn || routeMpn)}</h1>
          <div className="mt-1 text-sm text-gray-800">MPN: {part.mpn || routeMpn}</div>
          <div className="mt-2 flex items-center gap-2">
            {badge(part?.stock_status)}
            {price != null ? <span className="text-lg font-semibold">{money(price)}</span> : null}
          </div>

          {/* Make this column a one-column grid so every section becomes a new row. */}
          <div className="mt-4 grid grid-cols-1 gap-4">
            {/* Qty + buttons */}
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                Qty
                <select className="ml-2 border rounded px-2 py-1" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                  {QTY_OPTIONS.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </label>

              <button onClick={handleAdd} className="px-4 py-2 rounded bg-gray-900 text-white hover:bg-black transition">
                Add to Cart
              </button>
              <button onClick={handleBuyNow} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition">
                Buy Now
              </button>

              {price != null && isInStock ? (
                <button
                  onClick={handlePickup}
                  className="px-4 py-2 rounded border border-gray-300 text-gray-900 hover:bg-gray-50 transition"
                >
                  Pick up at Distribution Center
                </button>
              ) : null}

              <button
                onClick={handleCheckInventory}
                className="px-4 py-2 rounded border border-gray-300 text-gray-900 hover:bg-gray-50 transition"
              >
                Check Inventory
              </button>
            </div>

            {/* Inventory panel */}
            {invOpen && (
              <div className="border rounded p-3 bg-gray-50">
                <div className="text-sm font-medium mb-2">Nearby Inventory</div>
                {invLoading ? (
                  <div className="text-sm text-gray-600">Checking…</div>
                ) : invError ? (
                  <div className="text-sm text-red-600">{invError}</div>
                ) : invRows.length === 0 ? (
                  <div className="text-sm text-gray-600">No locations returned.</div>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {invRows.map((r, i) => (
                      <li key={i} className="flex justify-between border-b last:border-b-0 py-1">
                        <span className="truncate">{r.name || r.location || "Location"}</span>
                        <span className="ml-2">{r.qty ?? r.quantity ?? "-"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Fit checker — **always** its own row */}
            <div className="w-full">
              <h3 className="text-lg font-semibold mb-2">Does this fit my model?</h3>
              <FitChecker />
            </div>

            {/* Replaces previous parts */}
            {Array.isArray(part?.replaces_previous_parts) && part.replaces_previous_parts.length > 0 ? (
              <div className="bg-gray-100 border border-gray-200 rounded p-3">
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
        </div>

        {/* Right: other available products */}
        <div className="md:col-span-1">
          <h3 className="text-lg font-semibold mb-2">Other Available Products</h3>
          <div ref={rightColRef} className="border rounded p-2 max-h-[420px] overflow-y-auto space-y-3">
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
                    <div className="text-sm font-medium line-clamp-2">{p.name || p.mpn || ""}</div>
                    <div className="text-xs text-gray-700 mt-0.5">MPN: {p.mpn}</div>
                    <div className="text-sm font-semibold mt-0.5">{money(priceNumber(p))}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
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
      <button onClick={onCheck} className="px-4 py-2 rounded bg-gray-900 text-white hover:bg-black transition">
        Check
      </button>

      <div className="min-h-[28px] text-sm text-gray-700 sm:ml-3">
        {loading ? (
          "Checking…"
        ) : res?.model_number ? (
          <Link to={`/model?model=${encodeURIComponent(res.model_number)}`} className="text-blue-600 hover:underline">
            View model {res.model_number}
          </Link>
        ) : res?.error ? (
          <span className="text-red-600">{res.error}</span>
        ) : null}
      </div>
    </div>
  );
}


