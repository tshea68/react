// src/lib/PartsTitle.js

const clean = (v) => (v == null ? "" : String(v)).trim();

function isOffer(p) {
  const marketplace = clean(p?.marketplace).toLowerCase();
  return (
    marketplace === "ebay" ||
    !!p?.ebay_url ||
    !!p?.listing_id ||
    !!p?.item_id
  );
}

export function makePartTitle(p, mpnFromCaller = "") {
  // --- Common fields ---
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

  // Real part-type fields ONLY (never title/name)
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

  const title = clean(p?.title ?? p?.name);

  // --- Offers/refurb: MPN – Brand – Appliance – PartType (NO title fallback) ---
  if (isOffer(p)) {
    const s = [mpn, brand, appliance, partType].filter(Boolean).join(" – ");
    return s || mpn || "";
  }

  // --- Parts: Brand – Appliance – PartType ---
  const hasAnyOfThree = !!brand || !!appliance || !!partType;

  // If none of the three are present, default to title (your rule)
  if (!hasAnyOfThree) {
    return title || mpn || "";
  }

  // Otherwise use the structured format (omit blanks)
  const structured = [brand, appliance, partType].filter(Boolean).join(" – ");
  return structured || title || mpn || "";
}
