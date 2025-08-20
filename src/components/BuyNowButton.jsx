import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const API_BASE = import.meta.env.VITE_API_BASE;

export default function BuyNowButton({ mpn, qty = 1, email }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!mpn) return alert("Missing MPN");
    setLoading(true);
    try {
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
      if (!res.ok) throw new Error(data.detail || "Failed to create session");

      const stripe = await stripePromise;
      const { error } = await stripe.redirectToCheckout({ sessionId: data.id });
      if (error) alert(error.message);
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
    >
      {loading ? "Starting checkout…" : "Buy Now"}
    </button>
  );
}

