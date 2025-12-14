// src/pages/OrderStatusPage.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";

const API_BASE =
  (import.meta.env?.VITE_API_BASE || "").trim() || "https://api.appliancepartgeeks.com";

/* -----------------------------
   Small utilities
------------------------------ */
function safeStr(v) {
  return (v ?? "").toString().trim();
}

function formatMoney(cents, currency) {
  if (cents == null || Number.isNaN(Number(cents))) return "—";
  const cur = (currency || "USD").toUpperCase();
  return `$${(Number(cents) / 100).toFixed(2)} ${cur}`;
}

function formatDate(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

function getFulfillmentStatus(order) {
  // Prefer any future vendor-neutral field; fallback to what you already store.
  return (
    safeStr(order?.fulfillment_status) ||
    safeStr(order?.reliable_status) ||
    safeStr(
      order?.reliable_order?.orderStatusResponse?.openItems?.partList?.partData?.[0]?.status
    )
  );
}

function getTrackingNumber(order) {
  return safeStr(order?.tracking_number);
}

function getCarrier(order) {
  return safeStr(order?.shipping_carrier);
}

function getEstimatedDelivery(order) {
  // optional on your API
  return order?.estimated_delivery ? formatDate(order.estimated_delivery) : "—";
}

/* -----------------------------
   UI components
------------------------------ */
function StatusPill({ status }) {
  const normalized = (status || "").toLowerCase();
  const label = status || "unknown";

  let bg = "#e5e7eb"; // gray
  let color = "#111827";

  if (["paid", "completed", "processing", "in-progress"].includes(normalized)) {
    bg = "#fef9c3"; // yellow-ish
    color = "#92400e";
  }
  if (["shipped", "delivered"].includes(normalized)) {
    bg = "#dcfce7"; // green-ish
    color = "#166534";
  }
  if (["failed", "canceled", "cancelled"].includes(normalized)) {
    bg = "#fee2e2";
    color = "#991b1b";
  }
  if (["cancel_requested"].includes(normalized)) {
    bg = "#fde68a"; // amber-ish
    color = "#92400e";
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.15rem 0.6rem",
        borderRadius: "999px",
        fontSize: "0.8rem",
        fontWeight: 700,
        backgroundColor: bg,
        color,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      }}
    >
      {label}
    </span>
  );
}

function Banner({ kind = "info", children }) {
  const styles = {
    info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e3a8a" },
    success: { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46" },
    warn: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
    error: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
  }[kind];

  return (
    <div
      style={{
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.text,
        padding: "0.75rem 0.9rem",
        borderRadius: "0.75rem",
        marginBottom: "1rem",
        fontSize: "0.9rem",
      }}
    >
      {children}
    </div>
  );
}

/* -----------------------------
   Page
------------------------------ */
export default function OrderStatusPage() {
  const { token } = useParams();
  const location = useLocation();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null); // { kind, text }

  // Only show raw payload if explicitly requested: /order/<token>?debug=1
  const debug = useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search || "");
      return sp.get("debug") === "1";
    } catch {
      return false;
    }
  }, [location.search]);

  // Customer-facing reference: use the public token (shortened)
  const orderRefShort = useMemo(() => {
    const t = safeStr(token);
    if (!t) return "—";
    const tail = t.length > 12 ? t.slice(-12) : t;
    return `…${tail}`;
  }, [token]);

  const fetchOrder = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/orders/public/${token}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      setOrder(data.order || null);
    } catch (err) {
      setOrder(null);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const shippingSummary = order?.shipping_summary || {};
  const fulfillmentStatus = getFulfillmentStatus(order);

  const internalId = order?.id;
  const fulfillmentOrderRef = safeStr(order?.reliable_order_number); // vendor-neutral label in UI
  const trackingNumber = getTrackingNumber(order);
  const carrier = getCarrier(order);

  const normalizedOrderStatus = (order?.status || "").toLowerCase();
  const isShippedOrDone = ["shipped", "delivered"].includes(normalizedOrderStatus);
  const isCanceledAlready = ["canceled", "cancelled", "cancel_requested"].includes(
    normalizedOrderStatus
  );

  // Allow cancel only once we have a fulfillment order ref and it's not shipped/canceled
  const canCancel = Boolean(fulfillmentOrderRef) && !isShippedOrDone && !isCanceledAlready;

  const cancelHint = !fulfillmentOrderRef
    ? "Cancel is unavailable until the order has been submitted for fulfillment."
    : isShippedOrDone
    ? "Order has shipped; cancellation may not be possible."
    : isCanceledAlready
    ? "Cancellation already requested or completed."
    : "";

  // Backend route is still /refresh-reliable (implementation detail)
  const handleRefreshStatus = async () => {
    if (!order?.id) return;
    setRefreshing(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`${API_BASE}/api/orders/${order.id}/refresh-reliable`, {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      // Some backends return ok:false while still 200 — handle it defensively
      if (data && data.ok === false) {
        const msg =
          data?.error?.body ||
          data?.error?.message ||
          "We could not refresh status right now. Please try again shortly.";
        setNotice({ kind: "warn", text: msg });
      } else {
        setNotice({ kind: "success", text: "Order status refreshed." });
      }

      await fetchOrder();
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setRefreshing(false);
    }
  };

  // Backend route is still /cancel-reliable (implementation detail)
  const handleCancelOrder = async () => {
    if (!token) return;

    const ok = window.confirm(
      "Cancel this order?\n\nIf the order has already shipped, cancellation may not be possible."
    );
    if (!ok) return;

    setCanceling(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`${API_BASE}/api/orders/public/${token}/cancel-reliable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // whole-order cancel
      });

      const data = await res.json().catch(() => ({}));

      // If backend actually returns non-2xx, surface it
      if (!res.ok) {
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      // IMPORTANT: your screenshot shows HTTP 200 with ok:false and an error payload.
      // Treat that as a failure and show a real customer message.
      if (data && data.ok === false) {
        const msg =
          data?.error?.body ||
          data?.error?.message ||
          "We couldn’t submit a cancellation request right now. Please contact support.";
        setNotice({ kind: "error", text: msg });
      } else {
        setNotice({
          kind: "success",
          text:
            "Cancellation request submitted. If the order has not shipped, we will attempt to cancel it and update this page.",
        });
      }

      await fetchOrder();
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setCanceling(false);
    }
  };

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
          maxWidth: "760px",
          margin: "0 auto",
          background: "#ffffff",
          borderRadius: "1rem",
          boxShadow: "0 10px 35px rgba(0, 0, 0, 0.08)",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "0.25rem" }}>
          Track Your Order
        </h1>
        <p style={{ color: "#6b7280", marginBottom: "1.25rem" }}>
          Use this page to check the latest status of your order.
        </p>

        {!token && <Banner kind="error">Missing order token in URL.</Banner>}

        {notice?.text && <Banner kind={notice.kind}>{notice.text}</Banner>}

        {loading && <p style={{ color: "#4b5563" }}>Loading your order details...</p>}

        {error && <Banner kind="error">Error: {error}</Banner>}

        {!loading && !error && order && (
          <>
            {/* Summary header */}
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
                <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>Order Reference</div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "1rem",
                    marginTop: "0.2rem",
                    marginBottom: "0.4rem",
                  }}
                >
                  {orderRefShort}
                </div>

                <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  Placed on {order.created_at ? formatDate(order.created_at) : "—"}
                </div>

                {internalId != null && (
                  <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: "0.3rem" }}>
                    Internal ID:{" "}
                    <span style={{ fontFamily: "monospace" }}>{String(internalId)}</span>
                  </div>
                )}
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>Order Status</div>
                <div style={{ marginTop: "0.2rem" }}>
                  <StatusPill status={order.status} />
                </div>

                {fulfillmentStatus && (
                  <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "0.5rem" }}>
                    Fulfillment Status: <strong>{fulfillmentStatus}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Cards: total + shipping */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  padding: "0.9rem 1rem",
                  borderRadius: "0.75rem",
                  background: "#f9fafb",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Total</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: "0.2rem" }}>
                  {formatMoney(order.total_amount_cents, order.currency)}
                </div>
              </div>

              <div
                style={{
                  padding: "0.9rem 1rem",
                  borderRadius: "0.75rem",
                  background: "#f9fafb",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Shipping To</div>
                <div style={{ fontSize: "0.95rem", color: "#111827", marginTop: "0.2rem" }}>
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

            {/* Cards: fulfillment + tracking */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "1rem",
                marginBottom: "1.25rem",
              }}
            >
              <div
                style={{
                  padding: "0.9rem 1rem",
                  borderRadius: "0.75rem",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Fulfillment Order #</div>
                <div style={{ fontSize: "0.98rem", fontWeight: 800, marginTop: "0.2rem" }}>
                  {fulfillmentOrderRef || "Pending"}
                </div>
              </div>

              <div
                style={{
                  padding: "0.9rem 1rem",
                  borderRadius: "0.75rem",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Last Updated</div>
                <div style={{ fontSize: "0.98rem", fontWeight: 700, marginTop: "0.2rem" }}>
                  {order.last_status_check_at ? formatDate(order.last_status_check_at) : "Not checked yet"}
                </div>
              </div>

              <div
                style={{
                  padding: "0.9rem 1rem",
                  borderRadius: "0.75rem",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Tracking</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "0.2rem" }}>
                  {trackingNumber ? (
                    <>
                      {carrier ? <>{carrier}: </> : null}
                      <span style={{ fontFamily: "monospace" }}>{trackingNumber}</span>
                    </>
                  ) : (
                    "Not available yet"
                  )}
                </div>
              </div>

              <div
                style={{
                  padding: "0.9rem 1rem",
                  borderRadius: "0.75rem",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Estimated Delivery</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "0.2rem" }}>
                  {getEstimatedDelivery(order)}
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
                  padding: "0.5rem 1rem",
                  borderRadius: "999px",
                  border: "none",
                  cursor: refreshing ? "default" : "pointer",
                  backgroundColor: "#111827",
                  color: "#f9fafb",
                  fontSize: "0.9rem",
                  fontWeight: 700,
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
                  padding: "0.5rem 1rem",
                  borderRadius: "999px",
                  border: "1px solid #991b1b",
                  cursor: !canCancel || canceling ? "default" : "pointer",
                  backgroundColor: "transparent",
                  color: "#991b1b",
                  fontSize: "0.9rem",
                  fontWeight: 800,
                  opacity: !canCancel || canceling ? 0.45 : 1,
                }}
              >
                {canceling ? "Submitting..." : isCanceledAlready ? "Cancellation Requested" : "Cancel Order"}
              </button>
            </div>

            {/* Optional debug payload */}
            {debug && order?.reliable_order && (
              <details style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#374151" }}>
                <summary style={{ cursor: "pointer", marginBottom: "0.35rem" }}>
                  Debug: view raw fulfillment payload
                </summary>
                <pre
                  style={{
                    maxHeight: "280px",
                    overflow: "auto",
                    background: "#111827",
                    color: "#e5e7eb",
                    borderRadius: "0.5rem",
                    padding: "0.85rem",
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
