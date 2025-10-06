// src/lib/PartsTitle.js (or adjust your import to ../lib/parts)
export function makePartTitle(p, mpnFromCaller = "") {
  const brand = (p?.brand || "").trim();
  const ap    = (p?.appliance_type || "").trim();
  const pt    = (p?.part_type || "").trim();
  const base  = (p?.title || p?.name || "").trim();

  // Prefer explicit fields; fall back to base name if part_type missing
  const tokens = [brand, pt || base, ap].filter(Boolean);

  // De-dup case-insensitively to avoid "Bosch Bosch ..." etc.
  const seen = new Set();
  const uniq = tokens.filter(t => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const title = uniq.join(" ").trim();

  // Final fallback to MPN if everything else is empty
  const mpn = (mpnFromCaller || p?.mpn || p?.canonical_mpn || "").trim();
  return title || mpn || base || "";
}
