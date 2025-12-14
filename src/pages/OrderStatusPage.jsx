// src/pages/OrderStatusPage.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";

const API_BASE =
  (import.meta.env?.VITE_API_BASE || "").trim() ||
  "https://api.appliancepartgeeks.com";

function StatusPill({ status }) {
  const normalized = (status || "").toLowerCase();
  const label = status || "unknown";

  let bg = "#e5e7eb"; // gray
  let color = "#111827";

  if (["paid", "completed", "shipped", "delivered"].includes(normalized)) {
    bg = "#dcfce7"; // green-ish
    color = "#166534";
  } else if (
    ["processing", "in-progress", "on-hold", "pending", "cancel_requested"].includes(
      normalized
    )
  ) {
    bg = "#fef9c3"; // yellow-ish
    color = "#92400e";
  } else if (["failed", "canceled", "cancelled"].includes(normalized)) {
    bg = "#fee2e2"; // red-ish
    color = "#991b1b";
  }

  return React.createElement(
    "span",
    {
      style: {
        display: "inline-block",
        padding: "0.15rem 0.6rem",
        borderRadius: "999px",
        fontSize: "0.8rem",
        fontWeight: 600,
        backgroundColor: bg,
        color,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      },
    },
    label
  );
}

function safeStr(v) {
  return (v ?? "").toString().trim();
}

function formatMoney(cents, currency) {
  if (cents == null || Number.isNaN(Number(cents))) return "—";
  const cur = (currency || "USD").toUpperCase();
  return `$${(Number(cents) / 100).toFixed(2)} ${cur}`;
}

// Vendor-neutral “fulfillment status” extraction from whatever you have stored
function getFulfillmentStatus(order) {
  return (
    safeStr(order?.fulfillment_status) ||
    safeStr(order?.reliable_status) || // existing field, but we don't label it "Reliable" in UI
    safeStr(
      order?.reliable_order?.orderStatusResponse?.openItems?.partList?.partData?.[0]
        ?.status
    )
  );
}

export default function OrderStatusPage() {
  const { token } = useParams();
  const location = useLocation();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState(null);

  // Only show raw payload if explicitly requested, e.g. /order/<token>?debug=1
  const debug = useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search || "");
      return sp.get("debug") === "1";
    } catch {
      return false;
    }
  }, [location.search]);

  const fetchOrder = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/orders/public/${token}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setOrder(data.order || null);
    } catch (err) {
      setError(err.message || String(err));
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // NOTE: backend route is still /refresh-reliable, but UI is vendor-neutral
  const handleRefreshStatus = async () => {
    if (!order?.id) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/orders/${order.id}/refresh-reliable`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      await fetchOrder();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setRefreshing(false);
    }
  };

  // NOTE: backend route is still /cancel-reliable, but UI is vendor-neutral
  const handleCancelOrder = async () => {
    if (!token) return;

    const ok = window.confirm(
      "Cancel this order?\n\nIf the order has already shipped, cancellation may not be possible."
    );
    if (!ok) return;

    setCanceling(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/orders/public/${token}/cancel-reliable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // whole-order cancel; line-cancel supported later
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      await fetchOrder();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setCanceling(false);
    }
  };

  const shippingSummary = order?.shipping_summary || {};
  const fulfillmentStatus = getFulfillmentStatus(order);

  // Customer-facing "Order Reference" should NOT be your table row id.
  // Use the public token as the stable customer reference, but shortened for display.
  const orderRefShort = useMemo(() => {
    const t = safeStr(token);
    if (!t) return "—";
    // show last 12 chars for support lookups; you can change length as desired
    const tail = t.length > 12 ? t.slice(-12) : t;
    return `…${tail}`;
  }, [token]);

  // You may still want internal id for support (not framed as the primary tracking number)
  const internalId = order?.id;

  // This is your fulfillment order reference (currently stored as reliable_order_number).
  // Label it vendor-neutral.
  const fulfillmentOrderRef = safeStr(order?.reliable_order_number);

  // Cancellation gating: still depends on fulfillment order existing + status
  const normalizedOrderStatus = (order?.status || "").toLowerCase();
  const isShippedOrDone = ["shipped", "delivered"].includes(normalizedOrderStatus);
  const isCanceledAlready = ["canceled", "cancelled", "cancel_requested"].includes(
    normalizedOrderStatus
  );

  const canCancel =
    Boolean(fulfillmentOrderRef) && !isShippedOrDone && !isCanceledAlready;

  const cancelHint = !fulfillmentOrderRef
    ? "Cancel is unavailable until the order has been submitted for fulfillment."
    : isShippedOrDone
    ? "Order has shipped; cancellation may not be possible."
    : isCanceledAlready
    ? "Cancellation already requested or completed."
    : "";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: "2rem 1rem",
      }}
    >
      <div
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          background: "#ffffff",
          borderRadius: "1rem",
          boxShadow: "0 10px 35px rgba(0, 0, 0, 0.08)",
          padding: "2rem",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            marginBottom: "0.25rem",
          }}
        >
          Track Your Order
        </h1>

        <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
          Use this page to check the latest status of your order.
        </p>

        {!token && <p style={{ color: "#b91c1c" }}>Missing order token in URL.</p>}

        {loading && <p style={{ color: "#4b5563" }}>Loading your order details...</p>}

        {error && (
          <p style={{ color: "#b91c1c", marginBottom: "1rem" }}>Error: {error}</p>
        )}

        {!loading && !error && order && (
          <>
            {/* Top summary */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "1rem",
                marginBottom: "1.25rem",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  Order Reference
                </div>

                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "1rem",
                    marginTop: "0.15rem",
                    marginBottom: "0.35rem",
                  }}
                >
                  {orderRefShort}
                </div>

                <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  Placed on{" "}
                  {order.created_at ? new Date(order.created_at).toLocaleString() : "—"}
                </div>

                {/* Optional internal id for support (not the “tracking number”) */}
                {internalId != null && (
                  <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                    Internal ID: <span style={{ fontFamily: "monospace" }}>{internalId}</span>
                  </div>
                )}
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  Order Status
                </div>

                <div style={{ marginTop: "0.15rem" }}>
                  <StatusPill status={order.status} />
                </div>

                {fulfillmentStatus && (
                  <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.4rem" }}>
                    Fulfillment Status: <strong>{fulfillmentStatus}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Money + shipping */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "0.75rem",
                  background: "#f9fafb",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Total</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "0.15rem" }}>
                  {formatMoney(order.total_amount_cents, order.currency)}
                </div>
              </div>

              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "0.75rem",
                  background: "#f9fafb",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Shipping To</div>
                <div style={{ fontSize: "0.95rem", color: "#111827", marginTop: "0.15rem" }}>
                  {shippingSummary.city && shippingSummary.state && (
                    <>
                      {shippingSummary.city}, {shippingSummary.state}
                      <br />
                    </>
                  )}
                  {shippingSummary.postal_code && <>ZIP {shippingSummary.postal_code}</>}
                  {!shippingSummary.postal_code && !shippingSummary.city && "Not available yet"}
                </div>
              </div>
            </div>

            {/* Fulfillment references + tracking (vendor-neutral) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "1rem",
                marginBottom: "1.25rem",
              }}
            >
              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "0.75rem",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Fulfillment Order #</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "0.15rem" }}>
                  {fulfillmentOrderRef || "Pending"}
                </div>
              </div>

              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "0.75rem",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Last Updated</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 600, marginTop: "0.15rem" }}>
                  {order.last_status_check_at
                    ? new Date(order.last_status_check_at).toLocaleString()
                    : "Not checked yet"}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={handleRefreshStatus}
                disabled={refreshing}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "999px",
                  border: "none",
                  cursor: refreshing ? "default" : "pointer",
                  backgroundColor: "#111827",
                  color: "#f9fafb",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  opacity: refreshing ? 0.6 : 1,
                }}
              >
                {refreshing ? "Refreshing..." : "Refresh Order Status"}
              </button>

              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={!canCancel || canceling}
                title={cancelHint}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "999px",
                  border: "1px solid #991b1b",
                  cursor: !canCancel || canceling ? "default" : "pointer",
                  backgroundColor: "transparent",
                  color: "#991b1b",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  opacity: !canCancel || canceling ? 0.45 : 1,
                }}
              >
                {canceling ? "Canceling..." : "Cancel Order"}
              </button>
            </div>

            {/* Optional debug payload (only when ?debug=1) */}
            {debug && order.reliable_order && (
              <details
                style={{
                  marginTop: "1rem",
                  fontSize: "0.8rem",
                  color: "#374151",
                }}
              >
                <summary style={{ cursor: "pointer", marginBottom: "0.25rem" }}>
                  Debug: view raw fulfillment status payload
                </summary>

                <pre
                  style={{
                    maxHeight: "260px",
                    overflow: "auto",
                    background: "#111827",
                    color: "#e5e7eb",
                    borderRadius: "0.5rem",
                    padding: "0.75rem",
                    fontSize: "0.75rem",
                  }}
                >
                  {JSON.stringify(order.reliable_order, null, 2)}
                </pre>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
