// src/lib/parts.js
export function makePartTitle(p, mpnFromCaller = "") {
  const mpn   = (mpnFromCaller || p?.mpn || p?.canonical_mpn || "").trim();
  const brand = (p?.brand || "").trim();
  const ap    = (p?.appliance_type || "").trim();
  const pt    = (p?.part_type || "").trim();

  const pieces = [mpn, brand, ap, pt].filter(Boolean);
  return pieces.length ? pieces.join(" ") : (p?.title || p?.name || mpn || "");
}
