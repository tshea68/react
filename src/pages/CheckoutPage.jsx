// src/pages/CheckoutPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// --- Config ------------------------------------------------------------------
const API_BASE =
  import.meta.env.VITE_API_BASE || "https://fastapi-app-kkkq.onrender.com";
const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// --- Form --------------------------------------------------------------------
function CheckoutForm({ mpn, qty }) {
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
      confirmParams: {
        // Stripe will redirect here after any required 3DS step
        return_url: `${window.location.origin}/success`,
      },
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
            className={`w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded ${
              submitting ? "opacity-70" : ""
            }`}
          >
            {submitting ? "Processing…" : "Pay"}
          </button>
        </form>

        <div className="mt-4">
          <Link to="/" className="text-blue-600 hover:underline">
            ← Continue shopping
          </Link>
        </div>
      </div>

      <aside className="border rounded p-4 bg-gray-50">
        <h2 className="font-semibold mb-2">Order summary</h2>
        <div className="text-sm text-gray-700">
          <div className="flex justify-between">
            <span>Item</span>
            <span className="font-mono">{mpn}</span>
          </div>
          <div className="flex justify-between">
            <span>Qty</span>
            <span>{qty}</span>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Taxes & shipping are included in the server-calculated total.
          </p>
        </div>
      </aside>
    </div>
  );
}

// --- Page --------------------------------------------------------------------
export default function CheckoutPage() {
  const [params] = useSearchParams();
  const mpn = (params.get("mpn") || "").trim();
  const qty = Math.max(1, Number(params.get("qty") || 1));

  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Create Stripe instance only if the key exists
  const stripePromise = useMemo(() => {
    if (!PUBLISHABLE_KEY) return null;
    return loadStripe(PUBLISHABLE_KEY);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!mpn) {
          setErr("Missing MPN in the URL.");
          setLoading(false);
          return;
        }

        // Ask API to create a PaymentIntent for this item
        const res = await fetch(`${API_BASE}/api/checkout/intent-mpn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [{ mpn, quantity: qty }] }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to start checkout.");
        if (!data.client_secret) throw new Error("API did not return client_secret.");

        setClientSecret(data.client_secret);
        setErr("");
      } catch (e) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [mpn, qty]);

  // Friendly states (no blank page)
  if (!PUBLISHABLE_KEY) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Checkout</h1>
        <p className="text-red-600">
          Missing publishable key. Set <code>VITE_STRIPE_PUBLISHABLE_KEY</code> on the
          frontend service and redeploy.
        </p>
      </div>
    );
  }

  if (!mpn) return <div className="p-6">Missing <code>mpn</code> in URL.</div>;
  if (loading) return <div className="p-6">Creating your payment…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm mpn={mpn} qty={qty} />
    </Elements>
  );
}




