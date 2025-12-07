// src/lib/PartsTitle.js

export function makePartTitle(p = {}, mpnFromCaller = "") {
  // 1) MPN first – caller wins, then common fields
  const mpn = (
    mpnFromCaller ||
    p.mpn ||
    p.MPN ||
    p.part_number ||
    p.partNumber ||
    p.mpn_raw ||
    p.listing_mpn ||
    ""
  )
    .toString()
    .trim();

  // 2) Core descriptor fields
  const brand = (p.brand || "").toString().trim();
  const appliance = (
    p.appliance_type ||
    p.applianceType ||
    ""
  )
    .toString()
    .trim();
  const partType = (p.part_type || "").toString().trim();

  // 3) EXACT order: MPN + Brand + Appliance Type + Part Type
  const pieces = [mpn, brand, appliance, partType].filter(Boolean);

  if (pieces.length > 0) {
    // Example: "2198621 – Whirlpool – Refrigerator – Control Board"
    return pieces.join(" – ");
  }

  // 4) Fallbacks ONLY if we have none of the above
  const fallback = (p.title || p.name || "").toString().trim();
  if (fallback) return fallback;

  // 5) Absolute last resort so it never renders blank
  return mpn || brand || appliance || partType || "";
}
