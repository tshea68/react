// src/pages/CheckoutPage.jsx
import React, { useEffect, useMemo, useState } from "react";
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

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function money(cents) {
  const n = Number(cents || 0);
  return (n / 100).toFixed(2);
}

function buildCartFromQuery(cartParam) {
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
        unit_amount_cents: x?.unit_amount_cents ?? x?.priceEachCents ?? null,
        image_url: x?.image_url ?? null,
        // preserve refurb flag if present in the query cart json
        is_refurb: Boolean(x?.is_refurb ?? false),
      }))
      .filter((x) => x.mpn && x.qty > 0);
  } catch {
    return [];
  }
}

/**
 * Reliable shipping destinations:
 * US + US territories (incl Puerto Rico); no international.
 */
const ALLOWED_US_STATE_CODES = new Set([
  // 50 states
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  // DC
  "DC",
  // Territories
  "PR","VI","GU","AS","MP","UM",
]);

const SHIP_DESTINATION_ERROR =
  "Shipping destinations: We ship to the United States and U.S. territories (including Puerto Rico). We currently do not ship to international addresses.";

function normalizeCountry(v) {
  return String(v || "").trim().toUpperCase();
}

function normalizeState(v) {
  return String(v || "").trim().toUpperCase();
}

function isAllowedUsOrTerritory(country, state) {
  const c = normalizeCountry(country);
  const s = normalizeState(state);
  if (c !== "US") return false;
  if (!s) return false;
  return ALLOWED_US_STATE_CODES.has(s);
}

function OrderSummary({ cartItems, amounts }) {
  const itemsSubtotal = Number(amounts?.items_subtotal_cents ?? 0);
  const shipping = Number(amounts?.shipping_amount_cents ?? 0);
  const total = Number(amounts?.total_amount_cents ?? itemsSubtotal + shipping);

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
          <span className="text-gray-600">Shipping</span>
          <span className="text-gray-900">${money(shipping)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t">
          <span className="font-semibold text-gray-900">Estimated total</span>
          <span className="font-semibold text-gray-900">${money(total)}</span>
        </div>
        <div className="text-[11px] text-gray-500 pt-2">
          Shipping is included in this total. Any applicable sales tax is calculated by Stripe on the final payment screen.
        </div>
      </div>
    </div>
  );
}

function CheckoutForm({ clientSecret, cartItems, amounts }) {
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

        {payError ? (
          <div className="mt-3 text-xs text-red-600">{payError}</div>
        ) : null}

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
        unit_amount_cents: null,
        image_url: q.get("image_url") || null,
        is_refurb: Boolean(q.get("is_refurb") === "1"),
      },
    ];
  }, [q]);

  // Contact + shipping form state
  const [email, setEmail] = useState(q.get("email") || "");
  const [phone, setPhone] = useState(q.get("phone") || "");
  const [fullName, setFullName] = useState(q.get("full_name") || "");
  const [address1, setAddress1] = useState(q.get("address1") || "");
  const [address2, setAddress2] = useState(q.get("address2") || "");
  const [city, setCity] = useState(q.get("city") || "");
  const [state, setState] = useState(q.get("state") || "");
  const [postal, setPostal] = useState(q.get("postal") || "");
  const [country, setCountry] = useState(q.get("country") || "US");

  // ✅ Shipping method choice (surgical add)
  const [shippingMethod, setShippingMethod] = useState("ground"); // ground | two_day | next_day

  // Stripe intent state
  const [clientSecret, setClientSecret] = useState("");
  const [amounts, setAmounts] = useState(null);
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [createError, setCreateError] = useState("");

  // Determine if any new/OEM parts exist in cart (defaults to NEW unless is_refurb true)
  const hasNewOem = useMemo(() => {
    return (cartItems || []).some((x) => !Boolean(x?.is_refurb));
  }, [cartItems]);

  const shipOkForNewOem = useMemo(() => {
    if (!hasNewOem) return true; // refurb-only (future flexibility)
    return isAllowedUsOrTerritory(country, state);
  }, [hasNewOem, country, state]);

  const canCreateIntent =
    cartItems.length > 0 &&
    email.trim() &&
    fullName.trim() &&
    address1.trim() &&
    city.trim() &&
    state.trim() &&
    postal.trim() &&
    country.trim() &&
    shipOkForNewOem;

  const createIntent = async () => {
    setCreateError("");
    if (!API_BASE) {
      setCreateError("Missing VITE_API_BASE_URL.");
      return;
    }
    if (!cartItems.length) {
      setCreateError("No items found in checkout URL.");
      return;
    }

    if (
      !email.trim() ||
      !fullName.trim() ||
      !address1.trim() ||
      !city.trim() ||
      !state.trim() ||
      !postal.trim() ||
      !country.trim()
    ) {
      setCreateError("Please complete the shipping details before paying.");
      return;
    }

    // US + territory enforcement for NEW/OEM parts
    if (!shipOkForNewOem) {
      setCreateError(SHIP_DESTINATION_ERROR);
      return;
    }

    setCreatingIntent(true);
    try {
      const payload = {
        items: cartItems.map((x) => ({
          mpn: x.mpn,
          quantity: x.qty,
          is_refurb: Boolean(x?.is_refurb),
        })),
        // ✅ send chosen shipping speed to backend
        shipping_method: shippingMethod,
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
        throw new Error(
          data?.detail || data?.error || "Failed to create PaymentIntent."
        );
      }

      if (!data?.client_secret) {
        throw new Error("Backend did not return client_secret.");
      }

      setClientSecret(data.client_secret);
      setAmounts({
        items_subtotal_cents: data.items_subtotal_cents ?? data.items_subtotal ?? 0,
        shipping_amount_cents: data.shipping_amount_cents ?? data.shipping_amount ?? 0,
        total_amount_cents: data.total_amount_cents ?? data.total_amount ?? 0,
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
        Review your order, enter your shipping details, and pay securely with Stripe.
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT: Contact + Shipping + Payment */}
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm font-semibold mb-3">Contact & Shipping</div>

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
                <label className="block text-xs text-gray-600 mb-1">
                  Full name
                </label>
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
                <label className="block text-xs text-gray-600 mb-1">State / Territory</label>
                <input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="FL or PR"
                />
                {hasNewOem && state.trim() && !shipOkForNewOem ? (
                  <div className="mt-1 text-[11px] text-red-600">
                    {SHIP_DESTINATION_ERROR}
                  </div>
                ) : null}
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
                <label className="block text-xs text-gray-600 mb-1">
                  Country
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="US">United States</option>
                </select>
              </div>
            </div>

            {/* ✅ Shipping speed selector (surgical add) */}
            <div className="mt-4">
              <label className="block text-xs text-gray-600 mb-1">Shipping speed</label>
              <select
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value)}
                disabled={!!clientSecret}
                className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              >
                <option value="ground">Ground (3–7 business days)</option>
                <option value="two_day">2-Day</option>
                <option value="next_day">Next-Day</option>
              </select>
            </div>

            <div className="mt-3 text-[11px] text-gray-600">
              Shipping destinations: We ship to the United States and U.S. territories (including Puerto Rico). We currently do not ship to international addresses.
            </div>

            {createError ? (
              <div className="mt-3 text-xs text-red-600">{createError}</div>
            ) : null}

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
                disableLink: true, // ✅ removes Stripe Link “email for speed”
              }}
            >
              <CheckoutForm
                clientSecret={clientSecret}
                cartItems={cartItems}
                amounts={amounts}
              />
            </Elements>
          ) : null}
        </div>

        {/* RIGHT: Order summary */}
        <div className="space-y-4">
          <OrderSummary cartItems={cartItems} amounts={amounts} />

          {!clientSecret ? (
            <div className="text-xs text-gray-600">
              Complete shipping details and click{" "}
              <span className="font-semibold">Continue to payment</span>.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
