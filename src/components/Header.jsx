// src/components/Header.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import HeaderMenu from "./HeaderMenu";
import { makePartTitle } from "../lib/PartsTitle"; // used for parts/offer card titles

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

const MAX_MODELS = 15;
const MAX_PARTS = 5;
const MAX_REFURB = 5;

// If your app uses env for API, you can swap:
// const API_BASE = import.meta.env.VITE_API_URL ?? "https://fastapi-app-kkkq.onrender.com";

export default function Header() {
  const navigate = useNavigate();

  /* ---------------- state ---------------- */
  const [modelQuery, setModelQuery] = useState("");
  const [partQuery, setPartQuery] = useState("");

  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [refurbSuggestions, setRefurbSuggestions] = useState([]);

  const [open, setOpen] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingParts, setLoadingParts] = useState(false);
  const [loadingRefurb, setLoadingRefurb] = useState(false);

  const modelTimerRef = useRef(null);
  const partTimerRef = useRef(null);

  /* ---------------- helpers ---------------- */
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

  // Build canonical Part href: always local route by *raw/original* MPN
  const buildPartHref = (p) => {
    const mpn =
      p?.mpn ?? p?.MPN ?? p?.part_number ?? p?.partNumber ?? p?.mpn_raw ?? p?.mpn_original;
    return mpn ? `/parts/${encodeURIComponent(mpn)}` : "#";
  };

  // 🔧 Surgical fix: Build canonical Offer href the same way SingleProduct expects.
  // Priority:
  // 1) Internal offer id/slug      → /offer/:id
  // 2) Source + listing id         → /offer/:source/:listing_id
  // 3) Fallback to external URL    → listing_url (opens offsite)
  const buildOfferHref = (o) => {
    const id = o?.id ?? o?.offer_id ?? o?.internal_id ?? o?.slug;
    const source = o?.source || o?.market || o?.vendor;      // e.g., "ebay", "az"
    const listingId = o?.listing_id || o?.ebay_item_id || o?.item_id;

    if (id) return `/offer/${encodeURIComponent(String(id))}`;
    if (source && listingId) return `/offer/${encodeURIComponent(source)}/${encodeURIComponent(String(listingId))}`;
    if (o?.listing_url) return o.listing_url;
    return "#";
  };

  const cancelTimer = (ref) => {
    if (ref.current) {
      clearTimeout(ref.current);
      ref.current = null;
    }
  };

  /* ---------------- fetchers ---------------- */
  // Models (brand/model suggestions)
  useEffect(() => {
    cancelTimer(modelTimerRef);
    if (!modelQuery?.trim()) {
      setModelSuggestions([]);
      return;
    }
    modelTimerRef.current = setTimeout(async () => {
      setLoadingModels(true);
      try {
        const { data } = await axios.get(`${API_BASE}/api/suggest`, {
          params: { q: modelQuery, limit: MAX_MODELS },
        });
        setModelSuggestions(Array.isArray(data) ? data.slice(0, MAX_MODELS) : []);
      } catch {
        setModelSuggestions([]);
      } finally {
        setLoadingModels(false);
      }
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelQuery]);

  // Parts + Refurb (separate endpoints)
  useEffect(() => {
    cancelTimer(partTimerRef);
    if (!partQuery?.trim()) {
      setPartSuggestions([]);
      setRefurbSuggestions([]);
      return;
    }
    partTimerRef.current = setTimeout(async () => {
      setLoadingParts(true);
      setLoadingRefurb(true);
      try {
        // Parts
        const [partsResp, refurbResp] = await Promise.all([
          axios.get(`${API_BASE}/api/suggest/parts`, {
            params: { q: partQuery, limit: MAX_PARTS },
          }),
          axios.get(`${API_BASE}/api/suggest/refurb`, {
            params: { q: partQuery, limit: MAX_REFURB },
          }),
        ]);
        setPartSuggestions(Array.isArray(partsResp.data) ? partsResp.data.slice(0, MAX_PARTS) : []);
        setRefurbSuggestions(
          Array.isArray(refurbResp.data) ? refurbResp.data.slice(0, MAX_REFURB) : []
        );
      } catch {
        setPartSuggestions([]);
        setRefurbSuggestions([]);
      } finally {
        setLoadingParts(false);
        setLoadingRefurb(false);
      }
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partQuery]);

  /* ---------------- render helpers ---------------- */
  const hasAnySuggestions =
    (modelSuggestions?.length ?? 0) +
      (partSuggestions?.length ?? 0) +
      (refurbSuggestions?.length ?? 0) >
    0;

  const onSubmitModel = (e) => {
    e.preventDefault();
    if (!modelQuery.trim()) return;
    // Navigate to model search page you already use
    navigate(`/models/search?q=${encodeURIComponent(modelQuery.trim())}`);
    setOpen(false);
  };

  const onSubmitPart = (e) => {
    e.preventDefault();
    if (!partQuery.trim()) return;
    // Navigate to part detail if exact MPN was typed, else to parts search
    const exact = partSuggestions.find(
      (p) => norm(p?.mpn ?? p?.part_number) === norm(partQuery)
    );
    if (exact) navigate(buildPartHref(exact));
    else navigate(`/parts/search?q=${encodeURIComponent(partQuery.trim())}`);
    setOpen(false);
  };

  /* ---------------- UI ---------------- */
  return (
    <header className="w-full border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img
            src="/logo.svg"
            alt="Appliance Part Geeks"
            className="h-10 w-auto"
          />
        </Link>

        {/* Menu */}
        <div className="hidden md:block">
          <HeaderMenu />
        </div>
      </div>

      {/* Global Search Row */}
      <div className="w-full border-t bg-white/60 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Model search */}
          <form onSubmit={onSubmitModel} className="relative">
            <input
              value={modelQuery}
              onChange={(e) => {
                setModelQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Search by brand / model (e.g., Bosch SHP865...)"
              className="w-full rounded-xl border px-3 py-2 outline-none focus:ring"
            />
            {/* Dropdown */}
            {open && (loadingModels || modelSuggestions.length > 0) && (
              <div className="absolute z-30 mt-2 w-full rounded-xl border bg-white shadow">
                {loadingModels && (
                  <div className="p-3 text-sm text-gray-500">Searching models…</div>
                )}
                {!loadingModels &&
                  modelSuggestions.map((m, i) => (
                    <Link
                      key={`m-${i}`}
                      to={`/models/${encodeURIComponent(m?.model_number || m?.model || "")}`}
                      className="block px-3 py-2 hover:bg-gray-50"
                      onClick={() => setOpen(false)}
                    >
                      <div className="text-sm font-medium">
                        {m?.brand ? `${m.brand} ` : ""}
                        {m?.model_number || m?.model}
                      </div>
                      <div className="text-xs text-gray-500">
                        {m?.appliance_type} • {m?.priced_parts ?? 0} priced / {m?.total_parts ?? 0} total
                      </div>
                    </Link>
                  ))}
                {!loadingModels && modelSuggestions.length === 0 && (
                  <div className="p-3 text-sm text-gray-500">No model matches</div>
                )}
              </div>
            )}
          </form>

          {/* Part / Offer search */}
          <form onSubmit={onSubmitPart} className="relative">
            <input
              value={partQuery}
              onChange={(e) => {
                setPartQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Search by part number (MPN) or keyword"
              className="w-full rounded-xl border px-3 py-2 outline-none focus:ring"
            />
            {/* Dropdown */}
            {open && (loadingParts || loadingRefurb || hasAnySuggestions) && (
              <div className="absolute z-30 mt-2 w-full rounded-xl border bg-white shadow overflow-hidden">
                {/* Parts */}
                <div className="border-b">
                  <div className="px-3 py-1 text-xs uppercase tracking-wide text-gray-500">
                    Parts (OEM)
                  </div>
                  {loadingParts && (
                    <div className="px-3 pb-2 text-sm text-gray-500">Searching parts…</div>
                  )}
                  {!loadingParts && partSuggestions.length === 0 && (
                    <div className="px-3 pb-2 text-sm text-gray-500">No part matches</div>
                  )}
                  {!loadingParts &&
                    partSuggestions.map((p, i) => {
                      const href = buildPartHref(p);
                      const title = makePartTitle(p); // your existing title builder
                      return (
                        <Link
                          key={`p-${i}`}
                          to={href}
                          className="block px-3 py-2 hover:bg-gray-50"
                          onClick={() => setOpen(false)}
                        >
                          <div className="text-sm font-medium">{title}</div>
                          <div className="text-xs text-gray-500">
                            {p?.brand || p?.Brand} • {p?.appliance_type || p?.type || "Part"}
                            {p?.price ? ` • $${Number(p.price).toFixed(2)}` : ""}
                          </div>
                        </Link>
                      );
                    })}
                </div>

                {/* Refurb / Offers */}
                <div>
                  <div className="px-3 py-1 text-xs uppercase tracking-wide text-gray-500">
                    Refurbished / Marketplace
                  </div>
                  {loadingRefurb && (
                    <div className="px-3 pb-2 text-sm text-gray-500">Searching offers…</div>
                  )}
                  {!loadingRefurb && refurbSuggestions.length === 0 && (
                    <div className="px-3 pb-2 text-sm text-gray-500">No offers found</div>
                  )}
                  {!loadingRefurb &&
                    refurbSuggestions.map((o, i) => {
                      const localHref = buildOfferHref(o); // ✅ fixed: not /refurb/:mpn
                      const isExternal = localHref.startsWith("http");
                      const title = makePartTitle(o); // re-use title builder for consistency
                      const content = (
                        <>
                          <div className="text-sm font-medium">{title}</div>
                          <div className="text-xs text-gray-500">
                            {o?.source?.toUpperCase?.() || "Offer"}
                            {o?.price ? ` • $${Number(o.price).toFixed(2)}` : ""}
                            {o?.condition ? ` • ${o.condition}` : ""}
                          </div>
                        </>
                      );

                      return isExternal ? (
                        <a
                          key={`o-${i}`}
                          href={localHref}
                          target="_blank"
                          rel="noreferrer"
                          className="block px-3 py-2 hover:bg-gray-50"
                          onClick={() => setOpen(false)}
                        >
                          {content}
                        </a>
                      ) : (
                        <Link
                          key={`o-${i}`}
                          to={localHref}
                          className="block px-3 py-2 hover:bg-gray-50"
                          onClick={() => setOpen(false)}
                        >
                          {content}
                        </Link>
                      );
                    })}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* click-outside to close dropdown */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={open ? "fixed inset-0 z-10" : "hidden"}
      />
    </header>
  );
}
