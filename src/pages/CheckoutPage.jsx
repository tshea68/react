// src/pages/CheckoutPage.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

// Backend base
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://api.appliancepartgeeks.com";

// Stripe public key
const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

/* ========================================================================
   CheckoutForm
   - Left: contact + shipping/billing + PaymentElement + Pay button
   - Right: order summary
   ======================================================================== */
function CheckoutForm({ clientSecret, summaryItems, shippingMethodLabel }) {
  const stripe = useStripe();
  const elements = useElements();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Shipping address state
  const [shipping, setShipping] = useState({
    name: "",
    email: "",
    phone: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    postal: "",
    country: "US",
  });

  // Billing address state
  const [billing, setBilling] = useState({
    name: "",
    email: "",
    phone: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    postal: "",
    country: "US",
  });

  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);

  const updateShipping = (field, value) =>
    setShipping((prev) => ({ ...prev, [field]: value }));

  const updateBilling = (field, value) =>
    setBilling((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError("");

    // If “same as shipping” is checked, mirror shipping → billing
    const billingDetails = billingSameAsShipping ? shipping : billing;

    // Single source of truth for email + phone
    const emailForReceipt =
      billingDetails.email || shipping.email || undefined;

    const phoneForReceipt =
      billingDetails.phone || shipping.phone || undefined;

    try {
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        // All params that end up on the PaymentIntent / charge
        confirmParams: {
          // Stripe will redirect back here on success/failure
          return_url: `${window.location.origin}/success`,

          // Used by Stripe for receipts & in the PaymentIntent
          receipt_email: emailForReceipt,

          // Shipping details on the PaymentIntent
          shipping: {
            name: shipping.name,
            phone: phoneForReceipt,
            address: {
              line1: shipping.address1,
              line2: shipping.address2 || undefined,
              city: shipping.city,
              state: shipping.state,
              postal_code: shipping.postal,
              country: shipping.country || "US",
            },
          },
        },

        // Attach billing details to the payment method
        payment_method_data: {
          billing_details: {
            name: billingDetails.name,
            email: emailForReceipt,
            phone: phoneForReceipt,
            address: {
              line1: billingDetails.address1,
              line2: billingDetails.address2 || undefined,
              city: billingDetails.city,
              state: billingDetails.state,
              postal_code: billingDetails.postal,
              country: billingDetails.country || "US",
            },
          },
        },
      });

      if (stripeError) {
        setError(stripeError.message || "Payment failed.");
        setSubmitting(false);
      }
      // On success, Stripe will redirect to return_url, so we don't
      // need to do anything else here.
    } catch (err) {
      setError(err.message || "Payment failed.");
      setSubmitting(false);
    }
  }

  // first item is used in header display ("Paying for ...")
  const headlineItem = summaryItems[0];

  return (
    <div className="bg-[#001b38] min-h-[calc(100vh-200px)] w-full flex flex-col px-4 md:px-8 lg:px-16 py-12 text-white">
      {/* Outer white card wrapper */}
      <div className="w-full max-w-5xl mx-auto bg-white rounded-xl border border-gray-300 shadow-lg p-6 text-gray-900">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Checkout</h1>

          {headlineItem && (
            <p className="text-sm text-gray-600">
              Paying for{" "}
              <span className="font-mono text-gray-900">
                {headlineItem.mpn}
              </span>{" "}
              × {headlineItem.qty}
            </p>
          )}

          {shippingMethodLabel && (
            <p className="text-xs text-gray-500 mt-1">
              Shipping: <span className="font-medium">{shippingMethodLabel}</span>
            </p>
          )}
        </div>

        {/* Two-column content */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* LEFT: payment + addresses */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Contact + shipping info */}
              <div className="rounded-lg border border-gray-300 bg-gray-50 p-4 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">
                  Contact &amp; Shipping
                </h2>

                {/* Contact email / phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Email (for receipt)
                    </label>
                    <input
                      type="email"
                      value={shipping.email}
                      onChange={(e) => updateShipping("email", e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Cell phone (for updates)
                    </label>
                    <input
                      type="tel"
                      value={shipping.phone}
                      onChange={(e) => updateShipping("phone", e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      required
                    />
                  </div>
                </div>

                {/* Shipping name + address */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Full name
                    </label>
                    <input
                      type="text"
                      value={shipping.name}
                      onChange={(e) => updateShipping("name", e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Address line 1
                    </label>
                    <input
                      type="text"
                      value={shipping.address1}
                      onChange={(e) =>
                        updateShipping("address1", e.target.value)
                      }
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Address line 2 (optional)
                    </label>
                    <input
                      type="text"
                      value={shipping.address2}
                      onChange={(e) =>
                        updateShipping("address2", e.target.value)
                      }
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={shipping.city}
                        onChange={(e) =>
                          updateShipping("city", e.target.value)
                        }
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        value={shipping.state}
                        onChange={(e) =>
                          updateShipping("state", e.target.value)
                        }
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        ZIP
                      </label>
                      <input
                        type="text"
                        value={shipping.postal}
                        onChange={(e) =>
                          updateShipping("postal", e.target.value)
                        }
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Billing (toggle + optional separate fields) */}
              <div className="rounded-lg border border-gray-300 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Billing address
                  </h2>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={billingSameAsShipping}
                      onChange={(e) =>
                        setBillingSameAsShipping(e.target.checked)
                      }
                      className="rounded border-gray-300"
                    />
                    <span>Billing same as shipping</span>
                  </label>
                </div>

                {!billingSameAsShipping && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Full name
                        </label>
                        <input
                          type="text"
                          value={billing.name}
                          onChange={(e) =>
                            updateBilling("name", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={billing.email}
                          onChange={(e) =>
                            updateBilling("email", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Address line 1
                      </label>
                      <input
                        type="text"
                        value={billing.address1}
                        onChange={(e) =>
                          updateBilling("address1", e.target.value)
                        }
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Address line 2 (optional)
                      </label>
                      <input
                        type="text"
                        value={billing.address2}
                        onChange={(e) =>
                          updateBilling("address2", e.target.value)
                        }
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          value={billing.city}
                          onChange={(e) =>
                            updateBilling("city", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          State
                        </label>
                        <input
                          type="text"
                          value={billing.state}
                          onChange={(e) =>
                            updateBilling("state", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          ZIP
                        </label>
                        <input
                          type="text"
                          value={billing.postal}
                          onChange={(e) =>
                            updateBilling("postal", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Stripe UI container */}
              <div className="rounded-lg border border-gray-300 bg-white p-4">
                <PaymentElement options={{ layout: "tabs" }} />
              </div>

              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}

              <button
                disabled={!stripe || !elements || submitting}
                className={`w-full rounded-lg text-center font-semibold text-sm py-3 ${
                  submitting
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {submitting ? "Processing…" : "Pay"}
              </button>
            </form>

            <div className="mt-4 text-[11px] text-gray-500 leading-snug">
              Your payment is securely processed by Stripe. We’ll email your
              receipt.
            </div>

            <div className="mt-6">
              <Link
                to="/"
                className="text-blue-600 hover:underline text-sm"
              >
                ← Continue shopping
              </Link>
            </div>
          </div>

          {/* RIGHT: order summary box */}
          <aside className="rounded-lg border border-gray-300 bg-gray-50 p-4 text-sm text-gray-800">
            <h2 className="font-semibold mb-4 text-gray-900 text-base">
              Order summary
            </h2>

            {/* Itemized list */}
            <ul className="divide-y divide-gray-200 text-sm">
              {summaryItems.map((line, idx) => (
                <li
                  key={idx}
                  className="py-2 flex justify-between items-start"
                >
                  <div className="flex flex-col">
                    {/* MPN (always) */}
                    <span className="font-mono text-gray-900 text-[13px] leading-tight">
                      {line.mpn}
                    </span>

                    {/* Optional readable name */}
                    {line.name && (
                      <span className="text-[12px] text-gray-600 leading-tight">
                        {line.name}
                      </span>
                    )}
                  </div>

                  <div className="text-right text-gray-800 text-[13px] leading-tight">
                    {/* Qty always */}
                    <div className="font-semibold">Qty {line.qty}</div>

                    {/* Optional per-unit price */}
                    {line.priceEach != null && (
                      <div className="text-[12px] text-gray-600">
                        @ ${Number(line.priceEach).toFixed(2)}
                      </div>
                    )}

                    {/* Optional line total */}
                    {line.lineTotal != null && (
                      <div className="text-[12px] text-gray-900 font-medium">
                        ${Number(line.lineTotal).toFixed(2)}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-[11px] text-gray-500 leading-snug">
              Taxes &amp; shipping will be included in the final charge.
            </p>
          </aside>
        </div>
      </div>

      {/* footer note below card */}
      <div className="max-w-5xl w-full mx-auto text-[11px] text-gray-400 mt-8 text-center">
        © 2025 Parts Finder. All rights reserved.
      </div>
    </div>
  );
}

/* ========================================================================
   CheckoutPage
   - NEW: step 1 = pick shipping method, then we create the PaymentIntent
   - Then render Stripe Elements + CheckoutForm
   ======================================================================== */
export default function CheckoutPage() {
  const [params] = useSearchParams();

  // 1. Try to read multi-item cart from ?cart=<urlencoded json>
  let summaryItems = [];
  const rawCartParam = params.get("cart");
  if (rawCartParam) {
    try {
      summaryItems = JSON.parse(decodeURIComponent(rawCartParam));
    } catch {
      summaryItems = [];
    }
  }

  // 2. Fallback to single-item mode (?mpn=...&qty=...)
  if (summaryItems.length === 0) {
    const fallbackMpn = params.get("mpn") || "";
    const fallbackQty = Number(params.get("qty") || "1");

    summaryItems = [
      {
        mpn: fallbackMpn,
        qty: fallbackQty,
        name: null,
        priceEach: null,
        lineTotal: null,
      },
    ];
  }

  // 3. The PaymentIntent we create right now is still single-line.
  const firstLine = summaryItems[0];
  const mpnForCharge = firstLine?.mpn || "";
  const qtyForCharge = firstLine?.qty || 1;

  const [clientSecret, setClientSecret] = useState("");
  const [err, setErr] = useState("");

  // NEW: shipping method choice (for now just metadata + PO email)
  const [shippingMethod, setShippingMethod] = useState("ground");
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [intentCreated, setIntentCreated] = useState(false);

  // Stripe publishable key guard
  if (!PUBLISHABLE_KEY) {
    return (
      <div className="bg-[#001b38] min-h-[calc(100vh-200px)] text-red-400 p-6">
        Missing VITE_STRIPE_PUBLISHABLE_KEY in the frontend environment.
      </div>
    );
  }

  if (!mpnForCharge) {
    return (
      <div className="bg-[#001b38] min-h-[calc(100vh-200px)] text-white p-6">
        Missing <code>mpn</code> in URL.
      </div>
    );
  }

  const shippingLabelMap = {
    ground: "Ground (3–5 business days)",
    two_day: "2-Day (price TBD)",
    next_day: "Next-business-day (price TBD)",
  };

  async function handleStartPayment() {
    if (creatingIntent) return;
    setCreatingIntent(true);
    setErr("");

    try {
      const res = await fetch(`${API_BASE}/api/checkout/intent-mpn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ mpn: mpnForCharge, quantity: qtyForCharge }],
          shipping_method: shippingMethod, // 👈 NEW: pass choice to backend
          success_url: `${window.location.origin}/success`,
          cancel_url: `${window.location.origin}/parts/${encodeURIComponent(
            mpnForCharge
          )}`,
        }),
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.detail || "Failed to start checkout");
      if (!data.client_secret)
        throw new Error("No client_secret returned");

      setClientSecret(data.client_secret);
      setIntentCreated(true);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setCreatingIntent(false);
    }
  }

  // Error state
  if (err && !intentCreated) {
    return (
      <div className="bg-[#001b38] min-h-[calc(100vh-200px)] text-red-400 p-6">
        {err}
      </div>
    );
  }

  // STEP 1: shipping method selection BEFORE we create the PaymentIntent
  if (!intentCreated) {
    const headlineItem = summaryItems[0];

    return (
      <div className="bg-[#001b38] min-h-[calc(100vh-200px)] w-full flex flex-col px-4 md:px-8 lg:px-16 py-12 text-white">
        <div className="w-full max-w-3xl mx-auto bg-white rounded-xl border border-gray-300 shadow-lg p-6 text-gray-900">
          <h1 className="text-xl font-semibold text-gray-900 mb-4">
            Choose your shipping method
          </h1>

          {headlineItem && (
            <p className="text-sm text-gray-700 mb-4">
              You’re ordering{" "}
              <span className="font-mono text-gray-900">
                {headlineItem.mpn}
              </span>{" "}
              × {headlineItem.qty}
            </p>
          )}

          <div className="space-y-3 mb-6">
            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="shippingMethod"
                value="ground"
                checked={shippingMethod === "ground"}
                onChange={(e) => setShippingMethod(e.target.value)}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Ground (3–5 business days)
                </div>
                <div className="text-xs text-gray-600">
                  Reliable default. Best value. (Pricing TBD / currently same
                  as other methods while we wire the API.)
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="shippingMethod"
                value="two_day"
                checked={shippingMethod === "two_day"}
                onChange={(e) => setShippingMethod(e.target.value)}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  2-Day
                </div>
                <div className="text-xs text-gray-600">
                  Ships from Reliable with 2-day transit (exact surcharge TBD;
                  we’ll confirm before going live).
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="shippingMethod"
                value="next_day"
                checked={shippingMethod === "next_day"}
                onChange={(e) => setShippingMethod(e.target.value)}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Next-business-day
                </div>
                <div className="text-xs text-gray-600">
                  Priority handling and next-business-day delivery where
                  available (pricing TBD).
                </div>
              </div>
            </label>
          </div>

          {err && (
            <div className="text-red-600 text-sm mb-3">{err}</div>
          )}

          <button
            onClick={handleStartPayment}
            disabled={creatingIntent}
            className={`w-full rounded-lg text-center font-semibold text-sm py-3 ${
              creatingIntent
                ? "bg-gray-400 text-white cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {creatingIntent ? "Preparing secure payment…" : "Continue to secure payment"}
          </button>

          <div className="mt-4 text-[11px] text-gray-500 leading-snug">
            Next step: enter your shipping address and card details on our
            secure Stripe-powered checkout page.
          </div>
        </div>

        <div className="max-w-3xl w-full mx-auto text-[11px] text-gray-400 mt-8 text-center">
          © 2025 Parts Finder. All rights reserved.
        </div>
      </div>
    );
  }

  // STEP 2: PaymentIntent exists; if for some reason we don’t have clientSecret yet
  if (!clientSecret) {
    return (
      <div className="bg-[#001b38] min-h-[calc(100vh-200px)] text-white p-6">
        Loading checkout…
      </div>
    );
  }

  // Render Stripe Elements + the checkout form
  return (
    stripePromise && (
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <CheckoutForm
          clientSecret={clientSecret}
          summaryItems={summaryItems}
          shippingMethodLabel={shippingLabelMap[shippingMethod]}
        />
      </Elements>
    )
  );
}
