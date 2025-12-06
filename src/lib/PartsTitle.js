// src/lib/PartsTitle.js

export function makePartTitle(p, mpnFromCaller = "") {
  // 1) MPN first – from caller if provided, otherwise from the part
  const mpn =
    (mpnFromCaller ?? "").trim() ||
    (p?.mpn ??
      p?.MPN ??
      p?.part_number ??
      p?.partNumber ??
      "").toString().trim();

  // 2) Descriptor pieces
  const brand = (p?.brand ?? "").toString().trim();
  const appliance = (
    p?.appliance_type ??
    p?.applianceType ??
    ""
  ).toString().trim();
  const partType = (p?.part_type ?? "").toString().trim();

  // You asked for: Brand + Appliance Type + Part Type
  const descriptorPieces = [brand, appliance, partType].filter(Boolean);
  let descriptor = "";

  if (descriptorPieces.length >= 1) {
    descriptor = descriptorPieces.join(" / ");
  } else {
    // Fallback to whatever title/name we have from source
    descriptor = (p?.title ?? p?.name ?? "").toString().trim();
  }

  // 3) Combine MPN + descriptor
  if (mpn && descriptor) return `${mpn} – ${descriptor}`;
  if (mpn) return mpn;
  if (descriptor) return descriptor;

  // Last-resort so row isn't blank
  return "";
}
