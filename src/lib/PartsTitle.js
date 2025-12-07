// src/lib/PartsTitle.js

export function makePartTitle(p, mpnFromCaller = "") {
  // 1) MPN first – caller wins if provided
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

  // 2) Descriptor pieces
  const brand = (p?.brand ?? "").toString().trim();
  const appliance = (p?.appliance_type ?? p?.applianceType ?? "")
    .toString()
    .trim();

  // be aggressive about where part type might live
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

  let descriptor = "";

  // --- preferred: Brand – Appliance – PartType ---
  if (partType) {
    const pieces = [brand, appliance, partType].filter(Boolean);
    descriptor = pieces.join(" – ");
  } else {
    // fallback to source title/name if we don’t have a part type
    const fallbackTitle = (p?.title ?? p?.name ?? "").toString().trim();

    if (fallbackTitle) {
      descriptor = fallbackTitle;
    } else {
      // absolute last resort: just Brand – Appliance
      const brandAppliance = [brand, appliance].filter(Boolean).join(" – ");
      descriptor = brandAppliance;
    }
  }

  // 3) Combine MPN + descriptor
  if (mpn && descriptor) return `${mpn} – ${descriptor}`;
  if (mpn) return mpn;
  if (descriptor) return descriptor;

  // last-resort so the row isn’t blank
  return "";
}
