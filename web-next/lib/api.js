export async function apiGetJson(path) {
  const base = process.env.API_BASE;
  if (!base) throw new Error("Missing API_BASE in web-next/.env.local");
  const url = `${base}${path}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });

  // Treat 404 cleanly
  if (res.status === 404) return null;

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} for ${url}\n${text.slice(0, 500)}`);
  }
  return await res.json();
}

export function money(v) {
  const n = typeof v === "string" ? Number(v) : v;
  if (Number.isFinite(n)) return `$${n.toFixed(2)}`;
  return null;
}
