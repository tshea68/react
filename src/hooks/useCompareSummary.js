// src/hooks/useCompareSummary.js
import { useEffect, useState } from "react";

const API_BASE =
  (import.meta.env?.VITE_API_BASE || "").trim() ||
  "https://api.appliancepartgeeks.com";

/**
 * Returns:
 * {
 *   data: {
 *     price,
 *     url,
 *     savings: { amount } | null,
 *     totalQty,
 *     newStatus
 *   },
 *   loading,
 *   error
 * }
 */
export default function useCompareSummary(mpn) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!mpn) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchSummary() {
      try {
        setLoading(true);
        setError(null);

        // backend returns:
        // { refurb: {...}, reliable: {...}, savings: {...} }
        const res = await fetch(
          `${API_BASE}/api/compare/xmarket/${encodeURIComponent(mpn)}`
        );

        if (!res.ok) {
          throw new Error(`Bad ${res.status}`);
        }

        const json = await res.json();
        if (cancelled) return;

        const refurb = json?.refurb || {};
        const reliable = json?.reliable || {};
        const best = refurb?.best || null;

        // When no refurb available:
        if (!best) {
          setData(null);
          return;
        }

        const refurbPrice = Number(best.price);
        const retailPrice = Number(reliable?.price);
        const newStatus = reliable?.stock_status || "UNKNOWN";

        // only show savings if NEW part is actually in stock
        const newInStock = newStatus === "IN_STOCK";

        let savings = null;
        if (
          newInStock &&
          Number.isFinite(retailPrice) &&
          Number.isFinite(refurbPrice)
        ) {
          const amount = retailPrice - refurbPrice;
          if (amount > 0) {
            savings = { amount };
          }
        }

        // total refurb qty = refurb.total_quantity (from API)
        const totalQty = refurb?.total_quantity ?? 0;

        // Internal link to refurb page
        const url = `/refurb/${encodeURIComponent(mpn)}?offer=${encodeURIComponent(
          best.listing_id
        )}`;

        const summary = {
          price: refurbPrice,
          url,
          savings,
          totalQty,
          newStatus,
        };

        setData(summary);
      } catch (err) {
        if (!cancelled) {
          console.error("compare summary failed", err);
          setError(String(err));
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSummary();
    return () => {
      cancelled = true;
    };
  }, [mpn]);

  return { data, loading, error };
}
