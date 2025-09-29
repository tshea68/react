// src/SingleProduct.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import PartImage from "./components/PartImage"; // ← fixed path

const API_BASE = import.meta.env.VITE_API_URL;

/* ---------------- helpers ---------------- */
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const isTruthy = (v) => v !== undefined && v !== null && v !== "";
const asNum = (v) => {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const fmt = (v, curr = "USD") => {
  const n = typeof v === "number" ? v : asNum(v);
  if (n == null) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: curr || "USD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
};
const stockBadge = (raw) => {
  const s = String(raw || "").toLowerCase();
  if (/special/.test(s)) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white">
        Special order
      </span>
    );
  }
  if (/unavailable|out\s*of\s*stock|ended/.test(s)) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">
        Unavailable
      </span>
    );
  }
  if (/(^|\s)in\s*stock(\s|$)|\bavailable\b/.test(s)) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
        In stock
      </span>
    );
  }
  return (
    <span className="text-[11px] px-2 py-0.5 rounded bg-black text-white">
      Unavailable
    </span>
  );
};

/* -------------- layout rules (S1–S11) -------------- */
function decideLayout({ sameMpn, newStatus, refurbOld, refurbNew }) {
  const hasRefOld = !!refurbOld;
  const hasRefNew = !!refurbNew;

  if (sameMpn) {
    if (newStatus === "in_stock" && !hasRefOld) return { tiles: ["new"], banner: "" };                                  // S1
    if (newStatus === "in_stock" && hasRefOld) return { tiles: ["refurbOld", "new"], banner: "New available for $X" };  // S2
    if (newStatus === "special"  && hasRefOld) return { tiles: ["refurbOld"], banner: "New can be special ordered for $X" }; // S3
    if (newStatus === "unavailable" && hasRefOld) return { tiles: ["refurbOld"], banner: "New currently unavailable" }; // S4
    if (newStatus === "special"  && !hasRefOld) return { tiles: ["new"], banner: "Special order" };                     // S5
    if (newStatus === "unavailable" && !hasRefOld) return { tiles: [], banner: "Reference only" };                      // S6
  } else {
    if (newStatus === "in_stock" && hasRefOld && !hasRefNew)  return { tiles: ["refurbOld", "new"], banner: "New replacement $X" };                      // S7
    if (newStatus === "special"  && hasRefOld && !hasRefNew)  return { tiles: ["refurbOld"], banner: "New replacement can be special ordered for $X" };  // S8
    if (newStatus === "unavailable" && hasRefOld && !hasRefNew) return { tiles: ["refurbOld"], banner: "New replacement unavailable" };                 // S9
    if (newStatus === "in_stock" && hasRefOld && hasRefNew)   return { tiles: ["refurbOld", "new"], banner: "New replacement $X" };                      // S10
    if (newStatus === "none" && hasRefOld)                    return { tiles: ["refurbOld"], banner: "Replacement info pending" };                      // S11
  }

  if (hasRefOld || hasRefNew) return { tiles: [hasRefOld ? "refurbOld" : "refurbNew"], banner: "" };
  return { tiles: [], banner: "Reference only" };
}

function statusFromReliable({ price, stock_status }) {
  const priceNum = asNum(price);
  const s = String(stock_status || "").toLowerCase();
  if (/special/.test(s)) return "special";
  if (/(^|\s)in\s*stock(\s|$)|\bavailable\b/.test(s)) return "in_stock";
  if (/unavailable|out\s*of\s*stock|ended/.test(s)) return "unavailable";
  if (priceNum != null && priceNum > 0) return "in_stock";
  return "none";
}

/* -------------- fetching -------------- */
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function fetchReliableDetail(encMpn) {
  const tries = [
    `${API_BASE}/api/parts/${encMpn}`,
    `${API_BASE}/api/parts/by-mpn/${encMpn}`,
    `${API_BASE}/api/parts/detail/${encMpn}`,
  ];
  for (const u of tries) {
    try {
      const data = await fetchJSON(u);
      if (data) return data;
    } catch (_) {}
  }
  return null;
}

async function fetchBestRefurb(encMpn) {
  try {
    const d = await fetchJSON(`${API_BASE}/api/compare/xmarket/${encMpn}?limit=1`);
    const best = d?.refurb?.best;
    if (!best) return null;
    return {
      price: asNum(best.price),
      url: best.url || d?.refurb?.offers?.[0]?.url || null,
      offer_id: best.offer_id || best.listing_id || null,
      qty: d?.refurb?.total_quantity ?? 0,
    };
  } catch {
    return null;
  }
}

/* ---------------- page ---------------- */
export default function SingleProduct() {
  const { mpn } = useParams();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [requested, setRequested] = useState(null);
  const [canonical, setCanonical] = useState(null);
  const [refurbOld, setRefurbOld] = useState(null);
  const [refurbNew, setRefurbNew] = useState(null);

  const reqKey = norm(mpn);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const enc = encodeURIComponent(mpn);
        const rel = await fetchReliableDetail(enc);
        if (cancelled) return;

        const canonicalMpn =
          rel?.canonical_mpn ||
          rel?.mpn_canonical ||
          rel?.new_mpn ||
          rel?.mpn ||
          mpn;

        let relCanonical = rel;
        if (norm(canonicalMpn) !== norm(rel?.mpn || mpn)) {
          try {
            relCanonical = await fetchReliableDetail(encodeURIComponent(canonicalMpn));
          } catch {}
        }

        const refurbForRequested = await fetchBestRefurb(enc);
        if (cancelled) return;

        let refurbForCanonical = null;
        if (norm(canonicalMpn) !== reqKey) {
          refurbForCanonical = await fetchBestRefurb(encodeURIComponent(canonicalMpn));
        }

        if (!cancelled) {
          setRequested(rel || null);
          setCanonical(relCanonical || null);
          setRefurbOld(refurbForRequested);
          setRefurbNew(refurbForCanonical);
        }
      } catch (e) {
        if (!cancelled) setErr("Couldn't load this part.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reqKey, mpn]);

  const sameMpn = useMemo(() => {
    const c = canonical?.canonical_mpn || canonical?.mpn || mpn;
    return norm(c) === reqKey;
  }, [canonical, mpn, reqKey]);

  const newStatus = useMemo(() => {
    if (!canonical) return "none";
    return statusFromReliable({
      price: canonical?.price ?? canonical?.price_num,
      stock_status: canonical?.stock_status,
    });
  }, [canonical]);

  const layout = useMemo(() => {
    return decideLayout({ sameMpn, newStatus, refurbOld, refurbNew });
  }, [sameMpn, newStatus, refurbOld, refurbNew]);

  const bannerText = useMemo(() => {
    if (!layout.banner) return "";
    const newPrice = canonical?.price ?? canonical?.price_num ?? null;
    return layout.banner.replace("$X", fmt(newPrice));
  }, [layout.banner, canonical]);

  if (loading) return <div className="w-[90%] mx-auto py-10 text-gray-600">Loading…</div>;
  if (err) return <div className="w-[90%] mx-auto py-10 text-red-600">{err}</div>;

  const canonicalMpn = canonical?.mpn || mpn;
  const requestedMpn = mpn;

  return (
    <div className="w-[90%] mx-auto pb-12">
      <div className="w-full border-b border-gray-200 mb-4">
        <nav className="text-sm text-gray-600 py-2 w-full">
          <ul className="flex flex-wrap items-center gap-2">
            <li>
              <Link to="/" className="hover:underline text-blue-600">Home</Link>
              <span className="mx-1">/</span>
            </li>
            <li>
              <Link to={`/model?model=${encodeURIComponent(location.state?.fromModel || "")}`} className="hover:underline text-blue-600">
                Parts
              </Link>
              <span className="mx-1">/</span>
            </li>
            <li className="font-semibold text-black">Part: {requestedMpn} {sameMpn ? "" : "(superseded)"}</li>
          </ul>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="border rounded p-2">
            <PartImage
              imageUrl={canonical?.image_url || requested?.image_url}
              imageKey={canonical?.image_key}
              mpn={canonicalMpn}
              alt={canonical?.name || requested?.name || canonicalMpn}
              className="w-full h-[340px] object-contain"
              imgProps={{ loading: "lazy", decoding: "async" }}
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <h1 className="text-xl font-semibold leading-tight mb-1">
            {canonical?.name || requested?.name || canonicalMpn}
          </h1>
          <div className="text-sm text-gray-600 mb-4">
            Part: <span className="font-medium">{requestedMpn}</span>{" "}
            {!sameMpn && (
              <span className="ml-2 text-gray-500">(Replaced by {canonicalMpn})</span>
            )}
          </div>

          {bannerText ? (
            <div className="mb-3">
              <span className="inline-block px-3 py-1 rounded bg-red-600 text-white text-sm">
                {bannerText}
              </span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {layout.tiles.map((t, idx) => {
              if (t === "new") {
                return (
                  <NewTile
                    key={`new-${idx}`}
                    record={canonical}
                    to={`/parts/${encodeURIComponent(canonicalMpn)}`}
                  />
                );
              }
              if (t === "refurbOld" && refurbOld) {
                return (
                  <RefurbTile
                    key={`ro-${idx}`}
                    label="Refurbished"
                    mpn={requestedMpn}
                    price={refurbOld.price}
                    qty={refurbOld.qty}
                    to={`/refurb/${encodeURIComponent(requestedMpn)}`}
                    subnote={!sameMpn ? "Original OEM part" : undefined}
                  />
                );
              }
              if (t === "refurbNew" && refurbNew) {
                return (
                  <RefurbTile
                    key={`rn-${idx}`}
                    label="Refurbished (replacement)"
                    mpn={canonicalMpn}
                    price={refurbNew.price}
                    qty={refurbNew.qty}
                    to={`/refurb/${encodeURIComponent(canonicalMpn)}`}
                    subnote="For the replacement MPN"
                  />
                );
              }
              return null;
            })}
          </div>

          {isTruthy(canonical?.description) && (
            <div className="mt-4 text-sm text-gray-700 whitespace-pre-line">
              {canonical.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- tiles ---------------- */
function NewTile({ record, to }) {
  const price = record?.price ?? record?.price_num ?? null;
  return (
    <div className="border rounded p-3 flex items-start gap-3 hover:shadow transition">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-gray-700 mb-0.5">New (OEM)</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {stockBadge(record?.stock_status)}
          {price != null ? <span className="font-semibold">{fmt(price)}</span> : null}
        </div>
        <Link
          to={to}
          className="mt-2 inline-block rounded bg-green-600 text-white text-xs px-3 py-1 hover:bg-green-700"
        >
          Buy New
        </Link>
      </div>
    </div>
  );
}

function RefurbTile({ label, mpn, price, qty, to, subnote }) {
  return (
    <div className="border rounded p-3 flex items-start gap-3 hover:shadow transition">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-gray-700 mb-0.5">{label}</div>
        <div className="text-sm font-semibold">{mpn}</div>
        {subnote ? <div className="text-[11px] text-gray-500 mt-0.5">{subnote}</div> : null}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">
            In stock
          </span>
          {price != null ? <span className="font-semibold">{fmt(price)}</span> : null}
          {qty ? <span className="text-[11px] text-gray-600">({qty} available)</span> : null}
        </div>
        <Link
          to={to}
          className="mt-2 inline-block rounded bg-red-600 text-white text-xs px-3 py-1 hover:bg-red-700"
        >
          View refurbished offers
        </Link>
      </div>
    </div>
  );
}

