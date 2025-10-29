// src/pages/PartsExplorerPage.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

export default function PartsExplorerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // read facet filters from ?brand=... or ?type=...
  const brand = searchParams.get("brand") || "";
  const type = searchParams.get("type") || "";

  // data from backend
  const [models, setModels] = useState([]);
  const [refurbParts, setRefurbParts] = useState([]);
  const [loading, setLoading] = useState(false);

  // simple fetch for matching models + teaser parts based on brand/type
  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      try {
        // build query string for API
        const q = brand || type || "";
        if (!q) {
          setModels([]);
          setRefurbParts([]);
          setLoading(false);
          return;
        }

        // 1) models
        const mParams = new URLSearchParams();
        mParams.set("limit", "15");
        mParams.set("include_counts", "true");
        if (brand) mParams.set("brand", brand);
        if (type) mParams.set("appliance_type", type);
        // we also send "q" because suggest endpoint likes having something
        mParams.set("q", q);

        const modelsRes = await fetch(
          `${API_BASE}/api/suggest?${mParams.toString()}`,
          { signal: controller.signal }
        );
        let modelsJson = {};
        try {
          modelsJson = await modelsRes.json();
        } catch {
          modelsJson = {};
        }

        const withP = Array.isArray(modelsJson.with_priced_parts)
          ? modelsJson.with_priced_parts
          : [];
        const noP = Array.isArray(modelsJson.without_priced_parts)
          ? modelsJson.without_priced_parts
          : [];
        const combinedModels = [...withP, ...noP];
        setModels(combinedModels);

        // 2) refurb teaser
        const rParams = new URLSearchParams();
        if (brand) rParams.set("brand", brand);
        if (type) rParams.set("appliance_type", type);
        rParams.set("limit", "12");
        rParams.set("order", "price_desc");

        const refurbRes = await fetch(
          `${API_BASE}/api/suggest/refurb/search?${rParams.toString()}`,
          { signal: controller.signal }
        );
        let refurbJson = {};
        try {
          refurbJson = await refurbRes.json();
        } catch {
          refurbJson = {};
        }
        const refurbList = Array.isArray(refurbJson.results)
          ? refurbJson.results
          : Array.isArray(refurbJson.items)
          ? refurbJson.items
          : [];
        setRefurbParts(refurbList);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("grid fetch err:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [brand, type]);

  const clearFilter = () => {
    navigate("/grid");
  };

  const getTrustedMPN = (p) => {
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
  };

  const formatPrice = (pObjOrNumber, curr = "USD") => {
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
  };

  const renderStockBadge = (raw) => {
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

  return (
    <div className="w-[90%] mx-auto py-6">
      {/* breadcrumb / header row stays on dark background text-white */}
      <div className="text-xs text-white mb-2">
        <Link to="/" className="text-blue-300 hover:underline">
          Home
        </Link>{" "}
        /{" "}
        {brand
          ? brand
          : type
          ? type
          : "All"}
      </div>

      {/* WHITE CONTENT WRAPPER */}
      <div className="bg-white text-black border border-gray-300 rounded-md p-4 shadow-sm">
        {/* heading + clear */}
        <div className="flex flex-wrap items-center gap-3 mb-4 border-b border-gray-200 pb-3">
          <h1 className="text-base sm:text-lg font-semibold text-gray-900">
            {brand || type || "All"} Parts &amp; Models
          </h1>

          {(brand || type) && (
            <button
              className="text-xs bg-gray-100 border border-gray-300 rounded px-2 py-1 text-gray-700 hover:bg-gray-200"
              onClick={clearFilter}
            >
              Clear filter
            </button>
          )}

          {loading && (
            <div className="flex items-center text-[11px] text-gray-600 gap-1">
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

        {/* MODELS BLOCK */}
        <section className="mb-6">
          <div className="bg-yellow-400 text-black font-bold text-xs inline-block px-2 py-1 rounded mb-2">
            Matching Models
          </div>

          {models.length === 0 ? (
            <div className="text-sm text-gray-600 italic">
              No matching models found.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {models.map((m, idx) => (
                <button
                  key={idx}
                  className="text-left w-full rounded border border-gray-300 bg-white hover:bg-gray-50 transition p-3"
                  onClick={() => {
                    navigate(
                      `/model?model=${encodeURIComponent(
                        m.model_number
                      )}`
                    );
                  }}
                >
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {m.brand} •{" "}
                    <span className="text-gray-600">Model:</span>{" "}
                    {m.model_number}
                  </div>
                  <div className="text-[12px] text-gray-600 truncate">
                    {m.appliance_type}
                  </div>
                  <div className="mt-2 flex flex-wrap text-[11px] text-gray-700 gap-3">
                    <span>
                      Priced:{" "}
                      {m.priced_parts != null
                        ? m.priced_parts
                        : 0}
                    </span>
                    <span>
                      Refurb:{" "}
                      {m.refurb_count != null
                        ? m.refurb_count
                        : 0}
                    </span>
                    <span>
                      Known:{" "}
                      {m.total_parts != null
                        ? m.total_parts
                        : 0}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* REFURB PARTS BLOCK */}
        <section className="mb-2">
          <div className="bg-emerald-500 text-white font-bold text-xs inline-block px-2 py-1 rounded mb-2">
            Popular Refurb / Replacement Parts
          </div>

          {refurbParts.length === 0 ? (
            <div className="text-sm text-gray-600 italic">
              No refurbished / replacement parts found.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {refurbParts.map((p, i) => {
                const mpn = getTrustedMPN(p);
                return (
                  <Link
                    key={`${mpn || "p"}-${i}`}
                    to={
                      mpn
                        ? `/refurb/${encodeURIComponent(mpn)}`
                        : "#"
                    }
                    className="rounded border border-gray-300 bg-white hover:bg-gray-50 transition p-3 flex gap-3"
                  >
                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt={mpn || "Part"}
                        className="w-16 h-16 object-contain rounded border border-gray-200 bg-white flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate capitalize">
                        {p.title ||
                          p.part_type ||
                          mpn ||
                          "Part"}
                      </div>

                      <div className="mt-1 flex items-center flex-wrap gap-2 text-[13px] text-gray-800">
                        <span className="font-semibold">
                          {formatPrice(p)}
                        </span>
                        {renderStockBadge(p.stock_status || p.availability)}
                        {mpn && (
                          <span className="text-[11px] font-mono text-gray-600 truncate">
                            MPN: {mpn}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
