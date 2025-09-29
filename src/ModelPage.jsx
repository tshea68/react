import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import PartImage from "./components/PartImage";

import useVisible from "./hooks/useVisible";
import useCompareOnVisible from "./hooks/useCompareOnVisible";
import { prewarmCompare } from "./lib/compareClient";

const API_BASE = import.meta.env.VITE_API_URL;

/* ---------------- helpers ---------------- */
const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

const extractMPN = (p) => {
  let mpn =
    p?.mpn ??
    p?.mpn_normalized ??
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
      : Number(String(p?.price || "").replace(/[^0-9.]/g, "")));
  return Number.isFinite(Number(n)) ? Number(n) : null;
};

const formatPrice = (v, curr = "USD") => {
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

const stockBadge = (raw) => {
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

/* ---------------- main ---------------- */
const ModelPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const modelNumber = searchParams.get("model") || "";

  const [model, setModel] = useState(null);
  const [parts, setParts] = useState({ priced: [], all: [] });
  const [popupImage, setPopupImage] = useState(null);
  const [error, setError] = useState(null);
  const [loadingParts, setLoadingParts] = useState(false);
  const [brandLogos, setBrandLogos] = useState([]);

  const availRootRef = useRef(null);
  const knownRootRef = useRef(null);

  const [refurbFlags, setRefurbFlags] = useState({});
  const onRefurbFlag = useCallback((key, hasRefurb) => {
    setRefurbFlags((prev) =>
      prev[key] === hasRefurb ? prev : { ...prev, [key]: hasRefurb }
    );
  }, []);

  useEffect(() => {
    const fetchModel = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/models/search?q=${encodeURIComponent(modelNumber)}`
        );
        const data = await res.json();
        setModel(data && data.model_number ? data : null);
      } catch (err) {
        console.error("❌ Error loading model data:", err);
        setError("Error loading model data.");
      }
    };

    const fetchParts = async () => {
      try {
        setLoadingParts(true);
        const res = await fetch(
          `${API_BASE}/api/parts/for-model/${encodeURIComponent(modelNumber)}`
        );
        if (!res.ok) throw new Error("Failed to fetch parts");
        const data = await res.json();
        setParts({
          all: Array.isArray(data.all) ? data.all : [],
          priced: Array.isArray(data.priced) ? data.priced : [],
        });
      } catch (err) {
        console.error("❌ Error loading parts:", err);
      } finally {
        setLoadingParts(false);
      }
    };

    const fetchBrandLogos = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/brand-logos`);
        const data = await res.json();
        setBrandLogos(Array.isArray(data) ? data : data?.logos || []);
      } catch (err) {
        console.error("❌ Error fetching brand logos:", err);
      }
    };

    if (modelNumber) {
      fetchModel();
      fetchParts();
      fetchBrandLogos();
    }

    const input = document.querySelector("input[type='text']");
    if (input) input.value = "";
  }, [modelNumber, location]);

  const getBrandLogoUrl = (brand) => {
    if (!brand) return null;
    const key = normalize(brand);
    const hit = brandLogos.find((b) => normalize(b.name) === key);
    return hit?.image_url || hit?.url || hit?.logo_url || hit?.src || null;
  };

  const allKnownOrdered = useMemo(() => {
    const list = Array.isArray(parts.all) ? [...parts.all] : [];
    list.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    return list;
  }, [parts.all]);

  const availableRowsBase = useMemo(() => {
    const seen = new Set();
    const out = [];

    const pricedMap = new Map();
    for (const p of parts.priced || []) {
      const k = normalize(extractMPN(p));
      if (k) pricedMap.set(k, p);
    }

    for (const [k, p] of pricedMap.entries()) {
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ key: k, newPart: p, knownName: p?.name || null });
      }
    }

    const MAX_REFURB_ONLY = 100;
    for (const row of allKnownOrdered) {
      if (out.length >= pricedMap.size + MAX_REFURB_ONLY) break;
      const k = normalize(extractMPN(row));
      if (!k || seen.has(k)) continue;
      if (!pricedMap.has(k)) {
        seen.add(k);
        out.push({ key: k, newPart: null, knownName: row?.name || null });
      }
    }

    return out;
  }, [parts.priced, allKnownOrdered]);

  // Prewarm top keys (also grab title)
  useEffect(() => {
    if (!availableRowsBase?.length) return;
    const keys = availableRowsBase.map((r) => r.key).filter(Boolean).slice(0, 12);
    const fetcher = async (k) => {
      const r = await fetch(
        `${API_BASE}/api/compare/xmarket/${encodeURIComponent(k)}?limit=1`
      );
      const data = r.ok ? await r.json() : {};
      const best = data?.refurb?.best;
      const rel = data?.reliable ?? null;
      return best
        ? {
            price: Number(best.price ?? null),
            url: best.url ?? null,
            title: best?.title ?? null,             // ← include title
            image_url:_

