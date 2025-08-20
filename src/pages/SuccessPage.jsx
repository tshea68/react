import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

export default function SuccessPage() {
  const [params] = useSearchParams();
  const sid =
    params.get("sid") ||
    params.get("session_id") || // Stripe sometimes uses session_id
    "";
  const API_BASE = import.meta.env.VITE_API_BASE;

  const [status, setStatus] = useState("loading");
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!sid) { setStatus("missing"); return; }

    let timer;
    const poll = async () => {
      try {
        const r = await fetch(
          `${API_BASE}/api/checkout/session/status?sid=${encodeURIComponent(sid)}`
        );
        const data = await r.json();
        setInfo(data);
        const s = data.status || "not_found";
        setStatus(s);
        if (s === "pending") timer = setTimeout(poll, 1200);
      } catch {
        timer = setTimeout(poll, 1500);
      }
    };
    poll();
    return () => clearTimeout(timer);
  }, [sid, API_BASE]);

  if (!sid) return <div className="p-6">Missing session id.</div>;
  if (status === "loading" || status === "pending")
    return <div className="p-6">Confirming payment…</div>;

  const title =
    status === "paid"
      ? "Payment Successful 🎉"
      : status === "failed"
      ? "Payment Failed"
      : "Session Not Found";

  return (
    <div className="max-w-xl mx-auto p-6 space-y-3">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {info?.order_id && <div>Order #: {info.order_id}</div>}
      {info?.email && <div>Email: {info.email}</div>}
      {info?.total_cents != null && (
        <div>Total: ${(info.total_cents / 100).toFixed(2)} {info.currency || "USD"}</div>
      )}
      <Link to="/" className="underline text-blue-600">Continue shopping</Link>
    </div>
  );
}

