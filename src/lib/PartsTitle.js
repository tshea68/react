// src/lib/PartsTitle.js

export function makePartTitle(p, mpnFromCaller = "") {
  // --- 1) Basic fields we might need ---

  const mpn =
    (mpnFromCaller ?? "").toString().trim() ||
    (
      p?.mpn ??
      p?.MPN ??
      p?.part_number ??
      p?.partNumber ??
      p?.mpn_raw ??
      ""
    )
      .toString()
      .trim();

  const brand = (p?.brand ?? "").toString().trim();
  const appliance = (p?.appliance_type ?? p?.applianceType ?? "")
    .toString()
    .trim();

  // Be generous about where part type might live
  const partType = (
    p?.part_type ??
    p?.partType ??
    p?.part_category ??
    p?.category ??
    p?.type ??
    ""
  )
    .toString()
    .trim();

  // --- 2) Decide if this is an eBay/refurb offer ---

  const marketplace = (p?.marketplace ?? "").toString().toLowerCase();
  const isEbay =
    marketplace === "ebay" ||
    !!p?.ebay_url ||
    !!p?.listing_id ||
    !!p?.item_id;

  // --- 3) eBay / Refurb path: MPN + Brand + Appliance + PartType ---

  if (isEbay) {
    const chunks = [mpn, brand, appliance, partType].filter(Boolean);

    if (chunks.length > 0) {
      // Ensures order: MPN, then Brand, then Appliance, then PartType
      return chunks.join(" – ");
    }

    // Fallback if we somehow have none of those
    const fallback = (p?.title ?? p?.name ?? "").toString().trim();
    return fallback || mpn || "";
  }

  // --- 4) Reliable / generic parts: just use their existing title/name ---

  const primaryTitle = (p?.title ?? p?.name ?? "").toString().trim();
  if (primaryTitle) {
    // We still show "MPN: ___" on the card, so no need to prepend MPN here.
    return primaryTitle;
  }

  // If they somehow don't have a title, build something reasonable
  const descriptor = [brand, appliance, partType].filter(Boolean).join(" – ");

  if (mpn && descriptor) return `${mpn} – ${descriptor}`;
  if (descriptor) return descriptor;
  if (mpn) return mpn;

  // Last-resort so we never return an empty string silently
  return "";
}
