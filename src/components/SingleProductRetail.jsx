useEffect(() => {
  if (!partData?.mpn) {
    setRefurbSummary(null);
    return;
  }

  let cancelled = false;

  (async () => {
    try {
      // Adjust params to match your refurb API (these worked in your network panel)
      const url = `${API_BASE}/api/refurb?q=${encodeURIComponent(
        partData.mpn
      )}&limit=10&in_stock=true`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`refurb fetch ${res.status}`);
      const payload = await res.json();

      // payload may be { items: [...] } or just [...]
      const items = Array.isArray(payload) ? payload : (payload.items || []);
      const offers = items.filter(o => Number(o.price) > 0);

      if (!offers.length) {
        if (!cancelled) setRefurbSummary(null);
        return;
      }

      // cheapest refurb
      const best = offers.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b));

      // compute savings vs new price if we have one
      const newPrice = Number(partData.price);
      const refurbPrice = Number(best.price);
      const savingsAmt = Number.isFinite(newPrice) && newPrice > 0
        ? Math.max(0, newPrice - refurbPrice)
        : null;

      // sum quantity if present (qty_available, quantity, etc.)
      const totalQty = offers.reduce((sum, o) => {
        const q = Number(o.qty_available ?? o.quantity ?? 0);
        return sum + (Number.isFinite(q) ? q : 0);
      }, 0);

      // link to your refurb page (adjust if your route differs)
      const offerId = best.listing_id ?? best.id ?? "";
      const summary = {
        price: refurbPrice,
        url: `/refurb/${encodeURIComponent(partData.mpn)}${offerId ? `?offer=${encodeURIComponent(offerId)}` : ""}`,
        savings: savingsAmt != null ? { amount: savingsAmt } : null,
        totalQty,
      };

      if (!cancelled) setRefurbSummary(summary);
    } catch (e) {
      console.error("refurb summary error", e);
      if (!cancelled) setRefurbSummary(null);
    }
  })();

  return () => { cancelled = true; };
}, [partData?.mpn, partData?.price]);
