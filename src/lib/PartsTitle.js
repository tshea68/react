// src/lib/PartsTitle.js

const clean = (v) => (v == null ? "" : String(v)).trim();

function detectIsEbay(p) {
  const marketplace = clean(p?.marketplace).toLowerCase();
  return (
    marketplace === "ebay" ||
    !!p?.ebay_url ||
    !!p?.listing_id ||
    !!p?.item_id
  );
}

/**
 * Title policy:
 * - Offers/refurb (eBay): NEVER use the full listing title as the "part type" fallback.
 *   We only use: MPN + Brand + Appliance + PartType (where PartType must be a real part type field).
 *   If PartType is missing, we simply omit that slot.
 *
 * - New/Reliable/generic parts: keep prior behavior for now (use existing title/name if present).
 *   We'll standardize this later once offers are clean.
 */
export function makePartTitle(p, mpnFromCaller = "") {
  // --- 1) Basic fields we might need ---

  const mpn =
    clean(mpnFromCaller) ||
    clean(
      p?.mpn ??
        p?.MPN ??
        p?.part_number ??
        p?.partNumber ??
        p?.mpn_raw ??
        ""
    );

  const brand = clean(p?.brand);
  const appliance = clean(p?.appliance_type ?? p?.applianceType);

  // Be generous about where part type might live (but do NOT use title/name here)
  const partType = clean(
    p?.specific_part_type ??
      p?.specificPartType ??
      p?.part_type ??
      p?.partType ??
      p?.part_category ??
      p?.category ??
      p?.type ??
      ""
  );

  // --- 2) Decide if this is an eBay/refurb offer ---

  const isEbay = detectIsEbay(p);

  // --- 3) eBay / Refurb path: MPN + Brand + Appliance + PartType (NO title fallback) ---

  if (isEbay) {
    const chunks = [mpn, brand, appliance, partType].filter(Boolean);

    // If we have anything, return it. (If partType is missing, it will be omitted.)
    if (chunks.length > 0) return chunks.join(" – ");

    // Last-ditch: we won't use title as "part type", but we also won't return garbage.
    // Prefer mpn if we have it; otherwise empty string.
    return mpn || "";
  }

  // --- 4) Reliable / generic parts: keep existing behavior for now ---

  const primaryTitle = clean(p?.title ?? p?.name);
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
