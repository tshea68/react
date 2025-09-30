// src/components/Header.jsx
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import HeaderMenu from "./HeaderMenu";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

// Caps & guards
const MAX_MODELS = 15;
const MAX_PARTS = 5;
const MIN_MODEL_CHARS = 2;
const MIN_PART_CHARS = 1;
const DEBOUNCE_MS = 250;

export default function Header() {
  const navigate = useNavigate();

  // Inputs
  const [modelQuery, setModelQuery] = useState("");
  const [partQuery, setPartQuery] = useState("");

  // Results
  const [modelsWithPrice, setModelsWithPrice] = useState([]);
  const [modelsNoPrice, setModelsNoPrice] = useState([]);
  const [partItems, setPartItems] = useState([]);

  // UI state
  const [openDropdown, setOpenDropdown] = useState(null); // 'models' | 'parts' | null
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingParts, setIsLoadingParts] = useState(false);

  // Brand logos
  const [brandLogos, setBrandLogos] = useState({});

  // Abort + debounce + simple caches
  const modelAbortRef = useRef(null);
  const partAbortRef = useRef(null);
  const modelTimerRef = useRef(null);
  const partTimerRef = useRef(null);
  const modelCacheRef = useRef(new Map()); // key: trimmed query -> payload
  const partCacheRef = useRef(new Map());

  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // Fetch brand logos once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/brand-logos`, { timeout: 6000 });
        const map = {};
        (res.data || []).forEach((r) => {
          const key = ((r.name || r.brand || "") + "").trim().toLowerCase();
          if (key && r.image_url) map[key] = r.image_url;
        });
        if (!cancelled) setBrandLogos(map);
      } catch (_) {
        /* logos are optional */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const brandLogoFor = (brand) => brandLogos[(brand || "").trim().toLowerCase()];

  // ---- Models fetch (single call per input, abort in-flight) -----------------
  const fetchModels = async (query) => {
    const trimmed = (query || "").trim();
    if (modelCacheRef.current.has(trimmed)) {
      return modelCacheRef.current.get(trimmed);
    }

    if (modelAbortRef.current) modelAbortRef.current.abort();
    modelAbortRef.current = new AbortController();
    setIsLoadingModels(true);
    try {
      // Let backend infer brand/model from q; fastest path
      const res = await axios.get(`${API_BASE}/api/suggest`, {
        params: { q: trimmed, limit: MAX_MODELS },
        signal: modelAbortRef.current.signal,
        timeout: 6000,
      });
      const payload = {
        with_priced_parts: res?.data?.with_priced_parts || [],
        without_priced_parts: res?.data?.without_priced_parts || [],
      };
      modelCacheRef.current.set(trimmed, payload);
      return payload;
    } finally {
      setIsLoadingModels(false);
    }
  };

  // ---- Parts fetch (single call per input, abort in-flight) ------------------
  const fetchParts = async (query) => {
    const trimmed = (query || "").trim();
    if (partCacheRef.current.has(trimmed)) {
      return partCacheRef.current.get(trimmed);
    }

    if (partAbortRef.current) partAbortRef.current.abort();
    partAbortRef.current = new AbortController();
    setIsLoadingParts(true);
    try {
      const res = await axios.get(`${API_BASE}/api/suggest/parts`, {
        params: { q: trimmed, limit: MAX_PARTS },
        signal: partAbortRef.current.signal,
        timeout: 6000,
      });
      const payload = Array.isArray(res?.data) ? res.data : [];
      partCacheRef.current.set(trimmed, payload);
      return payload;
    } finally {
      setIsLoadingParts(false);
    }
  };

  // ---- Input handlers w/ debounce -------------------------------------------
  const onModelChange = (e) => {
    const v = e.target.value;
    setModelQuery(v);
    setOpenDropdown("models");
    if (modelTimerRef.current) clearTimeout(modelTimerRef.current);

    modelTimerRef.current = setTimeout(async () => {
      const q = v;
      if (!q || norm(q).length < MIN_MODEL_CHARS) {
        setModelsWithPrice([]);
        setModelsNoPrice([]);
        return;
      }
      const data = await fetchModels(q);
      const withP = data.with_priced_parts.slice(0, MAX_MODELS);
      const withoutP = data.without_priced_parts.slice(
        0,
        Math.max(0, MAX_MODELS - withP.length)
      );
      setModelsWithPrice(withP);
      setModelsNoPrice(withoutP);
    }, DEBOUNCE_MS);
  };

  const onPartChange = (e) => {
    const v = e.target.value;
    setPartQuery(v);
    setOpenDropdown("parts");
    if (partTimerRef.current) clearTimeout(partTimerRef.current);

    partTimerRef.current = setTimeout(async () => {
      const q = v;
      if (!q || norm(q).length < MIN_PART_CHARS) {
        setPartItems([]);
        return;
      }
      const items = await fetchParts(q);
      setPartItems(items.slice(0, MAX_PARTS));
    }, DEBOUNCE_MS);
  };

  // Close dropdown on outside click
  const wrapRef = useRef(null);
  useEffect(() => {
    const onClick = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpenDropdown(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ---- Presentational subcomponents (keep badges exactly) --------------------
  const ModelCard = ({ item }) => (
    <Link
      to={`/model?model=${encodeURIComponent(item.model_number)}`}
      className="block rounded-xl border border-zinc-700/30 bg-zinc-900/60 hover:bg-zinc-800/60 p-3"
      onClick={() => setOpenDropdown(null)}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm text-zinc-300 truncate">{item.brand}</div>
          <div className="font-semibold text-zinc-100 truncate">{item.model_number}</div>
          <div className="text-xs text-zinc-400 truncate">{item.appliance_type}</div>
        </div>
        {brandLogoFor(item.brand) && (
          <img
            src={brandLogoFor(item.brand)}
            alt={item.brand}
            className="h-6 w-auto opacity-90"
            loading="lazy"
          />
        )}
      </div>
      {/* Badges — unchanged semantics */}
      <div className="mt-2 flex gap-2 text-[11px]">
        <span className="rounded bg-zinc-700/60 px-2 py-0.5 text-zinc-200">
          Parts: {item.total_parts ?? 0}
        </span>
        <span className="rounded bg-emerald-700/60 px-2 py-0.5 text-emerald-100">
          Priced: {item.priced_parts ?? 0}
        </span>
        {typeof item.refurb_count === "number" && item.refurb_count > 0 && (
          <span className="rounded bg-sky-700/60 px-2 py-0.5 text-sky-100">
            Refurb: {item.refurb_count}
          </span>
        )}
      </div>
    </Link>
  );

  const PartRow = ({ p }) => (
    <Link
      to={`/parts/${encodeURIComponent(p.mpn)}`}
      className="flex items-center justify-between rounded-lg border border-zinc-700/30 bg-zinc-900/60 hover:bg-zinc-800/60 px-3 py-2"
      onClick={() => setOpenDropdown(null)}
    >
      <div className="min-w-0">
        <div className="truncate text-sm text-zinc-300">{p.brand || "—"}</div>
        <div className="truncate text-[13px] font-semibold text-zinc-100">{p.mpn}</div>
        <div className="truncate text-[12px] text-zinc-400">{p.name}</div>
      </div>
      <div className="ml-3 text-right">
        {p.price ? (
          <div className="text-sm font-medium text-emerald-200">
            ${Number(p.price).toFixed(2)}
          </div>
        ) : (
          <div className="text-xs text-zinc-400">See details</div>
        )}
        <div className="text-[11px] text-zinc-500">{p.stock_status || ""}</div>
      </div>
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0b1420] shadow">
      <div className="mx-auto max-w-7xl px-4 py-3">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo192.png" alt="Appliance Part Geeks" className="h-10 w-10" />
              <span className="hidden sm:block font-semibold text-zinc-100">
                Appliance Part Geeks
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <HeaderMenu />
          </div>
        </div>

        {/* Search row */}
        <div ref={wrapRef} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Models search */}
          <div className="relative">
            <input
              value={modelQuery}
              onChange={onModelChange}
              onFocus={() => setOpenDropdown("models")}
              placeholder="Search models"
              className="w-full rounded-lg border border-zinc-700/50 bg-zinc-900/70 px-3 py-2 text-zinc-100 placeholder-zinc-500 outline-none focus:border-sky-500"
            />
            {openDropdown === "models" &&
              (isLoadingModels ||
                modelsWithPrice.length > 0 ||
                modelsNoPrice.length > 0) && (
                <div className="absolute left-0 right-0 mt-2 max-h-[420px] overflow-y-auto rounded-xl border border-zinc-700/40 bg-[#0e1724] p-3 shadow-2xl">
                  {isLoadingModels && (
                    <div className="px-2 py-1 text-sm text-zinc-400">Searching…</div>
                  )}

                  {modelsWithPrice.length > 0 && (
                    <>
                      <div className="px-2 pb-1 text-[11px] uppercase tracking-wide text-zinc-400">
                        Models
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {modelsWithPrice.map((m) => (
                          <ModelCard key={`${m.brand}:${m.model_number}:priced`} item={m} />
                        ))}
                      </div>
                    </>
                  )}

                  {modelsNoPrice.length > 0 && (
                    <>
                      <div className="mt-3 px-2 pb-1 text-[11px] uppercase tracking-wide text-zinc-500">
                        Identified (no priced parts)
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {modelsNoPrice.map((m) => (
                          <ModelCard key={`${m.brand}:${m.model_number}:npriced`} item={m} />
                        ))}
                      </div>
                    </>
                  )}

                  {!isLoadingModels &&
                    modelsWithPrice.length === 0 &&
                    modelsNoPrice.length === 0 && (
                      <div className="px-2 py-1 text-sm text-zinc-400">No model matches.</div>
                    )}
                </div>
              )}
          </div>

          {/* Parts search */}
          <div className="relative">
            <input
              value={partQuery}
              onChange={onPartChange}
              onFocus={() => setOpenDropdown("parts")}
              placeholder="Search parts / MPN"
              className="w-full rounded-lg border border-zinc-700/50 bg-zinc-900/70 px-3 py-2 text-zinc-100 placeholder-zinc-500 outline-none focus:border-sky-500"
            />
            {openDropdown === "parts" && (isLoadingParts || partItems.length > 0) && (
              <div className="absolute left-0 right-0 mt-2 max-h-[420px] overflow-y-auto rounded-xl border border-zinc-700/40 bg-[#0e1724] p-3 shadow-2xl">
                {isLoadingParts && (
                  <div className="px-2 py-1 text-sm text-zinc-400">Searching…</div>
                )}
                {!isLoadingParts && partItems.length === 0 && (
                  <div className="px-2 py-1 text-sm text-zinc-400">No parts found.</div>
                )}
                <div className="flex flex-col gap-2">
                  {partItems.map((p) => (
                    <PartRow key={p.mpn} p={p} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
