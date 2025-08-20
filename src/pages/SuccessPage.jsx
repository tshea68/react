// src/pages/SuccessPage.jsx
import { useEffect, useState } from "react";

export default function SuccessPage() {
  const sid =
    new URLSearchParams(location.search).get("sid") ||
    new URLSearchParams(location.search).get("session_id") ||
    "";

  const [status, setStatus] = useState("loading");
  const [info, setInfo] = useState(null);
  const API_BASE = import.meta.env.VITE_API_BASE;

  useEffect(() => {
    if (!sid) { setStatus("missing"); return; }
    let timer;
    const tick = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/checkout/session/status?sid=${encodeURIComponent(sid)}`);
        const data = await r.json();
        setInfo(data);
        const s = data.status || "not_found";
        setStatus(s);
        if (s === "pending") timer = setTimeout(tick, 1200);
      } catch {
        timer = setTimeout(tick, 1500);
      }
    };
    tick();
    return () => clearTimeout(timer);
  }, [sid, API_BASE]);

  if (status === "missing") return <div className="p-6">Missing session id.</div>;
  if (status === "loading" || status === "pending") return <div className="p-6">Confirming payment…</div>;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-3">
      <h1 className="text-2xl font-semibold">
        {status === "paid" ? "Payment Successful 🎉" :
         status === "failed" ? "Payment Failed" : "Session Not Found"}
      </h1>
      {info?.order_id && <div>Order #: {info.order_id}</div>}
      {info?.email && <div>Email: {info.email}</div>}
      {info?.total_cents != null && <div>Total: ${(info.total_cents/100).toFixed(2)} {info.currency}</div>}
      <a className="underline text-blue-600" href="/">Continue shopping</a>
    </div>
  );
}
