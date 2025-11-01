import { useState, useMemo } from "react";

const API_BASE = "https://fastapi-app-kkkq.onrender.com";

/**
 * Central registry: each "formKey" has its own endpoint, default messages,
 * subject template, and (optionally) a backend recipient key.
 *
 * NOTE: It's safer to keep the real recipient mapping on the BACKEND.
 * Here we send a "to_key" that the server validates against a whitelist.
 */
export const EMAIL_FORMS = {
  rare: {
    endpoint: `${API_BASE}/api/email/rare-request`,
    to_key: "support", // backend maps 'support' -> support@appliancepartgeeks.com
    subject: ({ name }) => `Rare Part Request from ${name || "Customer"}`,
    success: ({ email }) =>
      `Thanks! We received your request and will email you shortly at ${email}.`,
    error:
      "Sorry—we couldn’t send that just now. Please try again or email support@appliancepartgeeks.com.",
  },
  returns: {
    endpoint: `${API_BASE}/api/email/returns`,
    to_key: "returns", // backend maps 'returns' -> returns@appliancepartgeeks.com
    subject: ({ orderNumber }) =>
      `Return Request${orderNumber ? ` – Order #${orderNumber}` : ""}`,
    success: () => "Thanks! Your return request was submitted.",
    error:
      "We couldn't submit your return right now. Try again or email returns@appliancepartgeeks.com.",
  },
  cancel: {
    endpoint: `${API_BASE}/api/email/cancel`,
    to_key: "support",
    subject: ({ orderNumber }) =>
      `Cancellation Request${orderNumber ? ` – Order #${orderNumber}` : ""}`,
    success: () => "Got it — cancellation request submitted.",
    error:
      "We couldn't submit that cancellation. Try again or email support@appliancepartgeeks.com.",
  },
};

/**
 * useEmailSubmit(formKey, overrides?)
 * - Centralizes submit logic, banners, and allows per-form customization via registry.
 * - `overrides` lets a caller tweak copy/endpoint at call-site if needed.
 */
export default function useEmailSubmit(formKey, overrides = {}) {
  const [status, setStatus] = useState(null); // {type:'success'|'error', msg:string}|null
  const [loading, setLoading] = useState(false);

  const cfg = useMemo(() => {
    const base = EMAIL_FORMS[formKey] || {};
    return { ...base, ...overrides };
  }, [formKey, overrides]);

  async function submit(payload) {
    setStatus(null);
    setLoading(true);

    // build subject + payload
    const subject =
      (typeof cfg.subject === "function" ? cfg.subject(payload) : cfg.subject) ||
      "Website submission";

    // IMPORTANT: include a 'to_key' instead of a raw email; backend must validate.
    const body = {
      ...payload,
      subject,
      to_key: cfg.to_key,
    };

    try {
      const res = await fetch(cfg.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let detail = "";
        try {
          const j = await res.json();
          if (j?.detail) detail = ` (${j.detail})`;
        } catch {}
        setStatus({ type: "error", msg: (cfg.error || "Could not send.") + detail });
        return false;
      }

      setStatus({
        type: "success",
        msg:
          (typeof cfg.success === "function" ? cfg.success(payload) : cfg.success) ||
          "Sent!",
      });
      // auto-clear after a few seconds
      setTimeout(() => setStatus(null), 5000);
      return true;
    } catch {
      setStatus({ type: "error", msg: cfg.error || "Could not send." });
      return false;
    } finally {
      setLoading(false);
    }
  }

  return { status, loading, submit, clear: () => setStatus(null) };
}
