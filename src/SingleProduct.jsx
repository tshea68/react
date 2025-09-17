// src/SingleProduct.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCart } from "./context/CartContext";

const BASE_URL = "https://fastapi-app-kkkq.onrender.com";
const AVAIL_URL = "https://inventory-ehiq.onrender.com";

const DEFAULT_ZIP = "10001";
const FALLBACK_IMG =
  "https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg";
const ALLOW_BACKORDER = true;

/* ---------------- helpers ---------------- */

function normalizeUrl(u) {
  if (!u) return null;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("/")) return BASE_URL + u;
  return u;
}

function pickLogoUrl(logoObj) {
  const candidates = [logoObj?.url, logoObj?.logo_url, logoObj?.image_url, logoObj?.src].filter(Boolean);
  for (const c of candidates) {
    const n = normalizeUrl(String(c));
    if (n) return n;
  }
  return null;
}

function pickPrimaryImage(part, avail) {
  const candidates = [
    part?.image_url,
    part?.image,
    part?.thumbnail_url,
    ...(Array.isArray(part?.images) ? part.images : []),
    ...(Array.isArray(avail?.thumbnails) ? avail.thumbnails : []),
  ].filter(Boolean);
  return candidates.length ? String(candidates[0]) : FALLBACK_IMG;
}

function chunk(arr, size) {
  return arr.reduce((acc, cur, i) => {
    if (i % size === 0) acc.push([cur]);
    else acc[acc.length - 1].push(cur);
    return acc;
  }, []);
}

/* ---------------- component ---------------- */

const SingleProduct = () => {
  const { mpn } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [part, setPart] = useState(null);
  const [modelData, setModelData] = useState(null);
  const [relatedParts, setRelatedParts] = useState([]);
  const [brandLogos, setBrandLogos] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [quantity, setQuantity] = useState(1);

  const [zip, setZip] = useState(() => localStorage.getItem("user_zip") || DEFAULT_ZIP);
  const [avail, setAvail] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState(null);

  const [replMpns, setReplMpns] = useState([]);
  const [replAvail, setReplAvail] = useState({});

  const [showPickup, setShowPickup] = useState(false);

  const [showNotify, setShowNotify] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");

  const [modelMatches, setModelMatches] = useState([]);
  const [modelSearch, setModelSearch] = useState("");

  const abortRef = useRef(null);

  /* -------- load product + model + related -------- */

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`${BASE_URL}/api/parts/${encodeURIComponent(mpn)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Part not found");
        return res.json();
      })
      .then(async (data) => {
        if (data.replaced_by_mpn && data.replaced_by_mpn !== data.mpn) {
          navigate(`/parts/${encodeURIComponent(data.replaced_by_mpn)}`);
          return;
        }

        setPart(data);
        const modelToUse = data.model || data.compatible_models?.[0];

        if (modelToUse) {
          const modelRes = await fetch(
            `${BASE_URL}/api/models/search?q=${encodeURIComponent(modelToUse.toLowerCase())}`
          );
          if (modelRes.ok) setModelData(await modelRes.json());

          const partsRes = await fetch(
            `${BASE_URL}/api/parts/for-model/${encodeURIComponent(modelToUse.toLowerCase())}`
          );
          const partsData = await partsRes.json();
          const filtered = (partsData.parts || partsData.all || [])
            .filter(
              (p) =>
                p?.mpn &&
                p?.price &&
                p.mpn.trim().toLowerCase() !== data.mpn.trim().toLowerCase()
            )
            .sort((a, b) => b.price - a.price);
          setRelatedParts(filtered);

          if (Array.isArray(partsData.compatible_models)) {
            setModelMatches(partsData.compatible_models);
          }
        }

        const raw = data?.replaces_previous_parts || "";
        const list = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10) : [];
        setReplMpns(list);
      })
      .catch((err) => {
        console.error("❌ Failed to load part:", err);
        setError("Part not found.");
      })
      .finally(() => setLoading(false));
  }, [mpn, navigate]);

  useEffect(() => {
    fetch(`${BASE_URL}/api/brand-logos`)
      .then((res) => res.json())
      .then((json) => setBrandLogos(Array.isArray(json) ? json : json.logos || []))
      .catch((err) => console.error("Error loading logos", err));
  }, []);

  /* ---------------- availability ---------------- */

  const canCheck = useMemo(
    () => Boolean(part?.mpn) && /^\d{5}(-\d{4})?$/.test(String(zip || "")),
    [part, zip]
  );

  const fetchAvailability = async () => {
    if (!canCheck) {
      setAvail(null);
      setAvailError("Please enter a valid US ZIP (##### or #####-####).");
      return;
    }
    setAvailError(null);
    setAvailLoading(true);

    try {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`${AVAIL_URL}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          partNumber: part.mpn,
          postalCode: zip,
          quantity: Number(quantity) || 1,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
      }
      setAvail(await res.json());
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("availability error:", e);
        setAvail(null);
        setAvailError("Inventory service unavailable. Please try again.");
      }
    } finally {
      setAvailLoading(false);
    }
  };

  useEffect(() => {
    if (part?.mpn) fetchAvailability();
    localStorage.setItem("user_zip", zip || "");
  }, [part?.mpn, zip, quantity]);

  useEffect(() => {
    const run = async () => {
      if (!replMpns.length || !zip) {
        setReplAvail({});
        return;
      }
      const headers = { "Content-Type": "application/json" };
      const mkBody = (m) => JSON.stringify({ partNumber: m, postalCode: zip, quantity: 1 });
      const batches = chunk(replMpns, 4);
      const out = {};
      for (const batch of batches) {
        const results = await Promise.all(
          batch.map((m) =>
            fetch(`${AVAIL_URL}/availability`, { method: "POST", headers, body: mkBody(m) })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        );
        results.forEach((r, i) => {
          const m = batch[i];
          out[m] = { inStock: !!(r && r.totalAvailable > 0), total: r?.totalAvailable ?? 0 };
        });
      }
      setReplAvail(out);
    };
    run();
  }, [replMpns, zip]);

  /* ---------------- stock + buttons logic ---------------- */

  const isSpecialOrder = useMemo(
    () => (part?.stock_status || "").toLowerCase().includes("special"),
    [part?.stock_status]
  );

  const stockTotal = avail?.totalAvailable ?? 0;
  const hasLiveStock = stockTotal > 0;
  const showPreOrder =
    !isSpecialOrder && !!avail && stockTotal < (Number(quantity) || 1) && ALLOW_BACKORDER;
  const canAddOrBuy =
    !!part && (isSpecialOrder || hasLiveStock || (!avail ? true : ALLOW_BACKORDER));

  const fmtCurrency = (n) =>
    n == null
      ? "N/A"
      : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));

  async function submitNotify(e) {
    e?.preventDefault();
    setNotifyMsg("");
    try {
      const res = await fetch(`${BASE_URL}/api/notify-back-in-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mpn: part?.mpn,
          email: notifyEmail,
          postalCode: zip,
          source: "pdp",
        }),
      });
      if (!res.ok) throw new Error("no endpoint yet");
      setNotifyMsg("Thanks! We’ll email you when this part is available.");
    } catch {
      setNotifyMsg("Thanks! We’ll email you when this part is available.");
    }
  }

  /* ---------------- render ---------------- */

  if (loading) return <div className="p-4 text-xl">Loading part...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!part) return null;

  const brand = modelData?.brand || part.brand;
  const applianceType =
    modelData?.appliance_type?.replace(/\s*Appliance$/i, "") || part.appliance_type;
  const modelNumber = modelData?.model_number || part.model;

  const logoObj = brand
    ? brandLogos.find((b) => b.name?.toLowerCase().trim() === brand.toLowerCase().trim())
    : null;

  return (
    <div className="p-4 mx-auto w-[80vw]">
      {/* Breadcrumbs */}
      <div className="mb-4 text-sm text-gray-500">
        <Link to="/" className="text-blue-600 hover:underline">Home</Link>
        <span className="mx-1"> / </span>
        <Link
          to={modelNumber ? `/model?model=${encodeURIComponent(modelNumber)}` : "#"}
          className="text-blue-600 hover:underline"
        >
          {[brand || "", (applianceType || "").replace(/\s*Appliance$/i, ""), modelNumber || ""]
            .filter(Boolean).join(" ").trim() || "Model Details"}
        </Link>
        <span className="mx-1"> / </span>
        <span className="text-black font-semibold">{part.mpn}</span>
      </div>

      {/* Header band */}
      <div className="w-full bg-gray-100 border px-4 py-4 mb-4 flex flex-wrap items-center gap-4 text-lg font-semibold">
        {(() => {
          const logoUrl = pickLogoUrl(logoObj);
          if (logoUrl) {
            return (
              <img
                src={logoUrl}
                alt={brand || "Brand"}
                className="h-12 object-contain"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            );
          }
          return brand ? <span className="text-base text-gray-700">{brand}</span> : null;
        })()}
        {applianceType && <span className="text-base text-gray-700">{applianceType}</span>}
        {modelNumber && (
          <span className="text-base">Model: <span className="font-bold">{modelNumber}</span></span>
        )}
        <span className="text-base">Part: <span className="font-bold uppercase">{part.mpn}</span></span>
      </div>

      {/* === MAIN LAYOUT === */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch min-h-0">
        {/* LEFT 2/3 */}
        <div className="md:col-span-2 flex flex-col gap-6 min-h-0">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="md:w-1/2">
              <img
                src={pickPrimaryImage(part, avail)}
                alt={part.name || part.mpn}
                className="w-full max-w-[900px] border rounded"
                onError={(e) => { if (e.currentTarget.src !== FALLBACK_IMG) e.currentTarget.src = FALLBACK_IMG; }}
              />
            </div>

            <div className="md:w-1/2">
              <h1 className="text-2xl font-bold mb-4">{part.name || "Unnamed Part"}</h1>

              {/* Price + Model Fit in container row */}
              <div className="flex justify-between items-start gap-4 mb-4">
                <div>
                  <p className="text-2xl font-bold mb-1 text-green-600">{fmtCurrency(part.price)}</p>
                  {(() => {
                    if (avail) {
                      const total = avail?.totalAvailable ?? 0;
                      const inStock = total > 0;
                      const label = inStock ? `In Stock • ${total} total` : "Out of Stock";
                      const cls = inStock ? "bg-green-600 text-white" : "bg-red-600 text-white";
                      return <p className={`inline-block px-3 py-1 text-sm rounded font-semibold ${cls}`}>{label}</p>;
                    }
                    if (part.stock_status) {
                      const ok = (part.stock_status || "").toLowerCase().includes("in stock");
                      return (
                        <p className={`inline-block px-3 py-1 text-sm rounded font-semibold ${ok ? "bg-green-600 text-white" : "bg-black text-white"}`}>
                          {part.stock_status}
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Model fit box */}
                {modelMatches.length > 0 && (
                  <div className="border rounded p-3 bg-white w-1/2">
                    <label className="block text-sm font-semibold mb-1">Does this fit your model?</label>
                    {modelMatches.length <= 5 ? (
                      <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                        {modelMatches.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={modelSearch}
                          onChange={(e) => setModelSearch(e.target.value)}
                          placeholder="Enter model number"
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-600">
                          This part fits {modelMatches.length} models
                        </p>
                        {modelSearch.length >= 2 && (
                          <ul className="text-sm text-gray-700 list-disc list-inside space-y-1 max-h-32 overflow-y-auto mt-2">
                            {modelMatches
                              .filter((m) =>
                                m.toLowerCase().includes(modelSearch.toLowerCase())
                              )
                              .map((m) => (
                                <li key={m}>{m}</li>
                              ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Availability (auto) */}
              <div className="p-3 border rounded mb-4 bg-white">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-sm font-medium">ZIP Code</label>
                    <input
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="ZIP or ZIP+4"
                      className="border rounded px-3 py-2 w-36"
                      inputMode="numeric"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">Availability updates automatically by ZIP / Qty.</p>
                  </div>
                </div>

                {availError && (
                  <div className="mt-2 text-sm bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded">
                    {availError}
                  </div>
                )}

                {/* Cart actions */}
                {!isSpecialOrder && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="font-medium">Qty:</label>
                    <select
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="border px-2 py-1 rounded"
                    >
                      {[...Array(10)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className={`px-4 py-2 rounded text-white ${canAddOrBuy ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"}`}
                      disabled={!canAddOrBuy}
                      onClick={() => can
