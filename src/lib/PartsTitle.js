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

function isAvailableNewPart(p) {
  const ar = Number(p?.availability_rank ?? p?.availabilityRank);
  const price = p?.price;
  const hasPrice = price != null && String(price).trim() !== "" && Number(price) > 0;
  return (ar === 1 || ar === 2) && hasPrice;
}

export function makePartTitle(p, mpnFromCaller = "") {
  const mpn =
    clean(mpnFromCaller) ||
    clean(p?.mpn ?? p?.MPN ?? p?.part_number ?? p?.partNumber ?? p?.mpn_raw);

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
      p?.type
  );

  // --- Offers: MPN – Brand – Appliance – PartType (no title fallback) ---
  if (isOffer(p)) {
    return [mpn, brand, appliance, partType].filter(Boolean).join(" – ") || mpn || "";
  }

  // --- Available new parts: Brand – Appliance – PartType (no title fallback) ---
  if (isAvailableNewPart(p)) {
    return [brand, appliance, partType].filter(Boolean).join(" – ");
  }

  // --- Everything else: keep legacy behavior for now ---
  const primaryTitle = clean(p?.title ?? p?.name);
  if (primaryTitle) return primaryTitle;

  const descriptor = [brand, appliance, partType].filter(Boolean).join(" – ");
  if (descriptor) return descriptor;
  return mpn || "";
}
