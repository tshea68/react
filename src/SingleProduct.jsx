// src/SingleProduct.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useCart } from "./context/CartContext";
import { makePartTitle } from "./lib/PartsTitle";
import CompareBanner from "./components/CompareBanner";
import useCompareSummary from "./hooks/useCompareSummary";
import PickupAvailabilityBlock from "./components/PickupAvailabilityBlock";
import PartImage from "./components/PartImage";
import RefurbBadge from "./components/RefurbBadge";

// ---- Helper: normalize MPN for comparisons ----
const normMPN = (s) =>
  String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

// ---- Helper: price formatting ----
const formatPrice = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

// ---- Helper: safe numeric ----
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function SingleProduct() {
  const { mpn } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { addToCart, buyNow } = useCart();

  const [partData, setPartData] = useState(null);
  const [loadingPart, setLoadingPart] = useState(true);
  const [errorPart, setErrorPart] = useState("");

  const [modelData, setModelData] = useState(null);
  const [loadingModel, setLoadingModel] = useState(false);

  const [brandLogos, setBrandLogos] = useState([]);
  const [brandLogoUrl, setBrandLogoUrl] = useState("");

  const [relatedParts, setRelatedParts] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const [qty, setQty] = useState(1);

  // refurb data
  const [refurbOffers, setRefurbOffers] = useState([]);
  const [loadingRefurb, setLoadingRefurb] = useState(false);

  // Model-fit checker
  const [fitModel, setFitModel] = useState("");
  const [fitResult, setFitResult] = useState(null);
  const [fitLoading, setFitLoading] = useState(false);

  // Replaces previous parts
  const [replacesList, setReplacesList] = useState([]);

  // compare hook (uses real/new part)
  const compare = useCompareSummary(partData);

  // cache last fetched mpn to avoid duplicate fetches
  const lastFetchedRef = useRef("");

  // -----------------------
  // Derived / fallbacks
  // -----------------------
  const isRefurbRoute = useMemo(() => {
    return (location.pathname || "").startsWith("/refurb/");
  }, [location.pathname]);

  const mpnNorm = useMemo(() => normMPN(mpn), [mpn]);

  const bestRefurb = useMemo(() => {
    if (!refurbOffers?.length) return null;
    // prefer highest price or best offer—keep it simple: first sorted by price desc if available
    const sorted = [...refurbOffers].sort((a, b) => {
      const ap = toNumber(a?.price) ?? -1;
      const bp = toNumber(b?.price) ?? -1;
      return bp - ap;
    });
    return sorted[0] || null;
  }, [refurbOffers]);

  const fallbackPartForRefurb = useMemo(() => {
    if (!isRefurbRoute) return null;
    if (partData) return null;
    if (!bestRefurb) return null;

    // Minimal part-like object so the page still renders meaningful info
    const realMPN = bestRefurb?.mpn || mpn;
    return {
      mpn: realMPN,
      mpn_normalized: normMPN(realMPN),
      name: bestRefurb.title || realMPN,
      price: bestRefurb?.price ?? null,
      image_url: bestRefurb?.image_url ?? null,
      brand: bestRefurb?.brand ?? null,
      appliance_type: bestRefurb?.appliance_type ?? null,
      part_type: bestRefurb?.part_type ?? null,
      stock_status: "Refurbished",
      condition: "Refurbished",
      source: "refurb",
    };
  }, [isRefurbRoute, partData, bestRefurb, mpn]);

  const effectivePart = partData || fallbackPartForRefurb;

  // ---- description + compatible brands ----
  const descriptionText = useMemo(() => {
    const raw =
      effectivePart?.description ||
      effectivePart?.short_description ||
      effectivePart?.short_desc ||
      effectivePart?.name ||
      bestRefurb?.title ||
      "";
    const cleaned = String(raw || "")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned;
  }, [effectivePart, bestRefurb]);

  // ✅ SEO title/description/canonical (Helmet)
  const seoTitle = useMemo(() => {
    const p = partData || fallbackPartForRefurb;
    const base = p ? makePartTitle(p, mpn) : mpn || "";
    return base ? `${base} | Appliance Geeks` : "Appliance Geeks";
  }, [partData, fallbackPartForRefurb, mpn]);

  const seoDescription = useMemo(() => {
    const raw =
      (partData?.description ||
        partData?.short_description ||
        partData?.short_desc ||
        partData?.name ||
        partData?.title ||
        bestRefurb?.title ||
        "")?.toString() || "";

    const cleaned = raw.replace(/\s+/g, " ").trim();
    if (!cleaned)
      return "OEM replacement appliance part with model compatibility and availability.";
    return cleaned.length > 160 ? `${cleaned.slice(0, 157)}...` : cleaned;
  }, [partData, bestRefurb]);

  const canonicalUrl = useMemo(() => {
    const path = (location?.pathname || "/").trim() || "/";
    return `https://www.appliancepartgeeks.com${path}`;
  }, [location?.pathname]);

  // -----------------------
  // Fetch Part
  // -----------------------
  useEffect(() => {
    const doFetch = async () => {
      const key = `${location.pathname}:${mpnNorm}`;
      if (lastFetchedRef.current === key) return;
      lastFetchedRef.current = key;

      setLoadingPart(true);
      setErrorPart("");
      setPartData(null);

      try {
        const base = "https://fastapi-app-kkkq.onrender.com";
        const url = `${base}/api/parts/${encodeURIComponent(mpn)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Part fetch failed (${res.status})`);
        const data = await res.json();
        setPartData(data || null);

        // replacements
        const repl = data?.replaces_previous_parts || data?.replaces || [];
        setReplacesList(Array.isArray(repl) ? repl : []);
      } catch (e) {
        // If refurb route, we can keep going with fallback from offers
        setErrorPart(String(e?.message || e || "Unknown error"));
      } finally {
        setLoadingPart(false);
      }
    };

    doFetch();
  }, [mpn, mpnNorm, location.pathname]);

  // -----------------------
  // Fetch Refurb Offers (if needed)
  // -----------------------
  useEffect(() => {
    const fetchRefurb = async () => {
      if (!isRefurbRoute) return;

      setLoadingRefurb(true);
      try {
        const base = "https://fastapi-app-kkkq.onrender.com";
        const url = `${base}/api/offers/by-mpn/${encodeURIComponent(mpn)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Refurb fetch failed (${res.status})`);
        const data = await res.json();
        const arr = Array.isArray(data) ? data : data?.offers || [];
        setRefurbOffers(Array.isArray(arr) ? arr : []);
      } catch (_e) {
        setRefurbOffers([]);
      } finally {
        setLoadingRefurb(false);
      }
    };

    fetchRefurb();
  }, [isRefurbRoute, mpn]);

  // -----------------------
  // Fetch Model info if part has a model_number
  // -----------------------
  useEffect(() => {
    const fetchModel = async () => {
      const modelNumber = effectivePart?.model_number || effectivePart?.model;
      if (!modelNumber) return;

      setLoadingModel(true);
      try {
        const base = "https://fastapi-app-kkkq.onrender.com";
        const url = `${base}/api/search?q=${encodeURIComponent(modelNumber)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Model fetch failed");
        const data = await res.json();
        setModelData(data || null);
      } catch (_e) {
        setModelData(null);
      } finally {
        setLoadingModel(false);
      }
    };

    fetchModel();
  }, [effectivePart?.model_number, effectivePart?.model]);

  // -----------------------
  // Brand logos (match model.brand to brand_logos.name)
  // -----------------------
  useEffect(() => {
    const fetchLogos = async () => {
      try {
        const base = "https://fastapi-app-kkkq.onrender.com";
        const res = await fetch(`${base}/api/brand-logos`);
        if (!res.ok) return;
        const data = await res.json();
        setBrandLogos(Array.isArray(data) ? data : []);
      } catch (_e) {
        setBrandLogos([]);
      }
    };
    fetchLogos();
  }, []);

  useEffect(() => {
    const brand = modelData?.brand || effectivePart?.brand || "";
    if (!brand || !brandLogos?.length) return;

    const match =
      brandLogos.find((b) => String(b?.name || "").toLowerCase() === String(brand).toLowerCase()) ||
      null;

    setBrandLogoUrl(match?.image_url || "");
  }, [brandLogos, modelData?.brand, effectivePart?.brand]);

  // -----------------------
  // Related parts (same model)
  // -----------------------
  useEffect(() => {
    const fetchRelated = async () => {
      const modelNumber = modelData?.model_number || modelData?.model || effectivePart?.model_number;
      if (!modelNumber) return;

      setLoadingRelated(true);
      try {
        const base = "https://fastapi-app-kkkq.onrender.com";
        const url = `${base}/api/parts/for-model/${encodeURIComponent(modelNumber)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Related fetch failed");
        const data = await res.json();
        const parts = Array.isArray(data) ? data : data?.parts || [];

        // choose up to 6 highest-priced with images
        const withImgs = parts.filter((p) => p?.image_url);
        withImgs.sort((a, b) => (toNumber(b?.price) ?? -1) - (toNumber(a?.price) ?? -1));
        setRelatedParts(withImgs.slice(0, 6));
      } catch (_e) {
        setRelatedParts([]);
      } finally {
        setLoadingRelated(false);
      }
    };

    fetchRelated();
  }, [modelData?.model_number, modelData?.model, effectivePart?.model_number]);

  // -----------------------
  // Fit checker
  // -----------------------
  const runFitCheck = async () => {
    const q = String(fitModel || "").trim();
    if (!q) return;

    setFitLoading(true);
    setFitResult(null);
    try {
      const base = "https://fastapi-app-kkkq.onrender.com";
      const url = `${base}/api/parts/for-model-lite/${encodeURIComponent(q)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Fit check failed");
      const data = await res.json();
      const links = Array.isArray(data) ? data : data?.links || [];

      const hit = links.some((x) => normMPN(x?.mpn) === mpnNorm);
      setFitResult(hit ? "✅ Yes, this part fits." : "❌ No match found for that model.");
    } catch (_e) {
      setFitResult("❌ Error checking fit.");
    } finally {
      setFitLoading(false);
    }
  };

  // -----------------------
  // UI helpers
  // -----------------------
  const buyNowClick = async () => {
    const p = effectivePart;
    if (!p) return;
    await buyNow(p, qty);
  };

  const addToCartClick = async () => {
    const p = effectivePart;
    if (!p) return;
    await addToCart(p, qty);
  };

  const backToModel = () => {
    const modelNumber = modelData?.model_number || modelData?.model || effectivePart?.model_number;
    if (modelNumber) {
      navigate(`/model?q=${encodeURIComponent(modelNumber)}`);
      return;
    }
    navigate("/");
  };

  // -----------------------
  // Render early states
  // -----------------------
  if (loadingPart && !effectivePart) {
    return (
      <div className="bg-[#001b36] text-white min-h-screen p-6 flex items-center justify-center">
        <div className="text-white/80">Loading part…</div>
      </div>
    );
  }

  if (!effectivePart) {
    return (
      <div className="bg-[#001b36] text-white min-h-screen p-6 flex items-center justify-center">
        <div className="max-w-xl text-center">
          <div className="text-lg font-semibold mb-2">Part not found</div>
          <div className="text-white/70 mb-4">{errorPart || "No data returned."}</div>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded bg-white text-[#001b36] font-semibold"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  // -----------------------
  // Components: Breadcrumb
  // -----------------------
  const Breadcrumb = () => {
    const brand = modelData?.brand || effectivePart?.brand || "";
    const applianceType = modelData?.appliance_type || effectivePart?.appliance_type || "";
    const modelNumber = modelData?.model_number || modelData?.model || effectivePart?.model_number || "";

    return (
      <div className="w-full text-sm text-white/70 mt-2">
        <span className="hover:text-white">
          <Link to="/">Home</Link>
        </span>

        {brand ? (
          <>
            <span className="mx-2">/</span>
            <span>{brand}</span>
          </>
        ) : null}

        {applianceType ? (
          <>
            <span className="mx-2">/</span>
            <span>{applianceType}</span>
          </>
        ) : null}

        {modelNumber ? (
          <>
            <span className="mx-2">/</span>
            <span className="hover:text-white">
              <Link to={`/model?q=${encodeURIComponent(modelNumber)}`}>{modelNumber}</Link>
            </span>
          </>
        ) : null}

        <span className="mx-2">/</span>
        <span className="text-white">{effectivePart?.mpn || mpn}</span>
      </div>
    );
  };

  // -----------------------
  // Components: Availability Card
  // -----------------------
  const AvailabilityCard = () => {
    const price = toNumber(effectivePart?.price);
    const stock = String(effectivePart?.stock_status || effectivePart?.availability || "").trim();

    return (
      <div className="w-full mt-6 bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold">Availability</div>
          {stock ? <div className="text-sm text-white/70">{stock}</div> : null}
        </div>

        <div className="mt-2 text-sm text-white/80">
          {price != null ? (
            <div>
              <span className="font-semibold">Price:</span> {formatPrice(price)}
            </div>
          ) : (
            <div className="text-white/70">Price not available.</div>
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-white/70">Qty</label>
            <select
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="bg-[#001b36] border border-white/20 rounded px-2 py-1 text-sm"
            >
              {Array.from({ length: 10 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={buyNowClick}
            className="flex-1 bg-white text-[#001b36] font-semibold rounded px-4 py-2"
          >
            Buy Now
          </button>

          <button
            onClick={addToCartClick}
            className="flex-1 bg-white/10 border border-white/20 text-white font-semibold rounded px-4 py-2"
          >
            Add to Cart
          </button>
        </div>
      </div>
    );
  };

  // -----------------------
  // Components: Compat & Replaces
  // -----------------------
  const CompatAndReplacesSection = () => {
    const modelNumber = modelData?.model_number || modelData?.model || effectivePart?.model_number || "";

    return (
      <div className="w-full mt-6 space-y-6">
        {/* Fit checker */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-base font-semibold">Does this fit my model?</div>
          <div className="mt-2 text-sm text-white/70">
            Enter a model number to check compatibility.
          </div>

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              value={fitModel}
              onChange={(e) => setFitModel(e.target.value)}
              placeholder="e.g., WRF535SWHZ"
              className="flex-1 bg-[#001b36] border border-white/20 rounded px-3 py-2 text-sm text-white"
            />
            <button
              onClick={runFitCheck}
              disabled={fitLoading}
              className="bg-white text-[#001b36] font-semibold rounded px-4 py-2 disabled:opacity-60"
            >
              {fitLoading ? "Checking…" : "Check"}
            </button>
          </div>

          {fitResult ? <div className="mt-3 text-sm">{fitResult}</div> : null}

          {modelNumber ? (
            <div className="mt-3 text-sm text-white/70">
              This page is currently showing model:{" "}
              <span className="text-white">{modelNumber}</span>
            </div>
          ) : null}
        </div>

        {/* Replaces previous parts */}
        {replacesList?.length ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-base font-semibold">Parts Replaced</div>
            <div className="mt-2 text-sm text-white/70">
              This part replaces the following part number(s):
            </div>
            <ul className="mt-3 text-sm list-disc ml-5">
              {replacesList.map((x, i) => (
                <li key={`${x}-${i}`}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Pickup availability */}
        <PickupAvailabilityBlock mpn={effectivePart?.mpn || mpn} />
      </div>
    );
  };

  // -----------------------
  // RENDER
  // -----------------------
  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <div className="bg-[#001b36] text-white min-h-screen p-4 flex flex-col items-center">
        {/* Breadcrumb */}
        <div className="w-full max-w-4xl">
          <Breadcrumb />
        </div>

        <div className="w-full max-w-4xl mt-4">
          {/* Compare banner */}
          <CompareBanner
            mpn={effectivePart?.mpn || mpn}
            price={effectivePart?.price}
            stock_status={effectivePart?.stock_status}
            source={effectivePart?.source}
          />

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 mt-4">
            {/* Header: brand/logo + name */}
            <div className="flex flex-col md:flex-row gap-6">
              {/* Image */}
              <div className="w-full md:w-1/2">
                <PartImage
                  src={effectivePart?.image_url}
                  alt={effectivePart?.name || effectivePart?.mpn}
                />
              </div>

              {/* Details */}
              <div className="w-full md:w-1/2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {brandLogoUrl ? (
                      <img
                        src={brandLogoUrl}
                        alt={modelData?.brand || effectivePart?.brand || "Brand"}
                        className="h-10 w-auto mb-3"
                      />
                    ) : null}

                    <h1 className="text-2xl md:text-3xl font-bold leading-tight">
                      {makePartTitle(effectivePart, mpn)}
                    </h1>

                    <div className="mt-2 text-sm text-white/70">
                      Part Number: <span className="text-white">{effectivePart?.mpn || mpn}</span>
                    </div>
                  </div>

                  {isRefurbRoute ? <RefurbBadge /> : null}
                </div>

                {/* Description */}
                {descriptionText ? (
                  <div className="mt-4 text-sm text-white/80 leading-relaxed">
                    {descriptionText}
                  </div>
                ) : null}

                {/* Quick actions */}
                <div className="mt-6">
                  <AvailabilityCard />
                </div>

                {/* Back to model */}
                <div className="mt-4">
                  <button
                    onClick={backToModel}
                    className="text-sm text-white/80 hover:text-white underline"
                  >
                    Back to model
                  </button>
                </div>
              </div>
            </div>

            {/* Related parts */}
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">Related Parts</div>
                {loadingRelated ? <div className="text-sm text-white/60">Loading…</div> : null}
              </div>

              {relatedParts?.length ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {relatedParts.map((p) => (
                    <Link
                      key={p?.mpn}
                      to={`/parts/${encodeURIComponent(p?.mpn)}`}
                      className="block bg-white/5 border border-white/10 rounded-xl p-3 hover:border-white/20"
                    >
                      <div className="text-sm font-semibold">{p?.mpn}</div>
                      <div className="text-sm text-white/80 mt-1 line-clamp-2">
                        {p?.name || ""}
                      </div>
                      <div className="text-sm text-white/70 mt-2">
                        {formatPrice(p?.price) || ""}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-white/60">No related parts found.</div>
              )}
            </div>

            {/* Fit / replaces / pickup */}
            <div className="mt-8">
              <CompatAndReplacesSection />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
