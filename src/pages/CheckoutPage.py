// src/pages/CheckoutPage.jsx
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const API_BASE = import.meta.env.VITE_API_BASE;

export default function CheckoutPage() {
  const [mpn, setMpn] = useState("");
  const [qty, setQty] = useState(1);
  const [email, setEmail] = useState("");

  async function handleCheckout() {
    if (!mpn.trim()) return alert("Enter an MPN");
    const stripe = await stripePromise;
    const res = await fetch(`${API_BASE}/api/checkout/session-mpn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ mpn, quantity: Number(qty) || 1 }],
        success_url: `${window.location.origin}/success?sid={CHECKOUT_SESSION_ID}`,
        cancel_url: `${window.location.origin}/`,
        customer_email: email || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.detail || "Failed to create session");
    const { error } = await stripe.redirectToCheckout({ sessionId: data.id });
    if (error) alert(error.message);
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Checkout</h1>

      <label className="block">
        <div className="text-sm mb-1">MPN</div>
        <input
          value={mpn}
          onChange={(e) => setMpn(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="e.g. WED15P2"
        />
      </label>

      <label className="block">
        <div className="text-sm mb-1">Quantity</div>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-32 border rounded px-3 py-2"
        />
      </label>

      <label className="block">
        <div className="text-sm mb-1">Email (optional)</div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="you@example.com"
        />
      </label>

      <button
        onClick={handleCheckout}
        className="px-4 py-2 rounded bg-black text-white"
      >
        Pay with Stripe
      </button>
    </div>
  );
}
