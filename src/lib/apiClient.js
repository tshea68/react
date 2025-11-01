// src/lib/apiClient.js
export class ApiError extends Error {
  constructor(status, detail, body) {
    super(`HTTP ${status}${detail ? `: ${detail}` : ""}`);
    this.status = status; this.detail = detail; this.body = body;
  }
}

export async function apiPost(url, json) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(json),
    credentials: "omit", // keep this unless you need cookies
  });
  if (!r.ok) {
    let detail = ""; let body;
    try { body = await r.json(); detail = body?.detail || ""; } catch {}
    throw new ApiError(r.status, detail, body);
  }
  return r.json().catch(() => ({}));
}
