import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { makePartTitle } from "../lib/PartsTitle";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

const MAX_MODELS = 50;
const MAX_PARTS = 20;
const MAX_REFURB = 20;

function normalize(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function getTrustedMPN(p) {
  const clean = (x) => (x == null ? "" : String(x).trim());
  return (
    clean(p?.mpn_coalesced) ||
    clean(p?.mpn_display) ||
    clean(p?.mpn) ||
    clean(p?.manufacturer_part_number) ||
    clean(p?.part_number) ||
    clean(p?.sku) ||
    ""
  );
}

function numericPrice(p) {
  const n =
    p?.price_num ??
    p?.price_numeric ??
    (typeof p?.price === "number"
      ? p.price
      : Number(String(p?.price || "").replace(/[^0-9.]/g, "")));
  return Number.isFinite(Number(n)) ? Number(n) : null;
}

function formatPrice(pObjOrNumber, curr = "USD") {
  let price =
    typeof pObjOrNumber === "number"
      ? pObjOrNumber
      : pObjOrNumber?.price_num ??
        pObjOrNumber?.price_numeric ??
        (typeof pObjOrNumber?.price === "number"
          ? pObjOrNumber.price
          : Number(
              String(pObjOrNumber?.price || "").replace(/[^0-9.]/g, "")
            ));

  if (price == null || Number.isNaN(Number(price))) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (pObjOrNumber?.currency || curr || "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(Number(price));
  } catch {
    return `$${Number(price).toFixed(2)}`;
  }
}

function renderStockBadge(raw, { forceInStock = false } = {}) {
  if (forceInStock) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
        In stock
      </span>
    );
  }
  const s = String(raw || "").toLowerCase();
  if (/special/.test(s)) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-red-600 text-white">
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
}

export default function PartsExplorerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // /grid?brand=Bosch&type=Refrigerator
  const brandParam = searchParams.get("brand") || "";
  const typeParam = searchParams.get("type") || "";

  const [loading, setLoading] = useState(false);

  const [models, setModels] = useState([]);
  const [refurbTeasers, setRefurbTeasers] = useState([]);
  const [brandLogos, setBrandLogos] = useState([]);

  // brand logos boot
  useEffect(() => {
    axios
      .get(`${API_BASE}/api/brand-logos`)
      .then((r) => {
        const logos = Array.isArray(r.data) ? r.data : r.data?.logos || [];
        setBrandLogos(logos);
      })
      .catch(() => {});
  }, []);

  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const key = normalize(brand);
    const hit = brandLogos.find((b) => normalize(b.name) === key);
    return hit?.image_url || hit?.url || hit?.logo_url || hit?.src || null;
  };

  // fetch data for this facet
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // 1. MODELS
        const params = new URLSearchParams();
        params.set("limit", String(MAX_MODELS));
        params.set("src", "grid");

        if (brandParam) {
          params.set("brand", brandParam);
        }
        if (typeParam) {
          // if your backend wants "appliance_type", adjust here:
          params.set("appliance_type", typeParam);
          params.set("q", typeParam);
        }

        params.set("include_counts", "true");
        params.set("include_refurb_only", "false");

        const suggestUrl = `${API_BASE}/api/suggest?${params.toString()}`;
        const res = await axios.get(suggestUrl);

        const withP = res.data?.with_priced_parts || [];
        const noP = res.data?.without_priced_parts || [];
        setModels([...withP, ...noP]);

        // 2. REFURB TEASERS
        let teaserQ = "";
        if (brandParam && typeParam) {
          teaserQ = `${brandParam} ${typeParam}`;
        } else if (brandParam) {
          teaserQ = brandParam;
        } else if (typeParam) {
          teaserQ = typeParam;
        }

        if (teaserQ) {
          const teaserUrl = `${API_BASE}/api/suggest/refurb/search?model=${encodeURIComponent(
            teaserQ
          )}&limit=24&order=price_desc`;
          const refRes = await axios.get(teaserUrl);
          const items = Array.isArray(refRes.data?.results)
            ? refRes.data.results
            : [];
          setRefurbTeasers(items.slice(0, MAX_REFURB));
        } else {
          setRefurbTeasers([]);
        }
      } catch (err) {
        console.error("grid load error", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [brandParam, typeParam]);

  const headingLabel = useMemo(() => {
    if (brandParam && typeParam) return `${brandParam} ${typeParam}`;
    if (brandParam) return brandParam;
    if (typeParam) return typeParam;
    return "Browse";
  }, [brandParam, typeParam]);

  return (
    <div className="w-[90%] mx-auto py-6 text-black">
      {/* Breadcrumb */}
      <div className="w-full border-b border-gray-200 mb-4">
        <nav className="text-sm text-gray-600 py-2 w-full">
          <ul className="flex space-x-2">
            <li>
              <Link to="/" className="hover:underline text-blue-600">
                Home
              </Link>
              <span className="mx-1">/</span>
            </li>
            <li className="font-semibold text-black truncate">
              {headingLabel}
            </li>
          </ul>
        </nav>
      </div>

      {/* Page header / filters summary */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="text-lg font-semibold text-gray-900 leading-tight">
          {headingLabel} Parts & Models
        </div>

        {(brandParam || typeParam) && (
          <button
            onClick={() => navigate("/grid")}
            className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 rounded px-2 py-1"
          >
            Clear filter
          </button>
        )}

        {loading && (
          <div className="flex items-center text-xs text-gray-600 gap-2">
            <svg
              className="animate-spin-clock h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
              <path d="M12 12 L12 5" />
            </svg>
            <span>Loading…</span>
          </div>
        )}
      </div>

      {/* Models section */}
      <section className="mb-8">
        <div className="bg-yellow-400 text-black font-bold text-sm px-2 py-1 rounded inline-block">
          Matching Models
        </div>

        {models.length === 0 ? (
          <div className="text-sm text-gray-500 italic mt-2">
            No matching models found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {models.map((m, idx) => {
              const logo = getBrandLogoUrl(m.brand);

              return (
                <div
                  key={`model-${idx}-${m.model_number}`}
                  className="rounded-lg border p-3 hover:bg-gray-50 transition"
                >
                  <div className="grid grid-cols-[1fr_auto] grid-rows-[auto_auto_auto] gap-x-3 gap-y-1">
                    <div className="col-start-1 row-start-1 font-medium truncate text-[15px]">
                      {m.brand} •{" "}
                      <span className="text-gray-600">Model:</span>{" "}
                      {m.model_number}
                    </div>

                    {logo && (
                      <div className="col-start-2 row-start-1 row-span-2 flex items-center">
                        <img
                          src={logo}
                          alt={`${m.brand} logo`}
                          className="h-10 w-16 object-contain shrink-0"
                          loading="lazy"
                        />
                      </div>
                    )}

                    <div className="col-start-1 row-start-2 text-xs text-gray-500 truncate">
                      {m.appliance_type}
                    </div>

                    <div className="col-span-2 row-start-3 mt-1 text-[11px] text-gray-700 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>Parts:</span>
                      <span>Priced: {m.priced_parts ?? 0}</span>
                      <span>Known: {m.total_parts ?? 0}</span>
                      <span className="flex items-center gap-1">
                        Refurb:
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            typeof m.refurb_count === "number" &&
                            m.refurb_count > 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {m.refurb_count ?? 0}
                        </span>
                      </span>
                    </div>
                  </div>

                  <button
                    className="mt-3 text-xs font-medium bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    onClick={() => {
                      navigate(
                        `/model?model=${encodeURIComponent(
                          m.model_number
                        )}`
                      );
                    }}
                  >
                    View model details
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Refurb / Parts teaser section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="bg-emerald-500 text-white font-bold text-sm px-2 py-1 rounded inline-block">
            Popular Refurb / Replacement Parts
          </div>
        </div>

        {refurbTeasers.length === 0 ? (
          <div className="text-sm text-gray-500 italic">
            No refurbished / replacement parts found.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {refurbTeasers.slice(0, MAX_PARTS).map((p, i) => {
              const mpn = getTrustedMPN(p);
              const priceText = formatPrice(p);

              const offerId =
                p?.offer_id ??
                p?.listing_id ??
                p?.ebay_id ??
                p?.item_id ??
                p?.id ??
                null;
              const qs = offerId
                ? `?offer=${encodeURIComponent(String(offerId))}`
                : "";

              return (
                <Link
                  key={`rf-${i}-${mpn || i}`}
                  to={`/refurb/${encodeURIComponent(mpn || "")}${qs}`}
                  className="rounded-lg border border-gray-200 p-3 bg-white hover:bg-gray-50 transition"
                >
                  <div className="flex gap-3 items-start">
                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt={mpn || "Refurbished Part"}
                        className="w-16 h-16 object-contain rounded border border-gray-100 bg-white"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate capitalize">
                        {makePartTitle(p, mpn)}
                      </div>
                      <div className="text-[11px] text-gray-600 truncate">
                        {mpn ? `MPN: ${mpn}` : null}
                      </div>

                      <div className="mt-1 flex items-center flex-wrap gap-2 text-[13px]">
                        <span className="font-semibold">{priceText}</span>
                        {renderStockBadge(p?.stock_status, {
                          forceInStock: true,
                        })}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
