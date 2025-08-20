// src/pages/CheckoutPage.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const API_BASE = import.meta.env.VITE_API_BASE || "https://fastapi-app-kkkq.onrender.com";
const stripePromise = loadStripe(import_meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY); // guard older bundlers

function CheckoutForm({ clientSecret, mpn, qty }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError("");

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/success` },
    });

    if (error) setError(error.message || "Payment failed.");
    setSubmitting(false);
  }

  return (
    <div className="max-w-5xl mx-auto p-6 grid md:grid-cols-2 gap-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Checkout</h1>
        <p className="text-sm text-gray-600 mb-4">
          Paying for <span className="font-mono">{mpn}</span> × {qty}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PaymentElement options={{ layout: "tabs" }} />
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button
            disabled={!stripe || !elements || submitting}
            className={`w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded ${submitting ? "opacity-70" : ""}`}
          >
            {submitting ? "Processing…" : "Pay"}
          </button>
        </form>

        <div className="mt-4">
          <Link to="/" className="text-blue-600 hover:underline">← Continue shopping</Link>
        </div>
      </div>

      <aside className="border rounded p-4 bg-gray-50">
        <h2 className="font-semibold mb-2">Order summary</h2>
        <div className="text-sm text-gray-700">
          <div className="flex justify-between">
            <span>Item</span><span className="font-mono">{mpn}</span>
          </div>
          <div className="flex justify-between">
            <span>Qty</span><span>{qty}</span>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Taxes & shipping are included in the server-calculated total.
          </p>
        </div>
      </aside>
    </div>
  );
}

export default function CheckoutPage() {
  const [params] = useSearchParams();
  const mpn = params.get("mpn") || "";
  const qty = Number(params.get("qty") || "1");
  const [clientSecret, setClientSecret] = useState("");

  useEffect(() => {
    if (!mpn) return;
    (async () => {
      const res = await fetch(`${API_BASE}/api/checkout/intent-mpn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ mpn, quantity: qty }],
          success_url: `${window.location.origin}/success`,
          cancel_url: `${window.location.origin}/parts/${encodeURIComponent(mpn)}`
        }),
      });
      const data = await res.json();
      if (res.ok && data.client_secret) {
        setClientSecret(data.client_secret);
      } else {
        alert(data.detail || "Failed to start checkout.");
      }
    })();
  }, [mpn, qty]);

  if (!mpn) return <div className="p-6">Missing <code>mpn</code> in URL.</div>;
  if (!clientSecret) return <div className="p-6">Loading checkout…</div>;

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm clientSecret={clientSecret} mpn={mpn} qty={qty} />
    </Elements>
  );
}


