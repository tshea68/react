// src/lib/useEmailSubmit.js
import { useState, useMemo, useRef } from "react";

// Prefer env; fall back to prod base (WITHOUT trailing slash)
const RAW_API_BASE =
  (import.meta?.env?.VITE_API_BASE || "https://fastapi-app-kkkq.onrender.com").replace(/\/+$/, "");

// Ensure we have a predictable base with /api for primary attempts
const API_BASE = RAW_API_BASE.endsWith("/api") ? RAW_API_BASE : `${RAW_API_BASE}/api`;

/**
 * Central registry for email forms.
 * Backend maps `to_key` -> real recipient and validates it.
 */
export const EMAIL_FORMS = {
  rare: {
    endpoint: `${API_BASE}/email/rare-request`,
    to_key: "support",
    subject: ({ name }) => `Rare Part Request from ${name || "Customer"}`,
    success: ({ email }) =>
      `Thanks! We received your request and will email you shortly${email ? ` at ${email}` : ""}.`,
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
 *  - Try the given endpoint.
 *  - If 404 and path contains '/api/', retry once with '/api' stripped.
 *  - If 404 and path lacks '/api/', retry once with '/api' inserted.
 */
async function postWithApiFallback(endpoint, body) {
  const headers = { "content-type": "application/json" };

  const tryOnce = async (url) =>
    fetch(url, { method: "POST", headers, body: JSON.stringify(body), credentials: "omit" });

  let res = await tryOnce(endpoint);
  if (res.status !== 404) return res;

  let fallback = endpoint;
  if (/\/api\//.test(endpoint)) {
    fallback = end
