// src/lib/PartsTitle.js

const clean = (v) => (v == null ? "" : String(v)).trim();

function getMpn(p, mpnFromCaller = "") {
  return (
    clean(mpnFromCaller) ||
    clean(
      p?.mpn ??
        p?.MPN ??
        p?.part_number ??
        p?.partNumber ??
        p?.mpn_raw ??
        ""
    )
  );
}

export function makePartTitle(p, mpnFromCaller = "") {
  const mpn = getMpn(p, mpnFromCaller);

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

  // Build columns in a strict, predictable order.
  const cols = [brand, appliance, partType].filter(Boolean);

  // If none of the 3 fields exist, use title as last slot (your rule).
  if (cols.length === 0 && title) cols.push(title);

  // ALWAYS lead with MPN if we have it.
  if (mpn) {
    return [mpn, ...cols].filter(Boolean).join(" – ");
  }

  // If no MPN, fall back to the columns/title.
  if (cols.length) return cols.join(" – ");

  // Absolute last resort.
  return title || "";
}
