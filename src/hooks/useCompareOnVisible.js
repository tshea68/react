// src/hooks/useCompareOnVisible.js

import { useEffect, useState } from "react";
import { getCachedCompare, prewarmCompare } from "../lib/compareClient";

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function useCompareOnVisible({ key, visible, apiBase }) {
  const normKey = norm(key);
  const [cmp, setCmp] = useState(() => getCachedCompare(normKey));

  useEffect(() => {
    if (!visible || !normKey || cmp !== undefined) return;

    const fetcher = async (k) => {
      try {
        const res = await fetch(`${apiBase}/api/compare/xmarket/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys: [k] }),
        });

        const json = await res.json().catch(() => ({}));

        const row = json?.[k];
        if (!row) {
          return {
            price: null,
            url: null,
            image_url: null,
            savings: null,
            reliablePrice: null,
            reliableStock: null,
            offer_id: null,
          };
        }

        const refurb = row.refurb || {};
        const reliable = row.reliable || {};

        const refurbPrice = refurb.price ?? null;
        const reliablePrice = reliable.price ?? null;

        let savings = null;
        if (
          refurbPrice != null &&
          reliablePrice != null &&
          reliablePrice > refurbPrice
        ) {
          savings = {
            amount: reliablePrice - refurbPrice,
            percent: ((reliablePrice - refurbPrice) / reliablePrice) * 100,
          };
        }

        return {
          price: refurbPrice,
          url: refurb.url ?? null,
          image_url: refurb.image_url ?? null,
          savings,
          reliablePrice: reliablePrice,
          reliableStock: reliable.stock_status ?? null,
          offer_id: refurb.listing_id ?? null,
        };
      } catch (err) {
        return {
          price: null,
          url: null,
          image_url: null,
          savings: null,
          reliablePrice: null,
          reliableStock: null,
          offer_id: null,
        };
      }
    };

    prewarmCompare(normKey, fetcher).then((out) => setCmp(out));
  }, [visible, normKey, apiBase, cmp]);

  return cmp;
}
