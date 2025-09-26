// src/hooks/useCompareSummary.js
import { useEffect, useRef, useState } from "react";
import axios from "axios";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";
const cache = new Map(); // session cache: key = mpn_norm

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function useCompareSummary(mpn, { enabled = true, timeout = 6000 } = {}) {
  const [data, setData] = useState(null);   // { price, url, savings, totalQty } | null
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const keyRef = useRef(norm(mpn));

  useEffect(() => {
    const key = norm(mpn);
    keyRef.current = key;
    if (!enabled || !key) return;

    if (cache.has(key)) {
      setData(cache.get(key));
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    axios
      .get(`${API_BASE}/api/compare/xmarket/${encodeURIComponent(mpn)}?limit=1`, { timeout })
      .then(({ data }) => {
        const best = data?.refurb?.best;
        const summary = best
          ? {
              price: best.price ?? null,
              url: best.url ?? null,
              totalQty: data?.refurb?.total_quantity ?? 0,
              savings: data?.savings ?? null, // {amount, percent} | null
            }
          : null;
        if (!cancelled) {
          cache.set(key, summary);
          setData(summary);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          cache.set(key, null);
          setData(null);
          setError(e);
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [mpn, enabled, timeout]);

  return { data, loading, error };
}
