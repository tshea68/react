import { useState, useMemo, useRef } from "react";

// Prefer env; fall back to your prod base (WITHOUT trailing slash)
const RAW_API_BASE =
  (import.meta?.env?.VITE_API_BASE || "https://fastapi-app-kkkq.onrender.com").replace(/\/+$/, "");

// Ensure we have a predictable base with /api for primary attempts
const API_BASE = RAW_API_BASE.endsWith("/api") ? RAW_API_BASE : `${RAW_API_BASE}/api`;

/**
 * Central registry for email forms.
 * NOTE: Backend maps `to_key` -> real recipient and validates it.
 */
export const EMAIL_FORMS = {
  rare: {
    endpoint: `${API_BASE}/email/rare-request`,
    to_key: "support",
    subject: ({ name }) => `Rare Part Request from ${name || "Customer"}`,
    success: ({ email }) =>
      `Thanks! We received your request and will email you shortly at ${email}.`,
    error:
      "Sorry—we couldn’t send that just now. Please try again or email support@appliancepartgeeks.com.",
  },
  returns: {
    endpoint: `${API_BASE}/email/returns`,
    to_key: "returns",
    subject: ({ orderNumber }) =>
      `Return Request${orderNumber ? ` – Order #${orderNumber}` : ""}`,
    success: () => "Thanks! Your return request was submitted.",
    error:
      "We couldn't submit your return right now. Try again or email returns@appliancepartgeeks.com.",
  },
  cancel: {
    endpoint: `${API_BASE}/email/cancel`,
    to_key: "support",
    subject: ({ orderNumber }) =>
      `Cancellation Request${orderNumber ? ` – Order #${orderNumber}` : ""}`,
    success: () => "Got it — cancellation request submitted.",
    error:
      "We couldn't submit that cancellation. Try again or email support@appliancepartgeeks.com.",
  },
};

/**
 * POST helper with fallback:
 *  - First try the given endpoint.
 *  - If it's a 404 and the path contains '/api/', retry once with '/api' stripped.
 *  - If it's a 404 and it DOESN'T contain '/api/', retry once with '/api' inserted
 *    (covers the opposite env configuration).
 */
async function postWithApiFallback(endpoint, body) {
  const headers = { "content-type": "application/json" };

  const tryOnce = async (url) => {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials: "omit",
    });
    return res;
  };

  let res = await tryOnce(endpoint);
  if (res.status !== 404) return res;

  // Build a single fallback URL
  let fallback = endpoint;
  if (/\/api\//.test(endpoint)) {
    fallback = endpoint.replace(/\/api(\/|$)/, "$1"); // remove one /api
  } else {
    const u = new URL(endpoint);
    fallback = `${u.origin}/api${u.pathname}${u.search}`;
  }

  return tryOnce(fallback);
}

/**
 * useEmailSubmit(formKey, overrides?)
 */
export default function useEmailSubmit(formKey, overrides = {}) {
  const [status, setStatus] = useState(null); // {type:'success'|'error', msg:string}|null
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  const cfg = useMemo(() => {
    const base = EMAIL_FORMS[formKey] || {};
    return { ...base, ...overrides };
  }, [formKey, overrides]);

  async function submit(payload) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setStatus(null);
    setLoading(true);

    const subject =
      (typeof cfg.subject === "function" ? cfg.subject(payload) : cfg.subject) ||
      "Website submission";

    const body = {
      ...payload,
      subject,
      to_key: cfg.to_key, // backend resolves this to a real, whitelisted address
    };

    try {
      const res = await postWithApiFallback(cfg.endpoint, body);

      if (!res.ok) {
        let detail = "";
        try {
          const j = await res.json();
          if (j?.detail) detail = ` (${j.detail})`;
        } catch {
          // ignore parse issues
        }
        setStatus({
          type: "error",
          msg: (cfg.error || "Could not send.") + detail,
        });
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
      inFlight.current = false;
    }
  }

  return { status, loading, submit, clear: () => setStatus(null) };
}
