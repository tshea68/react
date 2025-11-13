// inside useCompareSummary(mpn) after you've fetched:
// - newPart (retail)
// - refurbOffers: array of offers for this mpn

if (!newPart || !refurbOffers || refurbOffers.length === 0) {
  return { data: null, loading: false, error: null };
}

// 1) cheapest refurb by price
const cheapest = [...refurbOffers].sort(
  (a, b) => (a.price || Infinity) - (b.price || Infinity)
)[0];

const refurbPrice = Number(cheapest.price);
const retailPrice = Number(newPart.price);

// 2) decide if we care about savings (only if new part is actually in stock)
const newStatus = newPart.stock_status; // or whatever field you use
const newInStock = newStatus === "IN_STOCK"; // adjust to your real value

let savings = null;
if (newInStock && Number.isFinite(retailPrice) && Number.isFinite(refurbPrice)) {
  const amount = retailPrice - refurbPrice;
  if (amount > 0) {
    savings = { amount };
  }
}

// 3) total refurb quantity across all offers
const totalQty = refurbOffers.reduce(
  (sum, o) => sum + (o.available_quantity || 0),
  0
);

// 4) build the internal URL to the cheapest refurb
const url = `/refurb/${encodeURIComponent(mpn)}?offer=${encodeURIComponent(
  cheapest.listing_id
)}`;

// 5) final summary object
const summary = {
  price: refurbPrice,
  url,
  savings,    // might be null if new part is special order/unavailable
  totalQty,
  newStatus,  // so CompareBanner can vary text based on availability if you want
};

return { data: summary, loading: false, error: null };
