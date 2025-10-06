// src/lib/PartsTitle.js
export function makePartTitle(p, mpnFromCaller = "") {
  const brand = (p?.brand ?? "").trim();
  const partType = (p?.part_type ?? "").trim();
  const appliance = (p?.appliance_type ?? p?.applianceType ?? "").trim();

  const trio = [brand, partType, appliance].filter(Boolean);

  // Use "Brand / Part Type / Appliance Type" when we have 2 or 3 fields.
  if (trio.length >= 2) {
    return trio.join(" / ");
  }

  // If we only have one (or none), use the source title (no MPN in line 1).
  const t = (p?.title ?? p?.name ?? "").trim();
  if (t) return t;

  // Last-resort fallback so the row isn't empty.
  return trio[0] || mpnFromCaller || "";
}
