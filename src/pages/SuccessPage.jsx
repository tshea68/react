// src/pages/SuccessPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";

const API_BASE = "https://api.appliancepartgeeks.com";

export default function SuccessPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [order, setOrder] = useState(null);
  const [msg, setMsg] = useState("Finalizing…");

  // Map raw status to a nice label + color
  const statusMeta = useMemo(() => {
    const s = (status || "").toLowerCase();
    if (s === "paid" || s === "succeeded") {
      return { label: "Payment succeeded", color: "bg-emerald-100 text-emerald-800" };
    }
    if (s === "processing" || s === "requires_capture") {
      return { label: "Payment processing", color: "bg-amber-100 text-amber-800" };
    }
    if (s === "requires_payment_method" || s === "canceled") {
      return { label: "Payment failed", color: "bg-red-100 text-red-800" };
    }
    if (s === "loading") {
      return { label: "Checking payment status…", color: "bg-sky-100 text-sky-800" };
    }
    return { label: "Status unknown", color: "bg-gray-100 text-gray-800" };
  }, [status]);

  // Normalize line items from various possible shapes
  const lineItems = useMemo(() => {
    if (!order) return [];

    // 1) Custom backend shape: order.items = [{ name, mpn, qty, total_cents, unit_cents }]
    if (Array.isArray(order.items) && order.items.length > 0) {
      return order.items.map((item, idx) => ({
        id: item.id || item.mpn || idx,
        name: item.name || item.description || "Item",
        mpn: item.mpn || item.part_number || "",
        qty: item.qty || item.quantity || 1,
        totalCents:
          item.total_cents ??
          item.amount_cents ??
          item.total ?? // fallback if you already store cents as "total"
          null,
        unitCents:
          item.unit_cents ??
          item.price_cents ??
          (item.total_cents && (item.qty || item.quantity)
            ? Math.round(item.total_cents / (item.qty || item.quantity))
            : null),
      }));
    }

    // 2) Stripe-like: order.line_items = [{ description, quantity, amount_total, amount_subtotal }]
    if (Array.isArray(order.line_items) && order.line_items.length > 0) {
      return order.line_items.map((li, idx) => ({
        id: li.id || idx,
        name: li.description || "Item",
        mpn: li.mpn || "",
        qty: li.quantity || 1,
        totalCents: li.amount_total ?? li.amount_subtotal ?? null,
        unitCents:
          li.amount_total && li.quantity
            ? Math.round(li.amount_total / li.quantity)
            : null,
      }));
    }

    // 3) Stripe direct passthrough: order.lines?.data
    if (Array.isArray(order.lines?.data) && order.lines.data.length > 0) {
      return order.lines.data.map((li, idx) => ({
        id: li.id || idx,
        name: li.description || "Item",
        mpn: li.mpn || "",
        qty: li.quantity || 1,
        totalCents: li.amount_total ?? li.amount_subtotal ?? null,
        unitCents:
          li.amount_total && li.quantity
            ? Math.round(li.amount_total / li.quantity)
            : null,
      }));
    }

    return [];
  }, [order]);

  const handlePrint = () => {
    try {
      window.print();
    } catch {
      // fail silently; no-op if print is blocked
    }
  };

  useEffect(() => {
    (async () => {
      const sid = params.get("sid"); // Checkout Session flow
      const pi = params.get("payment_intent"); // PaymentIntent flow
      const redirect = params.get("redirect_status");

      try {
        if (sid) {
          const r = await fetch(
            `${API_BASE}/api/checkout/session/status?sid=${encodeURIComponent(
              sid
            )}`
          );
          const j = await r.json();
          const st = j.status || "unknown";
          setStatus(st);
          setOrder(j);
          setMsg(
            st === "paid" || st === "succeeded"
              ? "Payment successful. Thank you for your order."
              : `Payment status: ${st}`
          );
          return;
        }

        if (pi) {
          const r = await fetch(
            `${API_BASE}/api/checkout/intent/status?pi=${encodeURIComponent(
              pi
            )}`
          );
          const j = await r.json();
          const st = j.status || redirect || "unknown";
          setStatus(st);
          setOrder(j);
          setMsg(
            st === "paid" || st === "succeeded"
              ? "Payment successful. Thank you for your order."
              : `Payment status: ${st}`
          );
          return;
        }

        setStatus("unknown");
        setMsg("No payment information was found in the URL.");
      } catch (e) {
        console.error("❌ Error loading success status:", e);
        setStatus("unknown");
        setMsg(
          "Your payment was completed, but we couldn't load the final status. Our team will verify your order."
        );
      }
    })();
  }, [params]);

  return (
    <div className="min-h-[calc(100vh-180px)] bg-[#001f3e] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden print:shadow-none print:border-0">
        {/* Top bar */}
        <div className="bg-gradient-to-r from-[#001f3e] to-[#003266] px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xl">
            {status === "loading" ? (
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full" />
            ) : (
              "✓"
            )}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Order Confirmation</h1>
            <p className="text-xs text-emerald-100">
              {status === "loading"
                ? "We’re confirming your payment with Stripe…"
                : msg}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Status pill + order id */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusMeta.color}`}
            >
              <span className="w-2 h-2 rounded-full bg-current/70 mr-2" />
              {statusMeta.label}
            </span>

            {order?.order_id && (
              <div className="text-xs text-gray-600">
                Order #:{" "}
                <span className="font-semibold text-gray-900">
                  {order.order_id}
                </span>
              </div>
            )}
          </div>

          {/* Order + payment summary */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Summary left column */}
            <div className="bg-gray-50 rounded-md border border-gray-200 px-4 py-3 text-sm space-y-1">
              {order?.email && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Receipt sent to</span>
                  <span className="font-medium text-gray-900">
                    {order.email}
                  </span>
                </div>
              )}

              {"total_cents" in (order || {}) && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Order total</span>
                  <span className="font-semibold text-gray-900">
                    ${(order.total_cents / 100).toFixed(2)}{" "}
                    {(order.currency || "USD").toUpperCase()}
                  </span>
                </div>
              )}

              {order?.payment_intent_id && (
                <div className="flex justify-between text-xs text-gray-500 pt-1 border-t border-gray-200 mt-2">
                  <span>Payment Intent</span>
                  <span className="font-mono truncate max-w-[230px]">
                    {order.payment_intent_id}
                  </span>
                </div>
              )}
            </div>

            {/* Line-item order summary */}
            {lineItems.length > 0 && (
              <div className="bg-gray-50 rounded-md border border-gray-200 px-4 py-3 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Order summary
                  </h2>
                </div>
                <ul className="divide-y divide-gray-200 max-h-40 overflow-y-auto">
                  {lineItems.map((item) => (
                    <li key={item.id} className="py-2 flex justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium text-gray-900">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Qty {item.qty}
                          {item.mpn ? ` • MPN ${item.mpn}` : ""}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-800">
                        {item.totalCents != null && (
                          <div className="font-semibold">
                            ${(item.totalCents / 100).toFixed(2)}
                          </div>
                        )}
                        {item.unitCents != null && item.qty > 1 && (
                          <div className="text-[11px] text-gray-500">
                            ${(item.unitCents / 100).toFixed(2)} each
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Helpful text */}
          <div className="text-xs text-gray-600 leading-relaxed">
            <p>
              You’ll receive an email shortly with your receipt and order
              details. If you have any questions or need to change your order,
              reply to that email and our team will help you out.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 print:hidden">
            <div className="flex flex-wrap gap-3">
              <Link
                to="/"
                className="inline-flex items-center text-sm font-medium text-[#001f3e] hover:text-[#003266]"
              >
                ← Continue shopping
              </Link>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Print receipt
              </button>
            </div>

            <Link
              to="/rare-part-request"
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-semibold bg-[#efcc30] hover:bg-[#f5d955] text-[#001f3e] shadow-sm"
            >
              Need help finding another part?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
