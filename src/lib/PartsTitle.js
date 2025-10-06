export function makePartTitle(p, mpnFromCaller = "") {
  const brand = (p?.brand || "").trim();
  const ap    = (p?.appliance_type || "").trim();
  const pt    = (p?.part_type || "").trim();
  const base  = (p?.title || p?.name || "").trim();

  const tokens = [brand, pt || base, ap].filter(Boolean);

  const seen = new Set();
  const uniq = tokens.filter(t => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const title = uniq.join(" ").trim();

  const mpn = (mpnFromCaller || p?.mpn || p?.canonical_mpn || "").trim();
  return title || mpn || base || "";
}
