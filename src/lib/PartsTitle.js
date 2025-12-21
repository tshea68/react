// src/lib/PartsTitle.js

const clean = (v) => (v == null ? "" : String(v)).trim();

export function makePartTitle(p, mpnFromCaller = "") {
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

  // Prefer specific_part_type if present (you have it in schema)
  const specificPartType = clean(p?.specific_part_type ?? p?.specificPartType);

  const partType = clean(
    p?.part_type ??
      p?.partType ??
      p?.part_category ??
      p?.category ??
      p?.type ??
      ""
  );

  const fallbackTitle = clean(p?.title ?? p?.name);

  const marketplace = clean(p?.marketplace).toLowerCase();
  const isEbay =
    marketplace === "ebay" ||
    !!p?.ebay_url ||
    !!p?.listing_id ||
    !!p?.item_id;

  // Your priority: part_type first, title last
  const main = specificPartType || partType || fallbackTitle || mpn || "Part";

  if (isEbay) {
    // Keep your refurb convention: show MPN first, then the structured descriptors
    const chunks = [mpn, brand, appliance, main].filter(Boolean);
    return chunks.join(" – ");
  }

  // New parts: structured too (no forced MPN prefix unless needed)
  const chunks = [brand, appliance, main].filter(Boolean);
  const structured = chunks.join(" – ");

  // If we somehow lack all descriptors, fall back
  if (structured) return structured;
  if (fallbackTitle) return fallbackTitle;
  if (mpn) return mpn;
  return "";
}
