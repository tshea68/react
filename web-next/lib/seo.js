import { money } from "./api";

export function buildTitle({ brand, mpn, name, condition }) {
  const bits = [];
  if (brand) bits.push(brand);
  if (mpn) bits.push(mpn);
  if (name) bits.push(name);
  if (condition) bits.push(condition);
  return `${bits.filter(Boolean).join(" ")} | Appliance Part Geeks`.trim();
}

export function buildDescription({ brand, mpn, name, condition }) {
  const c = condition ? `${condition} ` : "";
  const core = [brand, mpn, name].filter(Boolean).join(" ");
  return `Buy ${c}${core} at Appliance Part Geeks. Fast shipping. Verified compatibility information and OEM alternatives.`.slice(0, 155);
}

export function productJsonLd({ brand, mpn, name, image, price, url, condition }) {
  const p = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: [brand, mpn, name].filter(Boolean).join(" ").trim(),
    sku: mpn || undefined,
    brand: brand ? { "@type": "Brand", name: brand } : undefined,
    image: image ? [image] : undefined,
    offers: {
      "@type": "Offer",
      url,
      availability: "https://schema.org/InStock",
      priceCurrency: "USD",
      price: (typeof price === "number" ? price : (typeof price === "string" ? Number(price) : undefined)) || undefined,
      itemCondition: condition === "Refurbished"
        ? "https://schema.org/RefurbishedCondition"
        : condition === "Used"
          ? "https://schema.org/UsedCondition"
          : "https://schema.org/NewCondition",
    },
  };

  // Remove undefined keys to keep JSON-LD clean
  return JSON.parse(JSON.stringify(p));
}

export function canonicalFor(path) {
  const base = process.env.SITE_BASE || "https://www.appliancepartgeeks.com";
  return `${base}${path}`;
}
