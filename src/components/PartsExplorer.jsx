// src/components/PartsExplorer.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { makePartTitle } from "../lib/PartsTitle";
import { useCart } from "../context/CartContext";
import PartImage from "./PartImage"; // 👈 for grid thumbnails

/* ================================
   CONFIG
   ================================ */
const API_BASE = "https://api.appliancepartgeeks.com";
const AVAIL_URL = "https://api.appliancepartgeeks.com";

const BG_BLUE = "#001f3e";
const SHOP_BAR = "#efcc30";
const DEFAULT_PER_PAGE = 30;
const MODEL_SIDEBAR_LIMIT = 20; // how many models to fetch in sidebar suggest
const PART_SIDEBAR_LIMIT = 20; // how many parts to fetch in sidebar suggest

/* ================================
   UTILS
   ================================ */
const normalize = (s) => (s || "").toLowerCase().trim();

const priceFmt = (n) => {
  if (n == null || Number.isNaN(Number(n))) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(Number(n));
  } catch {
    return `$${Number(n).toFixed(2)}`;
  }
};

const fmtCount = (num) => {
  const n = Number(num);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : String(num || "");
};

const isBaseCase = ({
  invMode,
  model,
  selectedBrands,
  selectedPartTypes,
  applianceType,
}) =>
  invMode === "all" &&
  !normalize(model) &&
  (!selectedBrands || selectedBrands.length === 0) &&
  (!selectedPartTypes || selectedPartTypes.length === 0) &&
  !applianceType;

/* ================================
   PART ROW
   ================================ */
function PartRow({ p, addToCart }) {
  const navigate = useNavigate();

  const mpn =
    (p?.mpn && String(p.mpn).trim()) ||
    (p?.mpn_display && String(p.mpn_display).trim()) ||
    (p?.mpn_normalized && String(p.mpn_normalized).trim()) ||
    "";

  const isRefurb =
    p?.is_refurb === true ||
    String(p?.condition || "").toLowerCase().includes("used") ||
    String(p?.source || "").toLowerCase().includes("refurb") ||
    String(p?.offer_type || "").toLowerCase().includes("refurb");

  const baseTitle =
    makePartTitle(p, mpn) ||
    p?.title ||
    `${p?.brand || ""} ${p?.part_type || ""} ${p?.appliance_type || ""}`.trim() ||
    mpn;

  const displayTitle = isRefurb ? `Refurbished: ${baseTitle}` : baseTitle;

  const priceNum =
    typeof p?.price === "number"
      ? p.price
      : Number(String(p?.price ?? "").replace(/[^0-9.]/g, ""));

  const img = p?.image_url || null;

  const detailHref = (() => {
    if (!mpn) return "#";
    if (isRefurb) {
      const listingId = p?.listing_id || p?.offer_id || "";
      return `/refurb/${encodeURIComponent(mpn)}${
        listingId ? `?offer=${encodeURIComponent(listingId)}` : ""
      }`;
    }
    return `/parts/${encodeURIComponent(mpn)}`;
  })();

  const [qty, setQty] = useState(1);

  function handleAddToCart() {
    if (!mpn) return;
    const payload = {
      mpn,
      qty: isRefurb ? 1 : qty,
      quantity: isRefurb ? 1 : qty,
      is_refurb: !!isRefurb,
      name: displayTitle,
      title: displayTitle,
      price: priceNum,
      image_url: img,
      image: img,
    };
    try {
      addToCart?.(payload);
    } catch {
      /* no-op */
    }
  }

  function goToDetail(e) {
    e?.preventDefault?.();
    if (detailHref && detailHref !== "#") navigate(detailHref);
  }

  const cardBg = isRefurb
    ? "bg-blue-50 border-blue-300"
    : "bg-white border-gray-200";

  return (
    <div
      className={`border rounded-md shadow-sm px-4 py-3 flex flex-col lg:flex-row gap-4 ${cardBg}`}
    >
      {/* image */}
      <div
        className="relative flex-shrink-0 flex flex-col items-center"
        style={{ width: "110px" }}
      >
        <div className="relative flex items-center justify-center overflow-visible">
          <PartImage
            imageUrl={img}
            alt={mpn || "Part"}
            disableHoverPreview // click-only
            className="w-[100px] h-[100px] border border-gray-200 rounded bg-white flex items-center justify-center"
          />
        </div>
      </div>

      {/* middle */}
      <div className="flex-1 min-w-0 flex flex-col gap-2 text-black">
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
          <a
            href={detailHref}
            onClick={goToDetail}
            className="text-[15px] font-semibold text-blue-700 leading-snug hover:text-blue-900 hover:underline focus:underline focus:outline-none cursor-pointer"
            aria-label={`View ${displayTitle}`}
          >
            {displayTitle}
          </a>

          {!isRefurb && p?.stock_status && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-green-600 text-white leading-none">
              {p.stock_status}
            </span>
          )}

          {mpn && (
            <span className="text-[11px] font-mono text-gray-600 leading-none">
              Part #: {mpn}
            </span>
          )}
        </div>

        <div className="text-[12px] text-gray-700 leading-snug break-words">
          {p?.brand ? `${p.brand} ` : ""}
          {p?.part_type ? `${p?.part_type} ` : ""}
          {p?.appliance_type ? `for ${p.appliance_type}` : ""}
        </div>
      </div>

      {/* right */}
      <div className="w-full max-w-[200px] flex-shrink-0 flex flex-col items-end text-right gap-2">
        <div className="text-lg font-bold text-green-700 leading-none">
          {priceFmt(priceNum)}
        </div>

        <div className="flex items-center w-full justify-end gap-2">
          {!isRefurb && (
            <select
              className="border border-gray-300 rounded px-2 py-1 text-[12px] text-black"
              value={qty}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                setQty(Number.isFinite(parsed) ? parsed : 1);
              }}
            >
              {Array.from({ length: 10 }).map((_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          )}

          <button
            className={`${
              isRefurb
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-blue-700 hover:bg-blue-800"
            } text-white text-[12px] font-semibold rounded px-3 py-2`}
            onClick={handleAddToCart}
          >
            Add to Cart
          </button>
        </div>

        <a
          href={detailHref}
          onClick={goToDetail}
          className="underline text-blue-700 text-[11px] font-medium hover:text-blue-900"
        >
          View part
        </a>
      </div>
    </div>
  );
}

/* ================================
   MAIN EXPLORER
   ================================ */
export default function PartsExplorer() {
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // filters / search
  const [model, setModel] = useState("");
  const [applianceType, setApplianceType] = useState("");
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedPartTypes, setSelectedPartTypes] = useState([]);
  const [mpnSearch, setMpnSearch] = useState("");

  // sidebar inputs (what the user is typing)
  const [modelInput, setModelInput] = useState("");
  const [partInput, setPartInput] = useState("");

  // toggles
  const [inStockOnly, setInStockOnly] = useState(true);
  const [invMode, setInvMode] = useState("all"); // all | new_only | refurb_only
  const [sort, setSort] = useState("availability_desc,price_asc");

  // suggest state
  const [modelLoading, setModelLoading] = useState(false);
  const [modelResults, setModelResults] = useState([]);
  const [modelDropdown, setModelDropdown] = useState(false);

  const [partLoading, setPartLoading] = useState(false);
  const [partResults, setPartResults] = useState([]);
  const [partDropdown, setPartDropdown] = useState(false);

  const modelDebounceRef = useRef(null);
  const partDebounceRef = useRef(null);

  const modelBoxRef = useRef(null);
  const partBoxRef = useRef(null);

  // ✅ NEW: refs for URL-driven scroll-to-results
  const resultsRef = useRef(null);
  const pendingScrollRef = useRef(false);
  const lastSearchRef = useRef("");

  // close dropdowns on outside click
  useEffect(() => {
    function handleDocClick(e) {
      const inModel =
        modelBoxRef.current && modelBoxRef.current.contains(e.target);
      const inPart =
        partBoxRef.current && partBoxRef.current.contains(e.target);

      if (!inModel) {
        setModelDropdown(false);
      }
      if (!inPart) {
        setPartDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  // brand logos (kept for future use)
  const [brandLogos, setBrandLogos] = useState([]);
  useEffect(() => {
    fetch(`${API_BASE}/api/brand-logos`)
      .then((r) => r.json())
      .then((d) => setBrandLogos(Array.isArray(d) ? d : d?.logos || []))
      .catch(() => {});
  }, []);
  const normBrand = (s) =>
    (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const hit = (brandLogos || []).find(
      (b) => normBrand(b.name) === normBrand(brand)
    );
    return hit?.image_url || hit?.url || hit?.logo_url || hit?.src || null;
  };

  // facet options
  const [brandOpts, setBrandOpts] = useState([]);
  const [partOpts, setPartOpts] = useState([]);
  const [applianceOpts, setApplianceOpts] = useState([]);

  // results
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [serverTotals, setServerTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [clientFilteredMode, setClientFilteredMode] = useState(null);

  const abortRef = useRef(null);
  const FIRST_LOAD_DONE = useRef(false);

  const applianceQuick = [
    { label: "Refrigerator", value: "Refrigerator" },
    { label: "Washer", value: "Washer" },
    { label: "Dryer", value: "Dryer" },
    { label: "Dishwasher", value: "Dishwasher" },
    { label: "Range/Oven", value: "Range" },
    { label: "Microwave", value: "Microwave" },
  ];

  /* ================================
     BREADCRUMBS
     ================================ */
  const crumbs = useMemo(() => {
    const c = [
      { label: "Home", href: "/" },
      { label: "Parts Explorer", href: "/grid" },
    ];
    if (invMode === "new_only") c.push({ label: "New Only" });
    if (invMode === "refurb_only") c.push({ label: "Refurbished Only" });
    if (inStockOnly) c.push({ label: "In Stock Only" });
    if (applianceType) c.push({ label: applianceType });
    return c;
  }, [invMode, inStockOnly, applianceType]);

  /* ================================
     BUILD /api/grid URL
     ================================ */
  function buildGridUrl({ pageSizeOverride, dropRefurbOnly } = {}) {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("per_page", String(pageSizeOverride ?? DEFAULT_PER_PAGE));
    params.set("sort", sort);
    params.set("in_stock_only", inStockOnly ? "true" : "false");
    params.set("include_totals", "true");

    if (invMode === "all") {
      params.set("include_refurb", "true");
    } else if (invMode === "new_only") {
      params.set("include_refurb", "false");
    } else if (invMode === "refurb_only") {
      params.set("include_refurb", "true");
      if (!dropRefurbOnly) params.set("refurb_only", "true");
    }

    const trimmedModel = (model || "").trim();
    const trimmedMpn = (mpnSearch || "").trim();
    const term = trimmedMpn || trimmedModel;

    if (term) {
      params.set("q", term);
      params.set("search", term);
    }
    if (trimmedModel) {
      params.set("model", trimmedModel);
    }

    if (applianceType) params.set("appliance_type", applianceType);
    selectedBrands.forEach((b) => params.append("brands", b));
    selectedPartTypes.forEach((pt) => params.append("part_types", pt));

    return `${API_BASE}/api/grid?${params.toString()}`;
  }

  const filterSig = useMemo(
    () =>
      JSON.stringify({
        model: normalize(model),
        mpnSearch: normalize(mpnSearch),
        applianceType,
        selectedBrands: [...selectedBrands].sort(),
        selectedPartTypes: [...selectedPartTypes].sort(),
        inStockOnly,
        invMode,
        sort,
      }),
    [
      model,
      mpnSearch,
      applianceType,
      selectedBrands,
      selectedPartTypes,
      inStockOnly,
      invMode,
      sort,
    ]
  );

  async function tryOnce(url) {
    const r = await fetch(url, { signal: abortRef.current?.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  /* ================================
     FETCH GRID (with refurb fallback)
     ================================ */
  async function runFetch() {
    setErrorMsg("");
    setLoading(true);
    setClientFilteredMode(null);

    abortRef.current?.abort?.();
    const ctl = new AbortController();
    abortRef.current = ctl;

    try {
      const data = await tryOnce(buildGridUrl());

      const items = Array.isArray(data?.items) ? data.items : [];
      const decorated = items.map((it) => {
        const flag =
          it.is_refurb === true ||
          String(it?.condition || "").toLowerCase().includes("used") ||
          String(it?.source || "").toLowerCase().includes("refurb") ||
          String(it?.offer_type || "").toLowerCase().includes("refurb");
        return { ...it, is_refurb: !!flag };
      });

      setRows(decorated);

      const serverTotal =
        typeof data?.total_count === "number"
          ? data.total_count
          : decorated.length;
      setTotalCount(serverTotal);
      setServerTotals(data?.totals || null);

      const mk = (arr = []) =>
        (Array.isArray(arr) ? arr : []).map((o) => ({
          value: o.value,
          count: o.count,
        }));

      if (data?.facets?.brands) setBrandOpts(mk(data.facets.brands));
      if (data?.facets?.parts) setPartOpts(mk(data.facets.parts));
      if (data?.facets?.appliances) setApplianceOpts(mk(data.facets.appliances));

      const serverRefurbCount =
        data?.totals?.refurb_only_total ?? data?.totals?.refurb ?? null;
      const visibleRefurbs = decorated.filter((x) => x.is_refurb).length;

      const needRefurbFallback =
        invMode === "refurb_only" &&
        ((typeof serverRefurbCount === "number" &&
          visibleRefurbs < serverRefurbCount) ||
          visibleRefurbs < Math.min(DEFAULT_PER_PAGE, 30));

      if (needRefurbFallback) {
        try {
          const fallback = await tryOnce(
            buildGridUrl({ pageSizeOverride: 1000, dropRefurbOnly: true })
          );
          const items2 = Array.isArray(fallback?.items) ? fallback.items : [];
          const refurbs = items2
            .map((it) => {
              const flag =
                it.is_refurb === true ||
                String(it?.condition || "").toLowerCase().includes("used") ||
                String(it?.source || "").toLowerCase().includes("refurb") ||
                String(it?.offer_type || "").toLowerCase().includes("refurb");
              return { ...it, is_refurb: !!flag };
            })
            .filter((x) => x.is_refurb);

          if (refurbs.length) {
            setRows(refurbs);
            setClientFilteredMode("refurb_only");
            const apiTotal =
              typeof fallback?.totals?.refurb_only_total === "number"
                ? fallback.totals.refurb_only_total
                : typeof fallback?.totals?.refurb === "number"
                ? fallback.totals.refurb
                : typeof fallback?.total_count === "number"
                ? fallback.total_count
                : null;
            setTotalCount(
              typeof apiTotal === "number" ? apiTotal : refurbs.length
            );
            setServerTotals(fallback?.totals || null);
          }
        } catch {
          // keep primary results
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("grid fetch error:", e);
        setErrorMsg("Search failed. Try adjusting filters.");
      }
    } finally {
      setLoading(false);
    }
  }

  /* ================================
     CLIENT DISPLAY FILTERS
     ================================ */
  const displayedRows = useMemo(() => {
    let out = rows;

    if (!clientFilteredMode) {
      if (invMode === "refurb_only")
        out = out.filter((it) => it.is_refurb === true);
      else if (invMode === "new_only") out = out.filter((it) => !it.is_refurb);
    }

    const term = normalize(mpnSearch || model);
    if (term.length >= 1) {
      const hit = (v) => (v ?? "").toString().toLowerCase().includes(term);
      out = out.filter(
        (it) =>
          hit(it.mpn) ||
          hit(it.mpn_display) ||
          hit(it.mpn_normalized) ||
          hit(it.title) ||
          hit(it.name) ||
          hit(it.brand) ||
          hit(it.part_type) ||
          hit(it.appliance_type)
      );
    }

    if (selectedBrands.length) {
      const setB = new Set(selectedBrands.map((b) => b.toLowerCase()));
      out = out.filter((it) => setB.has((it.brand || "").toLowerCase()));
    }
    if (selectedPartTypes.length) {
      const setP = new Set(selectedPartTypes.map((t) => t.toLowerCase()));
      out = out.filter((it) => setP.has((it.part_type || "").toLowerCase()));
    }

    if (applianceType) {
      const at = applianceType.toLowerCase();
      out = out.filter(
        (it) => (it.appliance_type || "").toLowerCase() === at
      );
    }

    if (
      !clientFilteredMode &&
      isBaseCase({
        invMode,
        model,
        selectedBrands,
        selectedPartTypes,
        applianceType,
      })
    ) {
      const refurbs = [];
      const others = [];
      for (const r of out) {
        if (r.is_refurb === true && refurbs.length < 3) refurbs.push(r);
        else others.push(r);
      }
      out = [...refurbs, ...others];
    }

    return out;
  }, [
    rows,
    invMode,
    clientFilteredMode,
    model,
    mpnSearch,
    selectedBrands,
    selectedPartTypes,
    applianceType,
  ]);

  const effectiveTotalCount = useMemo(() => {
    if (clientFilteredMode === "refurb_only") return displayedRows.length;

    if (invMode === "refurb_only") {
      if (typeof serverTotals?.refurb_only_total === "number")
        return serverTotals.refurb_only_total;
      if (typeof serverTotals?.refurb === "number") return serverTotals.refurb;
      return displayedRows.length;
    }
    if (invMode === "new_only") {
      if (typeof serverTotals?.new_only_total === "number")
        return serverTotals.new_only_total;
      if (typeof serverTotals?.new === "number") return serverTotals.new;
      return displayedRows.length;
    }
    return typeof totalCount === "number" ? totalCount : displayedRows.length;
  }, [clientFilteredMode, displayedRows.length, invMode, serverTotals, totalCount]);

  /* ================================
     URL SYNC (reactive) + mark scroll
     ================================ */
  useEffect(() => {
    // only run when search actually changes
    if (lastSearchRef.current === location.search) return;
    lastSearchRef.current = location.search;

    const params = new URLSearchParams(location.search);

    // mark "scroll to results" when arriving via a facet-style URL
    const hasFacet =
  params.has("brand") ||
  params.has("brand_name") ||
  params.has("brand_slug") ||
  params.has("appliance_type") ||
  params.has("applianceType") ||
  params.has("appliance") ||
  params.has("category") ||
  params.has("part_type") ||
  params.has("partType") ||
  params.has("part") ||
  params.has("part_category") ||
  params.has("model") ||
  params.has("model_number") ||
  // also treat hash routes as "facet-style" so we scroll even if params are light
  (typeof window !== "undefined" &&
    (window.location.hash === "#grid" || window.location.hash === "#results"));
    if (hasFacet) pendingScrollRef.current = true;

    const qpModel = (params.get("model") || params.get("model_number") || "").trim();

// Brand
const qpBrand = (
  params.get("brand") ||
  params.get("brand_name") ||
  params.get("brand_slug") ||
  ""
).trim();

// Appliance type (support multiple historical keys)
const qpAppliance = (
  params.get("appliance_type") ||
  params.get("applianceType") ||
  params.get("appliance") ||
  params.get("category") ||
  ""
).trim();

// Part type (support multiple historical keys)
const qpPartType = (
  params.get("part_type") ||
  params.get("partType") ||
  params.get("part") ||
  params.get("part_category") ||
  ""
).trim();

    // Apply URL-driven filters (override current filters)
    setModel(qpModel);
    setModelInput(qpModel);

    setApplianceType(qpAppliance);

    setSelectedBrands(qpBrand ? [qpBrand] : []);
    setSelectedPartTypes(qpPartType ? [qpPartType] : []);
  }, [location.search, location.hash]);

  // initial fetch
  useEffect(() => {
    if (!FIRST_LOAD_DONE.current) {
      FIRST_LOAD_DONE.current = true;
      runFetch();
    }
  }, []);

  // refetch when filters change
  useEffect(() => {
    if (FIRST_LOAD_DONE.current) runFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSig]);

  // ✅ Scroll into view once fetch completes after a facet navigation.
  // Scroll even if empty so the user sees "No results..." in the grid area.
  useEffect(() => {
    if (!pendingScrollRef.current) return;
    if (loading) return;
    if (!resultsRef.current) return;

    pendingScrollRef.current = false;

    requestAnimationFrame(() => {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading, displayedRows.length, errorMsg]);

  /* ================================
     SUGGESTION BARS
     ================================ */

  // Models suggest: use SAME /api/suggest as header, show up to 30
  const runModelSuggest = useCallback(async (term) => {
    const q = (term || "").trim();
    if (q.length < 2) {
      setModelResults([]);
      setModelDropdown(false);
      return;
    }

    setModelLoading(true);
    try {
      const params = new URLSearchParams({
        q,
        limit: String(MODEL_SIDEBAR_LIMIT), // 20
        include_counts: "false", // fast path
        src: "grid_sidebar",
      });

      const r = await fetch(`${API_BASE}/api/suggest?${params.toString()}`);

      if (!r.ok) {
        console.error("sidebar model suggest HTTP", r.status);
        setModelResults([]);
        setModelDropdown(false);
        return;
      }

      const data = await r.json();

      const withPriced = Array.isArray(data?.with_priced_parts)
        ? data.with_priced_parts
        : [];
      const withoutPriced = Array.isArray(data?.without_priced_parts)
        ? data.without_priced_parts
        : [];

      const rawModels = [...withPriced, ...withoutPriced];

      const models = rawModels
        .map((m) => ({
          model_number: m?.model_number || "",
          brand: m?.brand || "",
          appliance_type: m?.appliance_type || "",
        }))
        .filter((m) => m.model_number);

      const sliced = models.slice(0, MODEL_SIDEBAR_LIMIT);

      setModelResults(sliced);
      setModelDropdown(sliced.length > 0);
    } catch (err) {
      console.error("sidebar model suggest error:", err);
      setModelResults([]);
      setModelDropdown(false);
    } finally {
      setModelLoading(false);
    }
  }, []);

  function handleModelBarChange(e) {
    const val = e.target.value;
    setModelInput(val);
    clearTimeout(modelDebounceRef.current);
    modelDebounceRef.current = setTimeout(() => runModelSuggest(val), 300);
  }

  function chooseModel(m) {
    const chosen = m?.model_number || "";
    if (!chosen) return;
    navigate(`/models/${encodeURIComponent(chosen)}`);
    setModelDropdown(false);
    setModelInput("");
  }

  // Parts / offers suggest: NOW uses /api/suggest/search (parts + offers)
  const runPartSuggest = useCallback(
    async (term) => {
      const q = (term || "").trim();
      if (q.length < 2) {
        setPartResults([]);
        setPartDropdown(false);
        setPartLoading(false); // ensure spinner is cleared on short queries
        return;
      }
      setPartLoading(true);
      try {
        const params = new URLSearchParams({
          q,
          limit: String(PART_SIDEBAR_LIMIT),
        });

        // refurb-aware suggest_search endpoint
        const r = await fetch(
          `${API_BASE}/api/suggest/search?${params.toString()}`
        );

        if (!r.ok) {
          console.error("sidebar part suggest HTTP", r.status);
          setPartResults([]);
          setPartDropdown(false);
          return;
        }

        const raw = await r.json();
        const arr = Array.isArray(raw?.parts) ? raw.parts : [];

        const out = arr
          .map((p) => {
            const mpn =
              p?.mpn || p?.mpn_normalized || p?.mpn_display || p?.part_number;
            if (!mpn) return null;
            return {
              mpn,
              name: p?.name || p?.title || "",
              brand: p?.brand || "",
              price:
                typeof p?.price === "number"
                  ? p.price
                  : Number(String(p?.price ?? "").replace(/[^0-9.]/g, "")),
              is_refurb: p?.is_refurb === true,
              offer_id: p?.offer_id ?? p?.listing_id ?? null,
            };
          })
          .filter(Boolean)
          .slice(0, PART_SIDEBAR_LIMIT);

        setPartResults(out);
        setPartDropdown(out.length > 0);
      } catch (err) {
        console.error("sidebar part suggest error:", err);
        setPartResults([]);
        setPartDropdown(false);
      } finally {
        setPartLoading(false);
      }
    },
    []
  );

  function handlePartBarChange(e) {
    const val = e.target.value;
    setPartInput(val);
    clearTimeout(partDebounceRef.current);
    partDebounceRef.current = setTimeout(() => runPartSuggest(val), 300);
  }

  function choosePartOrOffer(x) {
    const mpn = x?.mpn;
    if (!mpn) return;

    const isRefurb = x?.is_refurb === true;
    const offerId = x?.offer_id || x?.listing_id || null;

    const href = isRefurb
      ? `/refurb/${encodeURIComponent(mpn)}${
          offerId ? `?offer=${encodeURIComponent(offerId)}` : ""
        }`
      : `/parts/${encodeURIComponent(mpn)}`;

    navigate(href);
    setPartDropdown(false);
    setPartInput("");
  }

  const showModelMoreHint = modelResults.length === MODEL_SIDEBAR_LIMIT;
  const showPartMoreHint = partResults.length === PART_SIDEBAR_LIMIT;

  // Reset everything
  const handleResetAll = () => {
    setModelInput("");
    setPartInput("");
    setMpnSearch("");
    setModel("");
    setApplianceType("");
    setSelectedBrands([]);
    setSelectedPartTypes([]);
    setInStockOnly(true);
    setInvMode("all");
    setSort("availability_desc,price_asc");
    setModelResults([]);
    setPartResults([]);
    setModelDropdown(false);
    setPartDropdown(false);
    setClientFilteredMode(null);
  };

  function FacetList({ title, values, selectedValues, onToggle }) {
    return (
      <div className="px-4 py-3 border-b border-gray-200 text-black">
        <div className="text-sm font-semibold text-black mb-2">{title}</div>
        <ul className="text-sm text-black max-h-48 overflow-y-auto pr-1 space-y-2">
          {values.map((o) => {
            const checked = selectedValues.includes(o.value);
            return (
              <li key={o.value} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 mt-[2px]"
                  checked={checked}
                  onChange={() => onToggle(o.value)}
                />
                <label
                  className="flex-1 cursor-pointer leading-tight text-[13px] text-black"
                  onClick={() => onToggle(o.value)}
                >
                  <span className="truncate">
                    {o.value}{" "}
                    <span className="opacity-70">({fmtCount(o.count)})</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const CategoryBar = () => (
    <div
      className="w-full border-b border-gray-700"
      style={{ backgroundColor: BG_BLUE }}
    >
      <div className="mx-auto w-[min(1300px,96vw)] px-4 py-3 flex flex-wrap gap-2">
        {applianceQuick.map((cat) => {
          const active = applianceType === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() =>
                setApplianceType((prev) => (prev === cat.value ? "" : cat.value))
              }
              className={[
                "px-3 py-1.5 rounded-full text-sm font-semibold border transition",
                active
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-white border-white hover:bg-white hover:text-black",
              ].join(" ")}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <section
      className="w-full min-h-screen text-black"
      style={{ backgroundColor: BG_BLUE }}
    >
      <CategoryBar />

      {/* Breadcrumb */}
      <div className="mx-auto w-[min(1300px,96vw)] px-4 pt-4">
        <nav className="text-[12px] text-gray-300">
          {crumbs.map((c, i) => (
            <span key={i}>
              {c.href ? (
                <Link to={c.href} className="hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className="text-white">{c.label}</span>
              )}
              {i < crumbs.length - 1 && (
                <span className="mx-2 text-gray-500">/</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="mx-auto w-[min(1300px,96vw)] py-2">
        <div className="bg-white border border-gray-300 rounded-md shadow-sm text-black">
          <div className="grid grid-cols-12 gap-6 p-4 md:p-6">
            {/* Sidebar */}
            <aside className="col-span-12 md:col-span-4 lg:col-span-3">
              <div className="border border-gray-300 rounded-md overflow-hidden text-black">
                <div
                  className="font-semibold px-4 py-2 text-sm"
                  style={{ backgroundColor: SHOP_BAR, color: "black" }}
                >
                  SHOP BY
                </div>

                {/* Model suggest bar */}
                <div
                  className="px-4 py-3 border-b border-gray-200 relative"
                  ref={modelBoxRef}
                >
                  <input
                    type="text"
                    placeholder="Enter model #"
                    className="w-full border border-gray-300 rounded px-2 py-2 text-sm text-black placeholder-gray-500"
                    value={modelInput}
                    onChange={handleModelBarChange}
                    onFocus={() => {
                      if (modelResults.length && modelInput.trim().length >= 2)
                        setModelDropdown(true);
                    }}
                  />

                  {modelDropdown && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg text-sm text-black max-h-80 overflow-y-auto">
                      {modelLoading ? (
                        <div className="px-3 py-2 text-gray-500 text-[12px] italic">
                          Searching…
                        </div>
                      ) : modelResults.length ? (
                        <>
                          <div className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wide bg-gray-50">
                            Models
                          </div>
                          {modelResults.map((m, idx) => (
                            <button
                              key={`model-${idx}`}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 flex flex-col"
                              onClick={() => chooseModel(m)}
                            >
                              <div className="text-[13px] font-semibold text-gray-900 leading-tight">
                                {m.model_number || "Unknown model"}
                              </div>
                              <div className="text-[11px] text-gray-600 leading-tight">
                                {m.brand ? `${m.brand} ` : ""}
                                {m.appliance_type ? `• ${m.appliance_type}` : ""}
                              </div>
                            </button>
                          ))}
                          {showModelMoreHint && (
                            <div className="px-3 py-2 text-[11px] text-gray-600 bg-gray-50 border-t border-gray-200">
                              There may be more matching models. Add a few more
                              characters to narrow it down.
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="px-3 py-2 text-[12px] text-gray-500">
                          No model matches.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Parts / offers suggest bar */}
                <div
                  className="px-4 py-3 border-b border-gray-200 relative"
                  ref={partBoxRef}
                >
                  <input
                    type="text"
                    placeholder="Search parts / MPN"
                    className="w-full border border-gray-300 rounded px-2 py-2 pr-8 text-sm text-black placeholder-gray-500"
                    value={partInput}
                    onChange={handlePartBarChange}
                    onFocus={() => {
                      if (partResults.length && partInput.trim().length >= 2)
                        setPartDropdown(true);
                    }}
                  />

                  {/* inline spinner inside the input */}
                  {partLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                  )}

                  {partDropdown && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg text-sm text-black max-h-80 overflow-y-auto">
                      {partLoading ? (
                        <div className="px-3 py-2 text-gray-500 text-[12px] italic flex items-center gap-2">
                          <span className="inline-block w-3 h-3 border-[2px] border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                          <span>Searching…</span>
                        </div>
                      ) : partResults.length ? (
                        <>
                          <div className="px-3 py-2 text-[11px] font-semibold text-gray-700 uppercase tracking-wide bg-gray-50">
                            Parts
                          </div>
                          {partResults.map((p, idx) => (
                            <button
                              key={`part-${idx}`}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 flex flex-col"
                              onClick={() => choosePartOrOffer(p)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="text-[13px] font-semibold text-gray-900 leading-tight">
                                  {p.name || p.mpn || "Part"}
                                </div>
                                {typeof p.price === "number" &&
                                  !Number.isNaN(p.price) && (
                                    <div className="text-[12px] font-bold text-green-700 ml-2 whitespace-nowrap">
                                      {priceFmt(p.price)}
                                    </div>
                                  )}
                              </div>
                              <div className="text-[11px] text-gray-600 leading-tight">
                                MPN:{" "}
                                <span className="font-mono">
                                  {p.mpn || "—"}
                                </span>
                                {p.brand && (
                                  <span className="ml-2 opacity-70">
                                    • {p.brand}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                          {showPartMoreHint && (
                            <div className="px-3 py-2 text-[11px] text-gray-600 bg-gray-50 border-t border-gray-200">
                              There may be more matching parts. Add a few more
                              characters to narrow it down.
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="px-3 py-2 text-[12px] text-gray-500">
                          No matches.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Reset */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="w-full px-3 py-2 text-sm font-semibold rounded border border-gray-300 bg-white hover:bg-gray-100"
                  >
                    Reset
                  </button>
                </div>

                {/* toggles */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <label className="flex items-center gap-2 text-sm text_black">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                    />
                    <span className="text-black">In Stock Only</span>
                  </label>

                  <div className="text-sm text-black mt-3">
                    <div className="font-semibold mb-1">Show</div>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="invMode"
                          className="h-4 w-4"
                          checked={invMode === "all"}
                          onChange={() => setInvMode("all")}
                        />
                        <span>All (New + Refurbished)</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="invMode"
                          className="h-4 w-4"
                          checked={invMode === "new_only"}
                          onChange={() => setInvMode("new_only")}
                        />
                        <span>New Only</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="invMode"
                          className="h-4 w-4"
                          checked={invMode === "refurb_only"}
                          onChange={() => setInvMode("refurb_only")}
                        />
                        <span>Refurbished Only</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* facets */}
                <FacetList
                  title="Brands"
                  values={brandOpts}
                  selectedValues={selectedBrands}
                  onToggle={(val) =>
                    setSelectedBrands((prev) =>
                      prev.includes(val)
                        ? prev.filter((v) => v !== val)
                        : [...prev, val]
                    )
                  }
                />
                <FacetList
                  title="Part Type"
                  values={partOpts}
                  selectedValues={selectedPartTypes}
                  onToggle={(val) =>
                    setSelectedPartTypes((prev) =>
                      prev.includes(val)
                        ? prev.filter((v) => v !== val)
                        : [...prev, val]
                    )
                  }
                />

                <div className="px-4 py-3 text-black">
                  <div className="font-semibold text-black mb-1 text-sm">
                    Sort By
                  </div>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-2 text-sm bg-white text-black"
                  >
                    <option value="availability_desc,price_asc">
                      Best availability / Popular
                    </option>
                    <option value="price_asc">Price: Low → High</option>
                    <option value="price_desc">Price: High → Low</option>
                  </select>
                </div>
              </div>
            </aside>

            {/* Main */}
            <main className="col-span-12 md:col-span-8 lg:col-span-9">
              <div className="border border-gray-300 rounded-md shadow-sm text-black bg-white">
                <div className="px-4 pt-4 pb-2 border-b border-gray-200">
                  <div className="text-xl font-semibold text_black">
                    {applianceType
                      ? `${applianceType} – Models and Parts Results`
                      : "Models and Parts Results"}
                  </div>
                  <div className="mt-1 text-[13px] text-gray-700 leading-snug">
                    Find genuine OEM and refurbished parts from top brands.
                    Check availability and add to cart. Fast shipping.
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-gray-700">
                    <div className="font-semibold">
                      Showing {fmtCount(displayedRows.length)} of{" "}
                      {fmtCount(effectiveTotalCount)} items
                    </div>
                    {clientFilteredMode === "refurb_only" && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-gray-100 text-gray-700 border border-gray-300">
                        Filtered view (refurb fallback)
                      </span>
                    )}
                    {loading && (
                      <span className="ml-auto inline-flex items-center gap-2 text-gray-600 text-[13px]">
                        <span className="animate-spin">⏳</span> Loading…
                      </span>
                    )}
                  </div>
                </div>

                {/* ✅ attach scroll target here */}
                <div
                  ref={resultsRef}
                  id="results-grid"
                  className="p-4 space-y-4 max-h-[100vh] overflow-y-auto pr-1"
                >
                  {errorMsg ? (
                    <div className="text-red-600 text-sm">{errorMsg}</div>
                  ) : displayedRows.length === 0 && !loading ? (
                    <div className="text-sm text-gray-500">
                      No results. Try widening your filters.
                    </div>
                  ) : (
                    displayedRows.map((partRow, i) => (
                      <PartRow
                        key={`${partRow.mpn_normalized || partRow.mpn || i}-${i}`}
                        p={partRow}
                        addToCart={addToCart}
                      />
                    ))
                  )}
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </section>
  );
}
