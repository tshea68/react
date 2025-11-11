// src/pages/SuccessPage.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

const API_BASE = "https://api.appliancepartgeeks.com";

export default function SuccessPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [order, setOrder] = useState(null);
  const [msg, setMsg] = useState("Finalizing…");

  useEffect(() => {
    (async () => {
      const sid = params.get("sid");                          // Checkout Session flow
      const pi  = params.get("payment_intent");               // Elements flow
      const redirect = params.get("redirect_status");

      try {
        if (sid) {
          const r = await fetch(`${API_BASE}/api/checkout/session/status?sid=${encodeURIComponent(sid)}`);
          const j = await r.json();
          setStatus(j.status || "unknown");
          setOrder(j);
          setMsg(j.status === "paid" ? "Payment successful. Thank you!" : `Payment status: ${j.status || "unknown"}`);
          return;
        }

        if (pi) {
          // Ask backend which order this PI belongs to
          const r = await fetch(`${API_BASE}/api/checkout/intent/status?pi=${encodeURIComponent(pi)}`);
          const j = await r.json();
          setStatus(j.status || (redirect || "unknown"));
          setOrder(j);
          setMsg((j.status === "paid" || redirect === "succeeded")
            ? "Payment successful. Thank you!"
            : `Payment status: ${j.status || redirect || "unknown"}`);
          return;
        }

        setStatus("unknown");
        setMsg("No payment info in the URL.");
      } catch (e) {
        setStatus("unknown");
        setMsg("Payment completed, but we couldn't load the final status.");
      }
    })();
  }, [params]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Success</h1>
      <p className="mb-4">{msg}</p>

      {order && (
        <div className="text-sm bg-gray-50 border rounded p-4 mb-4">
          <div>Status: <strong>{status}</strong></div>
          {"order_id" in order && <div>Order #: {order.order_id}</div>}
          {"email" in order && order.email && <div>Email: {order.email}</div>}
          {"total_cents" in order && (
            <div>Total: ${(order.total_cents / 100).toFixed(2)} {order.currency || "USD"}</div>
          )}
        </div>
      )}

      <Link className="text-blue-600 hover:underline" to="/">← Continue shopping</Link>
    </div>
  );
}


