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
      : typeof p?.price === "string"
      ? parseFloat(p.price.replace(/[^0-9.]/g, ""))
      : null);
  return Number.isFinite(n) ? n : null;
};

const availabilityLevel = (item) => {
  // Try several possible field names, cast to number
  const raw =
    item?.availability_level ??
    item?.availabilityLevel ??
    item?.avail_level ??
    item?.availability_level_new ??
    item?.availability_level_refurb ??
    null;
  const n = raw == null ? null : Number(raw);
  return Number.isFinite(n) ? n : null;
};

const isLevel1Or2 = (item) => {
  const lvl = availabilityLevel(item);
  return lvl === 1 || lvl === 2;
};

const getSequence = (p) =>
  p?.sequence ?? p?.sequence_number ?? p?.seq ?? p?.diagram_sequence ?? "";

/* card key helper */
const keyForItem = (item, fallbackIndex) => {
  const seq = getSequence(item);
  const mpn = extractRawMPN(item);
  const id =
    item?.id ??
    item?.part_id ??
    item?.offer_id ??
    item?.ebay_item_id ??
    item?.item_id;
  return [seq || "noseq", mpn || "nompn", id || fallbackIndex].join("-");
};

/* refurb link helper */
const refurbLinkForOffer = (offer) => {
  const mpn = extractRawMPN(offer) || "unknown";
  const ebayId =
    offer?.ebay_item_id ?? offer?.item_id ?? offer?.id ?? offer?.offer_id;
  if (!ebayId) {
    // Fallback: at least go to the refurb MPN page
    return `/refurb/${encodeURIComponent(mpn)}`;
  }
  return `/refurb/${encodeURIComponent(mpn)}?offer=${encodeURIComponent(
    ebayId
  )}`;
};

/* ---------------- main component ---------------- */
export default function ModelPage() {
  const [searchParams] = useSearchParams();
  const modelParam = searchParams.get("model") || searchParams.get("q") || "";
  const normModel = normalize(modelParam);

  const [model, setModel] = useState(null);
  const [explodedViews, setExplodedViews] = useState([]);
  const [partsRaw, setPartsRaw] = useState([]);
  const [refurbOffersRaw, setRefurbOffersRaw] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasFetchedRefurbOnce = useRef(false);

  /* ---------------- data fetch ---------------- */
  useEffect(() => {
    if (!normModel) return;

    const controller = new AbortController();
    setLoading(true);
    setError("");

    (async () => {
      try {
        // TODO: if your endpoints differ, adjust URLs only.
        const [modelRes, partsRes] = await Promise.all([
          fetch(
            `${API_BASE}/api/search?q=${encodeURIComponent(modelParam)}`,
            { signal: controller.signal }
          ),
          fetch(
            `${API_BASE}/api/parts/for-model/${encodeURIComponent(modelParam)}`,
            { signal: controller.signal }
          ),
        ]);

        if (!modelRes.ok) {
          throw new Error(`Model lookup failed (${modelRes.status})`);
        }
        if (!partsRes.ok) {
          throw new Error(`Parts lookup failed (${partsRes.status})`);
        }

        const modelJson = await modelRes.json();
        const partsJson = await partsRes.json();

        // model payload can be wrapped or bare; be defensive
        const m = modelJson?.model ?? modelJson ?? null;
        setModel(m || null);

        const ev =
          modelJson?.exploded_views ??
          modelJson?.explodedViews ??
          m?.exploded_views ??
          [];
        setExplodedViews(Array.isArray(ev) ? ev : []);

        // parts payload: expect something like { parts: [], offers: [] } or similar
        const allParts =
          partsJson?.all_parts ??
          partsJson?.parts ??
          partsJson?.model_parts ??
          [];
        setPartsRaw(Array.isArray(allParts) ? allParts : []);

        const refurb =
          partsJson?.refurb_offers ??
          partsJson?.offers ??
          partsJson?.refurb ??
          [];
        setRefurbOffersRaw(Array.isArray(refurb) ? refurb : []);

        hasFetchedRefurbOnce.current = true;
      } catch (err) {
        console.error("ModelPage fetch error:", err);
        if (!controller.signal.aborted) {
          setError(
            err?.message || "Something went wrong loading this model page."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [modelParam, normModel]);

  /* ---------------- derived data ---------------- */
  const { availableItems, allPartsSorted, totalPricedCount } = useMemo(() => {
    const allPartsClean = (partsRaw || []).map((p) => ({
      ...p,
      _kind: "retail",
    }));
    const refurbClean = (refurbOffersRaw || []).map((o) => ({
      ...o,
      _kind: "refurb",
    }));

    // ALL parts list (right column): based only on the full retail parts list
    const allPartsSorted = [...allPartsClean].sort((a, b) => {
      const seqA = parseInt(getSequence(a) || "0", 10);
      const seqB = parseInt(getSequence(b) || "0", 10);
      if (Number.isFinite(seqA) && Number.isFinite(seqB)) {
        return seqA - seqB;
      }
      return String(getSequence(a)).localeCompare(String(getSequence(b)));
    });

    // Available grid: retail parts with price + level 1/2,
    // plus refurb offers with level 1/2.
    const retailAvailable = allPartsClean.filter((p) => {
      const lvlOk = isLevel1Or2(p);
      const price = numericPrice(p);
      return lvlOk && price != null && price > 0;
    });

    const refurbAvailable = refurbClean.filter((o) => isLevel1Or2(o));

    const combined = [...retailAvailable, ...refurbAvailable].sort((a, b) => {
      const pa = numericPrice(a) ?? 9999999;
      const pb = numericPrice(b) ?? 9999999;
      return pa - pb;
    });

    return {
      availableItems: combined,
      allPartsSorted,
      totalPricedCount: retailAvailable.length,
    };
  }, [partsRaw, refurbOffersRaw]);

  const brand = model?.brand || model?.Brand || "";
  const modelNumber = model?.model_number || model?.modelNumber || modelParam;
  const applianceType = model?.appliance_type || model?.applianceType || "";

  const brandLogoUrl =
    model?.brand_logo_url ??
    model?.brandLogoUrl ??
    null; // if your API doesn't send this, it's just hidden

  const breadcrumb = [
    { label: "Home", to: "/" },
    brand && { label: brand, to: `/brand/${encodeURIComponent(brand)}` },
    applianceType && {
      label: applianceType,
      to: `/appliance/${encodeURIComponent(applianceType)}`,
    },
    modelNumber && {
      label: modelNumber,
      to: `#`,
    },
  ].filter(Boolean);

  /* ---------------- render helpers ---------------- */

  const renderBreadcrumbs = () => (
    <nav className="text-xs sm:text-sm text-slate-500 mb-3 sm:mb-4">
      {breadcrumb.map((crumb, idx) => (
        <span key={idx}>
          {idx > 0 && <span className="mx-1">/</span>}
          {crumb.to && crumb.to !== "#" ? (
            <Link
              to={crumb.to}
              className="hover:text-blue-700 transition-colors"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="font-medium text-slate-700">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );

  const renderHeader = () => (
    <header className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4 mb-4 sm:mb-6">
      {renderBreadcrumbs()}

      <div className="flex flex-col md:flex-row gap-3 md:gap-4">
        {/* brand logo */}
        <div className="md:w-1/5 flex items-center justify-center md:justify-start">
          {brandLogoUrl ? (
            <img
              src={brandLogoUrl}
              alt={brand || "Brand"}
              className="max-h-16 md:max-h-20 object-contain"
            />
          ) : (
            <div className="text-xs text-slate-400 italic">
              {brand || "Brand"}
            </div>
          )}
        </div>

        {/* model details */}
        <div className="md:w-1/5 flex flex-col justify-center">
          <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-900 mb-1">
            {brand && `${brand} `}
            {modelNumber}
          </h1>
          {applianceType && (
            <div className="text-sm text-slate-600">
              {applianceType} – Model details & diagrams
            </div>
          )}
          <div className="mt-2 text-xs text-slate-500">
            {totalPricedCount > 0 && (
              <span className="mr-3">
                <span className="font-semibold">{totalPricedCount}</span> parts
                in stock
              </span>
            )}
            {allPartsSorted.length > 0 && (
              <span>
                <span className="font-semibold">{allPartsSorted.length}</span>{" "}
                total known parts
              </span>
            )}
          </div>
        </div>

        {/* exploded views */}
        <div className="md:w-3/5 mt-3 md:mt-0">
          <div className="text-xs text-slate-500 mb-1">
            Exploded view diagrams
          </div>
          {explodedViews && explodedViews.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {explodedViews.map((ev, idx) => (
                <div
                  key={idx}
                  className="min-w-[120px] max-w-[140px] border border-slate-200 rounded-lg overflow-hidden bg-slate-50"
                >
                  <img
                    src={ev.image_url || ev.imageUrl}
                    alt={ev.label || `Diagram ${idx + 1}`}
                    className="w-full h-24 object-contain bg-white"
                  />
                  <div className="px-2 py-1 text-[10px] text-slate-600 line-clamp-2">
                    {ev.label || ev.title || `Diagram ${idx + 1}`}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">
              No exploded views available for this model yet.
            </div>
          )}
        </div>
      </div>
    </header>
  );

  const renderAvailableGrid = () => (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4 h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900">
          Parts in Stock (New & Refurb)
        </h2>
        <div className="text-[11px] text-slate-500">
          Showing availability levels 1–2
        </div>
      </div>

      {availableItems.length === 0 ? (
        <div className="text-xs text-slate-500 italic">
          No in-stock parts at availability level 1 or 2 yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 overflow-y-auto max-h-[65vh] pr-1">
          {availableItems.map((item, idx) => {
            const isRefurb = item._kind === "refurb";
            const seq = getSequence(item);
            const price = numericPrice(item);
            const mpn = extractRawMPN(item);

            const title =
              item?.name ??
              item?.title ??
              item?.part_name ??
              item?.short_title ??
              mpn ??
              "Part";

            const cardLink = isRefurb
              ? refurbLinkForOffer(item)
              : `/part/${encodeURIComponent(mpn || "")}`;

            const lvl = availabilityLevel(item);

            return (
              <Link
                key={keyForItem(item, idx)}
                to={cardLink}
                className="border border-slate-200 rounded-lg p-2 bg-white hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="flex items-start gap-2 mb-1">
                  <div className="w-12 h-12 flex-shrink-0 bg-slate-50 border border-slate-100 rounded">
                    <PartImage part={item} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-slate-500 mb-0.5">
                      {seq && (
                        <span className="mr-2">
                          <span className="font-semibold">Diagram #</span>
                          {seq}
                        </span>
                      )}
                      {mpn && (
                        <span className="uppercase tracking-wide">
                          {mpn}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-medium text-slate-900 line-clamp-2">
                      {title}
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between pt-1">
                  <div className="text-sm font-semibold text-slate-900">
                    {price != null ? `$${price.toFixed(2)}` : "See price"}
                  </div>
                  <div className="text-[10px] px-1.5 py-0.5 rounded-full border border-slate-200 text-slate-600">
                    {isRefurb ? "Refurbished" : "New OEM"}
                    {lvl != null && (
                      <span className="ml-1 text-[9px] text-slate-500">
                        L{lvl}
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
  );

  const renderAllPartsGrid = () => (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4 h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900">
          All Known Parts for this Model
        </h2>
        <div className="text-[11px] text-slate-500">
          Includes parts without current price
        </div>
      </div>

      {allPartsSorted.length === 0 ? (
        <div className="text-xs text-slate-500 italic">
          No parts are mapped to this model yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto max-h-[65vh] pr-1 text-xs">
          {allPartsSorted.map((p, idx) => {
            const seq = getSequence(p);
            const mpn = extractRawMPN(p);
            const title =
              p?.name ?? p?.part_name ?? p?.title ?? mpn ?? "Part";

            return (
              <div
                key={keyForItem(p, idx)}
                className="border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50/60 flex items-start gap-2"
              >
                <div className="w-10 text-[11px] text-slate-600 font-semibold whitespace-nowrap">
                  {seq ? `#${seq}` : "--"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-slate-500 mb-0.5 uppercase">
                    {mpn || "—"}
                  </div>
                  <div className="text-[11px] text-slate-800 line-clamp-2">
                    {title}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  /* ---------------- main render ---------------- */
  if (!normModel) {
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="text-sm text-slate-600">
          No model specified. Please start from the search bar.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {renderHeader()}

      {loading && (
        <div className="mb-3 text-xs text-slate-500">
          Loading model parts…
        </div>
      )}
      {error && (
        <div className="mb-3 text-xs text-red-600">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
        {renderAvailableGrid()}
        {renderAllPartsGrid()}
      </div>

      {/* tiny debug footer, safe to remove */}
      <div className="mt-3 text-[10px] text-slate-400">
        Model: <span className="font-mono">{modelNumber}</span> &nbsp;|&nbsp; Raw
        parts: {partsRaw.length} &nbsp;|&nbsp; Refurb offers:{" "}
        {refurbOffersRaw.length}
      </div>
    </div>
  );
}
