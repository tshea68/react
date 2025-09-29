// src/hooks/useCompareOnVisible.js
import { useEffect, useState } from "react";
import { getCachedCompare, prewarmCompare } from "../lib/compareClient";

export default function useCompareOnVisible({ key, visible, apiBase }) {
  const [cmp, setCmp] = useState(() => getCachedCompare(key));

  useEffect(() => {
    if (!visible || !key || cmp !== undefined) return; // undefined = not checked yet
    const fetcher = async (k) => {
      const res = await fetch(`${apiBase}/api/compare/xmarket/${encodeURIComponent(k)}?limit=1`);
      const data = await res.json().catch(() => ({}));
      const best = data?.refurb?.best;
      const rel  = data?.reliable || null;
      return best
        ? {
            price: best?.price ?? null,
            url: best?.url ?? null,
            image_url: best?.image_url ?? data?.refurb?.offers?.[0]?.image_url ?? null,
            savings: data?.savings ?? null,
            reliablePrice: rel?.price ?? null,
            reliableStock: rel?.stock_status ?? null,
            offer_id: best?.offer_id ?? best?.listing_id ?? null,
          }
        : {
            price: null,
            url: null,
            image_url: null,
            savings: null,
            reliablePrice: rel?.price ?? null,
            reliableStock: rel?.stock_status ?? null,
            offer_id: null,
          };
    };

    prewarmCompare(key, fetcher).then((out) => setCmp(out));
  }, [visible, key, apiBase, cmp]);

  return cmp;
}
