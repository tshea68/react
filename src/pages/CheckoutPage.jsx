// src/pages/CheckoutPage.jsx
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

// --- pricing helpers ---------------------------------------------------------
function moneyToCents(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    if (Math.abs(v % 1) > 1e-9) return Math.round(v * 100); // dollars
    return Math.round(v); // cents
  }
  const s = String(v).trim();
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (cleaned.includes(".")) return Math.round(n * 100); // dollars string
  return Math.round(n); // cents string
}

function normalizeItemUnitCents(x) {
  const direct =
    x?.unit_amount_cents ??
    x?.unitAmountCents ??
    x?.priceEachCents ??
    x?.price_each_cents ??
    x?.price_cents ??
    x?.unit_price_cents ??
    null;

  const directCents = moneyToCents(direct);
  if (typeof directCents === "number" && Number.isFinite(directCents) && directCents > 0) return directCents;

  const dollars =
    x?.priceEach ??
    x?.price_each ??
    x?.unit_price ??
    x?.price ??
    x?.priceEachDollars ??
    null;

  const dollarsCents = moneyToCents(dollars);
  if (typeof dollarsCents === "number" && Number.isFinite(dollarsCents) && dollarsCents > 0) return dollarsCents;

  return null;
}

// -----------------------------------------------------------------------------

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function money(cents) {
  const n = Number(cents || 0);
  return (n / 100).toFixed(2);
}

function buildCartFromQuery(cartParam) {
  // Your cart param looks like it can be JSON-encoded into the query string.
  // Example you showed: cart=%5B%7B"mpn"%3A"DE81-..."...
  // This safely decodes that into [{mpn, qty, name, priceEachCents?}, ...]
  if (!cartParam) return [];
  try {
    const decoded = decodeURIComponent(cartParam);
    const parsed = JSON.parse(decoded);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => ({
        mpn: String(x?.mpn || "").trim(),
        qty: Number(x?.qty || 1),
        name: String(x?.name || "").trim(),
        // optional, depending on what you pass:
        unit_amount_cents: normalizeItemUnitCents(x),
        image_url: x?.image_url ?? null,
        is_refurb: Boolean(x?.is_refurb),
      }))
      .filter((x) => x.mpn && x.qty > 0);
  } catch {
    return [];
  }
}

function computeCartSubtotalCents(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) return 0;
  let total = 0;
  for (const it of cartItems) {
    const unit = it?.unit_amount_cents;
    const qty = Number(it?.qty || 1);
    if (typeof unit === "number" && Number.isFinite(unit) && unit > 0 && qty > 0) {
      total += Math.round(unit) * qty;
    }
  }
  return total;
}

function shippingLabel(method) {
  const m = (method || "").toLowerCase();
  if (m === "next_day") return "Next Day Air";
  if (m === "two_day") return "2nd Day Air";
  return "Ground";
}

function OrderSummary({ cartItems, amounts, shippingMethod }) {
  const cartSubtotalFallback = computeCartSubtotalCents(cartItems);

  const itemsSubtotal = Number(
    amounts?.items_subtotal_cents ?? amounts?.items_subtotal ?? cartSubtotalFallback
  );

  const rawShipping = amounts?.shipping_amount_cents ?? amounts?.shipping_amount ?? null;
  const shippingCents = rawShipping == null ? null : Number(rawShipping);

  // Until the user picks a shipping method (and/or we compute shipping on the backend),
  // do NOT show $0 — show TBD.
  const shippingIsTbd = shippingCents == null || shippingCents <= 0;

  const totalExShipping = Number(
    amounts?.total_amount_cents ?? amounts?.total_amount ?? itemsSubtotal
  );

  const first = cartItems?.[0];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-sm font-semibold mb-3">Order summary</div>

      {first ? (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-900">{first.mpn}</div>
            <div className="text-xs text-gray-600 truncate">
              {first.name || `${first.mpn} part`}
            </div>
          </div>
          <div className="text-right text-xs text-gray-900 whitespace-nowrap">
            <div>Qty {first.qty}</div>
            {typeof first.unit_amount_cents === "number" ? (
              <div>${money(first.unit_amount_cents)}</div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-600">No items found in checkout URL.</div>
      )}

      <div className="mt-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">Items subtotal</span>
          <span className="text-gray-900">${money(itemsSubtotal)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">
            Shipping ({shippingLabel(shippingMethod)})
          </span>
          <span className="text-gray-900">
            {shippingIsTbd ? "TBD" : `$${money(shippingCents)}`}
          </span>
        </div>

        <div className="flex justify-between pt-2 border-t">
          <span className="font-semibold text-gray-900">Total (before shipping)</span>
          <span className="font-semibold text-gray-900">${money(totalExShipping)}</span>
        </div>

        <div className="text-[11px] text-gray-500 pt-2">
          Shipping is calculated after you choose a method. Any applicable sales tax is calculated by Stripe on the final payment screen.
        </div>
      </div>
    </div>
  );
}

function CheckoutForm({ clientSecret }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payError, setPayError] = useState("");

  const returnUrl = `${window.location.origin}/success`;

  const onSubmit = async (e) => {
    e.preventDefault();
    setPayError("");

    if (!stripe || !elements) return;

    setIsSubmitting(true);
    try {
      /**
       * CRITICAL FIX:
       * Do NOT pass shipping or receipt_email here.
       * If your backend created the PaymentIntent with shipping (secret key),
       * Stripe will reject any attempt to set shipping via publishable key during confirm.
       */
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: "if_required",
      });

      if (result?.error) {
        setPayError(result.error.message || "Payment failed.");
        setIsSubmitting(false);
        return;
      }

      // If no redirect is required, we can navigate ourselves.
      navigate(
        `/success?payment_intent_client_secret=${encodeURIComponent(clientSecret)}`
      );
    } catch (err) {
      setPayError(err?.message || "Payment failed.");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-sm font-semibold mb-3">Payment</div>

        <PaymentElement />

        {payError ? <div className="mt-3 text-xs text-red-600">{payError}</div> : null}

        <button
          type="submit"
          disabled={!stripe || !elements || isSubmitting}
          className="mt-4 w-full rounded-md bg-green-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? "Processing..." : "Pay"}
        </button>

        <div className="mt-2 text-[11px] text-gray-500">
          Your payment is securely processed by Stripe. We will email your order confirmation.
        </div>
      </div>

      <div className="text-xs text-gray-600">
        <Link to="/" className="text-blue-600 hover:underline">
          ← Continue shopping
        </Link>
      </div>
    </form>
  );
}

export default function CheckoutPage() {
  const q = useQuery();

  const cartItems = useMemo(() => {
    // support both ?cart=... and a single-item style if you ever pass mpn/qty/name directly
    const cartParam = q.get("cart");
    const parsed = buildCartFromQuery(cartParam);
    if (parsed.length) return parsed;

    const mpn = (q.get("mpn") || "").trim();
    if (!mpn) return [];
    return [
      {
        mpn,
        qty: Number(q.get("qty") || 1),
        name: q.get("name") || "",
        unit_amount_cents: normalizeItemUnitCents({ unit_amount_cents: q.get("unit_amount_cents"), priceEachCents: q.get("priceEachCents"), priceEach: q.get("priceEach"), price: q.get("price") }),
        image_url: q.get("image_url") || null,
        is_refurb: false,
      },
    ];
  }, [q]);

  // Contact + shipping form state
  const [shippingMethod, setShippingMethod] = useState(q.get("ship_method") || "ground");
  const [email, setEmail] = useState(q.get("email") || "");
  const [phone, setPhone] = useState(q.get("phone") || "");
  const [fullName, setFullName] = useState(q.get("full_name") || "");
  const [address1, setAddress1] = useState(q.get("address1") || "");
  const [address2, setAddress2] = useState(q.get("address2") || "");
  const [city, setCity] = useState(q.get("city") || "");
  const [state, setState] = useState(q.get("state") || "");
  const [postal, setPostal] = useState(q.get("postal") || "");
  const [country, setCountry] = useState(q.get("country") || "US");

  // Stripe intent state
  const [clientSecret, setClientSecret] = useState("");
  const [amounts, setAmounts] = useState(null);
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [createError, setCreateError] = useState("");

  const canCreateIntent =
    cartItems.length > 0 &&
    (shippingMethod || "").trim() &&
    email.trim() &&
    fullName.trim() &&
    address1.trim() &&
    city.trim() &&
    state.trim() &&
    postal.trim() &&
    country.trim();

  const createIntent = async () => {
    setCreateError("");
    if (!API_BASE) {
      setCreateError("Missing VITE_API_BASE_URL.");
      return;
    }
    if (!canCreateIntent) {
      setCreateError("Please complete shipping details and choose a shipping method before paying.");
      return;
    }

    setCreatingIntent(true);
    try {
      /**
       * This request must give the backend REAL shipping/contact info.
       * Shipping/contact is carried in metadata and consumed in stripe_webhooks.py.
       * Frontend confirms WITHOUT shipping.
       */
      const payload = {
        shipping_method: (shippingMethod || "ground").trim(),
        items: cartItems.map((x) => ({
          mpn: x.mpn,
          quantity: x.qty,
          is_refurb: Boolean(x?.is_refurb),
        })),
        contact: {
          email: email.trim(),
          fullName: fullName.trim(),
          phone: phone.trim() || "0000000000",
        },
        ship_to: {
          name: fullName.trim(),
          phone: phone.trim() || "0000000000",
          address1: address1.trim(),
          address2: address2.trim(),
          city: city.trim(),
          state: state.trim(),
          postal: postal.trim(),
          country: country.trim(),
        },
      };

      const resp = await fetch(`${API_BASE}/api/checkout/intent-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || "Failed to create PaymentIntent.");
      }

      if (!resp.ok) {
        throw new Error(data?.detail || data?.error || "Failed to create PaymentIntent.");
      }

      if (!data?.client_secret) {
        throw new Error("Backend did not return client_secret.");
      }

      setClientSecret(data.client_secret);
      setAmounts({
        items_subtotal_cents: data.items_subtotal_cents ?? data.items_subtotal ?? 0,
        shipping_amount_cents: data.shipping_amount_cents ?? data.shipping_amount ?? null,
        total_amount_cents: data.total_amount_cents ?? data.total_amount ?? (data.items_subtotal_cents ?? 0),
      });
    } catch (e) {
      setCreateError(e?.message || "Failed to create PaymentIntent.");
    } finally {
      setCreatingIntent(false);
    }
  };

  const appearance = useMemo(
    () => ({
      theme: "stripe",
    }),
    []
  );

  if (!STRIPE_PK || !stripePromise) {
    return (
      <div className="mx-auto max-w-5xl p-6 text-sm text-red-600">
        Missing VITE_STRIPE_PUBLISHABLE_KEY.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 text-sm text-gray-700">
        Review your order, choose shipping, enter your shipping details, and pay securely with Stripe.
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT: Contact + Shipping + Payment */}
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm font-semibold mb-3">Contact & Shipping</div>

            {/* PROMINENT SHIPPING METHOD */}
            <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
              <label className="block text-xs font-semibold text-gray-900 mb-1">
                Shipping method (required)
              </label>
              <select
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="ground">Ground</option>
                <option value="two_day">2nd Day Air</option>
                <option value="next_day">Next Day Air</option>
              </select>

              <div className="mt-2 text-[11px] text-gray-700">
                Reliable requires <span className="font-semibold">Ground</span> on the PO payload. If you choose a faster method, we notify Reliable&apos;s support desk to upgrade the shipment.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Email (for confirmation)
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Cell phone (for updates)
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="2125550123"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Full name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Your name"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">
                  Address line 1
                </label>
                <input
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Street address"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">
                  Address line 2 (optional)
                </label>
                <input
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Apt, suite, unit"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">City</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">State</label>
                <input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="FL"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">ZIP</label>
                <input
                  value={postal}
                  onChange={(e) => setPostal(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Country</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="US">United States</option>
                </select>
              </div>
            </div>

            {createError ? <div className="mt-3 text-xs text-red-600">{createError}</div> : null}

            {!clientSecret ? (
              <button
                onClick={createIntent}
                disabled={creatingIntent || !canCreateIntent}
                className="mt-4 w-full rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {creatingIntent ? "Preparing payment..." : "Continue to payment"}
              </button>
            ) : null}
          </div>

          {clientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance,
              }}
            >
              <CheckoutForm clientSecret={clientSecret} />
            </Elements>
          ) : null}
        </div>

        {/* RIGHT: Order summary */}
        <div className="space-y-4">
          <OrderSummary cartItems={cartItems} amounts={amounts} shippingMethod={shippingMethod} />

          {!clientSecret ? (
            <div className="text-xs text-gray-600">
              Complete shipping details and click <span className="font-semibold">Continue to payment</span>.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
