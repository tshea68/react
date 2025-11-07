// src/components/HeaderMenu.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Truck,
  Search,
  Undo2,
  Repeat,
  Menu,
  X,
  ChevronDown,
  ShoppingCart,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import FormStatus from "./FormStatus";

/* ─────────────────────────────
   Portal for desktop dropdowns
   accepts `title`, keeps open during autofill
   ───────────────────────────── */
function PortalMenu({ open, onClose, title, children }) {
  const [mounted, setMounted] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const leaveTimer = useRef(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  if (!mounted || !open) return null;

  const requestClose = () => {
    if (!focusWithin) onClose?.();
  };

  const handleMouseEnter = () => {
    clearTimeout(leaveTimer.current);
  };

  const handleMouseLeave = () => {
    clearTimeout(leaveTimer.current);
    // grace to allow selecting browser autofill
    leaveTimer.current = setTimeout(requestClose, 300);
  };

  const handleFocusCapture = () => setFocusWithin(true);

  const handleBlurCapture = (e) => {
    setTimeout(() => {
      const root = e.currentTarget;
      if (!root.contains(document.activeElement)) setFocusWithin(false);
    }, 0);
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* click-outside (no hover-close) */}
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={`
          pointer-events-auto fixed left-1/2 -translate-x-1/2 top-[5rem]
          bg-white text-black border rounded shadow-lg ring-1 ring-black/5
          w-[min(90vw,64rem)] max-h-[75vh] overflow-y-auto
          text-sm z-[61]
        `}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocusCapture={handleFocusCapture}
        onBlurCapture={handleBlurCapture}
      >
        {title && (
          <div className="bg-[#001F3F] text-white px-4 py-2 text-[13px] font-semibold uppercase tracking-wide rounded-t">
            {title}
          </div>
        )}
        <div className="p-3 pad:p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────
   API base helpers
   ───────────────────────────── */
function getApiBases() {
  const raw =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_API_BASE) ||
    "https://api.appliancepartgeeks.com";
  const base = raw.replace(/\/+$/, "");
  const withApi = /\/api$/.test(base) ? base : `${base}/api`;
  const withoutApi = /\/api$/.test(base) ? base.replace(/\/api$/, "") : base;
  return { withApi, withoutApi };
}

async function postJsonWithFallback(paths, body) {
  // paths should be like: ["email/rare-request"]
  const { withApi, withoutApi } = getApiBases();
  const candidates = [
    `${withApi}/${paths[0].replace(/^\/+/, "")}`,
    `${withoutApi}/${paths[0].replace(/^\/+/, "")}`,
  ];

  let lastErr = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "omit",
      });
      if (res.ok) {
        console.info("[email] posted to:", url);
        return await res.json();
      }
      if (res.status === 404) {
        // try next candidate
        lastErr = new Error(`404 at ${url}`);
        continue;
      }
      const text = await res.text().catch(() => "");
      const detail = (() => {
        try {
          const j = JSON.parse(text);
          if (j?.detail)
            return typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
        } catch {}
        return text || `HTTP ${res.status}`;
      })();
      throw new Error(detail);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No endpoint matched");
}

/* ─────────────────────────────
   Main header menu
   ───────────────────────────── */
export default function HeaderMenu() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMobileKey, setOpenMobileKey] = useState(null);
  const [hoverKey, setHoverKey] = useState(null);
  const hoverTimer = useRef(null);

  const { cartItems } = useCart();
  const navigate = useNavigate();
  const cartCount = cartItems.reduce(
    (sum, item) => sum + (item.qty || item.quantity || 1),
    0
  );

  // Status + submitting flag for Rare Part Request (desktop + mobile)
  const [rareStatus, setRareStatus] = useState(null);
  const [rareSubmitting, setRareSubmitting] = useState(false);

  // Auto-close the Rare Part dropdown after success and clear toast
  useEffect(() => {
    if (rareStatus?.type === "success") {
      const t = setTimeout(() => {
        setHoverKey(null);       // close desktop dropdown
        setOpenMobileKey(null);  // collapse mobile accordion (if open)
        setRareStatus(null);     // clear status/toast
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [rareStatus]);

  /* ---- desktop hover helpers ---- */
  const openWithDelay = (key) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoverKey(key), 60);
  };
  const closeNow = () => setHoverKey(null);

  /* ---- mobile accordion toggle ---- */
  const toggleMobile = (key) =>
    setOpenMobileKey((cur) => (cur === key ? null : key));

  /* ---- server POST (with fallback URL detection) ---- */
  const handleRareSubmit = async (e, { nameId, emailId, messageId, honeypotId }) => {
    e.preventDefault();
    if (rareSubmitting) return;
    setRareSubmitting(true);

    const name = document.getElementById(nameId)?.value?.trim() || "";
    const email = document.getElementById(emailId)?.value?.trim() || "";
    const message = document.getElementById(messageId)?.value?.trim() || "";
    const honey = honeypotId ? document.getElementById(honeypotId)?.value?.trim() : "";

    // Honeypot: pretend success but do nothing
    if (honey) {
      e.target.reset();
      setRareStatus({
        type: "success",
        msg: `Thanks! We received your request and will email you shortly${email ? ` at ${email}` : ""}.`,
      });
      setRareSubmitting(false);
      return;
    }

    try {
      await postJsonWithFallback(["email/rare-request"], {
        name,
        email,
        message,
        // subject/to_key can be set server-side; keep lean here
      });

      setRareStatus({
        type: "success",
        msg: `Thanks! We received your request and will email you shortly${email ? ` at ${email}` : ""}.`,
      });

      e.target.reset();
    } catch (err) {
      console.error(err);
      setRareStatus({
        type: "error",
        msg:
          `Sorry—couldn’t send just now.` +
          (err?.message ? ` (${String(err.message)})` : "") +
          `\nPlease email support@appliancepartgeeks.com.`,
      });
    } finally {
      setRareSubmitting(false);
    }
  };

  return (
    <>
      {/* DESKTOP/TABLET NAV */}
      <nav className="hidden pad:flex flex-col justify-end pb-2 w-full">
        <div
          className={`
            flex flex-wrap items-center justify-center gap-x-8 gap-y-3
            text-[clamp(10px,1.15vw,14px)]
            lap:text-xs
            desk:text-[clamp(10px,1.15vw,14px)]
            font-semibold text-white relative z-40 pb-2
          `}
        >
          {/* Rare Part Request */}
          <div
            className="relative inline-block"
            onMouseEnter={() => openWithDelay("rare")}
          >
            <button className="flex items-center gap-2">
              <Search className="w-5 h-5" /> Rare Part Request
            </button>
            <PortalMenu
              open={hoverKey === "rare"}
              onClose={closeNow}
              title="Rare Part Request"
            >
              {/* Toast/inline status for desktop rare form */}
              {rareStatus && (
                <FormStatus
                  status={rareStatus}
                  onClose={() => setRareStatus(null)}
                  variant="toast"
                />
              )}

              <div className="flex flex-col pad:flex-row gap-6">
                <div className="w-full pad:w-1/2 space-y-4">
                  <h2 className="text-xl font-bold">
                    Still Looking For That Rare Part?
                  </h2>
                  <ul className="list-disc pl-5">
                    <li>Need a hard-to-find handle?</li>
                    <li>Can’t find that switch or dial?</li>
                    <li>Old ice maker needs to be replaced?</li>
                  </ul>
                  <p>
                    We see thousands of recovered refrigerators on a daily
                    basis. Reach out to us and we will hunt it down.
                  </p>
                </div>

                <div className="w-full pad:w-1/2 space-y-3">
                  <form
                    className="space-y-3"
                    onSubmit={(e) =>
                      handleRareSubmit(e, {
                        nameId: "name",
                        emailId: "email",
                        messageId: "message",
                        honeypotId: "company",
                      })
                    }
                    aria-busy={rareSubmitting}
                  >
                    {/* Honeypot */}
                    <input
                      type="text"
                      id="company"
                      name="company"
                      className="hidden"
                      tabIndex={-1}
                      autoComplete="off"
                    />
                    <div className="flex flex-col">
                      <label htmlFor="name" className="font-medium">
                        Your Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        required
                        autoComplete="name"
                        disabled={rareSubmitting}
                        className="border p-2 rounded"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="email" className="font-medium">
                        Your Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        required
                        autoComplete="email"
                        disabled={rareSubmitting}
                        className="border p-2 rounded"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="message" className="font-medium">
                        What part are you looking for?
                      </label>
                      <textarea
                        name="message"
                        id="message"
                        rows={4}
                        required
                        disabled={rareSubmitting}
                        className="border p-2 rounded"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={rareSubmitting}
                      className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2`}
                    >
                      {rareSubmitting && (
                        <span className="inline-block h-4 w-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                      )}
                      {rareSubmitting ? "Sending…" : "Submit Request"}
                    </button>
                  </form>
                </div>
              </div>
            </PortalMenu>
          </div>

          {/* Shipping Policy */}
          <div
            className="relative inline-block"
            onMouseEnter={() => openWithDelay("ship")}
          >
            <button className="flex items-center gap-2">
              <Truck className="w-5 h-5" /> Shipping Policy
            </button>
            <PortalMenu open={hoverKey === "ship"} onClose={closeNow} title="Shipping Policy">
              <div className="flex flex-col pad:flex-row gap-6">
                <div className="w-full pad:w-1/3 space-y-2">
                  <h5 className="font-semibold">Fast &amp; Reliable Shipping</h5>
                  <p>
                    At <strong>Appliance Part Geeks</strong>, we prioritize
                    fast and efficient shipping to ensure you receive your
                    order as quickly as possible. All orders are processed
                    and shipped within <strong>one business day</strong>.
                  </p>
                  <p>
                    Orders placed before our daily shipping cutoff time
                    will be shipped the <strong>same business day</strong>.
                    Orders placed after the cutoff time will be shipped the{" "}
                    <strong>next business day</strong>.
                  </p>

                  <h5 className="font-semibold">Tracking &amp; Delivery</h5>
                  <p>
                    Once your order has shipped, you will receive a
                    tracking number via email. Delivery times vary based
                    on the shipping method selected at checkout.
                  </p>
                </div>

                <div className="w-full pad:w-1/3 space-y-2">
                  <h5 className="font-semibold">Shipping Address Accuracy</h5>
                  <p>
                    Please double-check your shipping address before
                    submitting payment. We can only ship to the address
                    provided at checkout.
                  </p>
                  <ul className="list-disc pl-5">
                    <li>
                      <strong>Address Changes:</strong> Once an order has
                      been placed, we are unable to modify the shipping
                      address.
                    </li>
                    <li>
                      <strong>Undeliverable Packages:</strong> If an order
                      is returned due to an incorrect or incomplete
                      address, the buyer will be responsible for any
                      additional shipping costs.
                    </li>
                  </ul>

                  <h5 className="font-semibold">Shipping Carriers &amp; Methods</h5>
                  <ul className="list-disc pl-5">
                    <li>
                      <strong>Domestic Shipping:</strong> Standard and
                      expedited shipping options are available at
                      checkout.
                    </li>
                    <li>
                      <strong>International Shipping:</strong> Availability
                      depends on the destination country. Additional
                      customs duties or taxes may apply.
                    </li>
                  </ul>

                  <h5 className="font-semibold">Lost or Delayed Shipments</h5>
                  <p>
                    If your package is delayed or lost in transit,
                    please contact the carrier first using your tracking
                    number. If further assistance is needed, email{" "}
                    <a className="custom-link" href="mailto:support@appliancepartgeeks.com">
                      support@appliancepartgeeks.com
                    </a>
                    .
                  </p>
                </div>

                <div className="w-full pad:w-1/3 space-y-2">
                  <h5 className="font-semibold">International Customers – Please Read</h5>
                  <p>
                    <strong>Effective: March 18, 2025</strong>
                  </p>
                  <p>
                    This policy applies only to international orders—any orders
                    shipped outside the United States, including Canada, Mexico,
                    and other countries.
                  </p>

                  <h6 className="font-semibold">Shipping Costs</h6>
                  <p>
                    Some international orders may require additional
                    shipping fees. If additional fees apply, we will
                    contact you. If we do not receive a response within
                    2 days, the order may be canceled and refunded.
                  </p>

                  <h6 className="font-semibold">Customs &amp; Duties</h6>
                  <p>
                    The receiver is responsible for all duties, tariffs, and
                    taxes. We do not collect these at checkout. We will never
                    undervalue a shipment or mark it as a gift.
                  </p>

                  <h6 className="font-semibold">Refused Deliveries &amp; No Refunds</h6>
                  <p>
                    If duties/tariffs are refused, we will instruct the
                    carrier to dispose of the shipment. No refund will be
                    issued.
                  </p>

                  <h6 className="font-semibold">Delivery Times &amp; Customs Delays</h6>
                  <p>
                    International shipping times vary; customs clearance may
                    cause delays beyond our control.
                  </p>

                  <h6 className="font-semibold">Order Feasibility</h6>
                  <p>
                    For low-value items with disproportionately high shipping,
                    we may reach out to discuss options before proceeding.
                  </p>

                  <p className="text-xs italic">
                    By placing an order with Appliance Part Geeks, you
                    agree to these terms.
                  </p>
                </div>
              </div>
            </PortalMenu>
          </div>

          {/* Our Return Policy */}
          <div
            className="relative inline-block"
            onMouseEnter={() => openWithDelay("return")}
          >
            <button className="flex items-center gap-2">
              <Undo2 className="w-5 h-5" /> Our Return Policy
            </button>
            <PortalMenu open={hoverKey === "return"} onClose={closeNow} title="Our Return Policy">
              <div className="flex flex-col pad:flex-row gap-6">
                <div className="w-full pad:w-1/3 space-y-2">
                  <h5 className="font-semibold">Return Eligibility</h5>
                  <ul className="list-disc pl-5">
                    <li>
                      <strong>Return Window:</strong> Initiate within{" "}
                      <strong>30 days</strong> of delivery.
                    </li>
                    <li>
                      <strong>Condition:</strong> Items must be unused,
                      unmodified, and in original condition with all
                      packaging, labels, and components.
                    </li>
                    <li>
                      <strong>RAN Required:</strong> A Return
                      Authorization Number must be obtained before
                      returning any item. Returns without an approved
                      RAN will be refused.
                    </li>
                  </ul>

                  <h5 className="font-semibold">Non-Returnable Items</h5>
                  <ul className="list-disc pl-5">
                    <li>“For Parts Only” or “As-Is” items.</li>
                    <li>
                      Installed, modified, or damaged items due to improper
                      installation/handling.
                    </li>
                    <li>
                      Items missing essential components or original
                      packaging (may be refused or incur a restocking fee).
                    </li>
                  </ul>
                </div>

                <div className="w-full pad:w-1/3 space-y-2">
                  <h5 className="font-semibold">How to Initiate a Return</h5>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>
                      Email{" "}
                      <a className="custom-link" href="mailto:returns@appliancepartgeeks.com">
                        returns@appliancepartgeeks.com
                      </a>{" "}
                      with your order number in the subject line.
                    </li>
                    <li>
                      Include your full name, order date, reason for return,
                      and photos (if applicable).
                    </li>
                    <li>
                      Our team will review your request within{" "}
                      <strong>3 business days</strong> and provide return
                      instructions.
                    </li>
                  </ol>

                  <h5 className="font-semibold">Shipping &amp; Return Process</h5>
                  <ul className="list-disc pl-5">
                    <li>
                      If <strong>our error</strong> (wrong/defective item), we
                      cover return shipping.
                    </li>
                    <li>
                      If <strong>customer error</strong> (wrong item, changed
                      mind), customer covers return shipping.
                    </li>
                    <li>
                      Items must be securely packed to prevent transit damage
                      and include the issued RAN on the package.
                    </li>
                  </ul>
                </div>

                <div className="w-full pad:w-1/3 space-y-2">
                  <h5 className="font-semibold">Refunds &amp; Processing</h5>
                  <ul className="list-disc pl-5">
                    <li>
                      Refunds issued within <strong>5–7 business days</strong>{" "}
                      after item is received and inspected.
                    </li>
                    <li>Refunds credited to the original payment method.</li>
                    <li>
                      Shipping fees are non-refundable unless the return is due
                      to our error.
                    </li>
                  </ul>

                  <h5 className="font-semibold">Right to Refuse</h5>
                  <p>
                    Appliance Part Geeks reserves the right to refuse any return
                    that does not meet our policy guidelines or is deemed
                    fraudulent.
                  </p>

                  <p className="text-sm">
                    Need help? Email{" "}
                    <a className="custom-link" href="mailto:returns@appliancepartgeeks.com">
                      returns@appliancepartgeeks.com
                    </a>
                    .
                  </p>
                </div>
              </div>
            </PortalMenu>
          </div>

          {/* Cancellation Policy */}
          <div
            className="relative inline-block"
            onMouseEnter={() => openWithDelay("cancel")}
          >
            <button className="flex items-center gap-2">
              <Repeat className="w-5 h-5" /> Cancellation Policy
            </button>
            <PortalMenu open={hoverKey === "cancel"} onClose={closeNow} title="Cancellation Policy">
              <div className="flex flex-col pad:flex-row gap-6">
                <div className="w-full pad:w-1/2 space-y-2">
                  <h5 className="font-semibold">Need to Cancel Your Order?</h5>
                  <p>
                    Appliance repairs are time-sensitive, and at Appliance Part
                    Geeks, we prioritize fast and efficient shipping. If you
                    need to cancel your order, please contact us immediately at{" "}
                    <a className="custom-link" href="mailto:support@appliancepartgeeks.com">
                      support@appliancepartgeeks.com
                    </a>
                    .
                  </p>

                  <h5 className="font-semibold">Can I Cancel Before It Ships?</h5>
                  <p>
                    Yes! Orders canceled before shipment will receive a{" "}
                    <strong>full refund</strong>. Due to quick processing times,
                    reach out as soon as possible to request a cancellation.
                  </p>
                </div>

                <div className="w-full pad:w-1/2 space-y-2">
                  <h5 className="font-semibold">What If My Order Has Already Shipped?</h5>
                  <p>
                    If you received a shipping confirmation email, your order is
                    already on its way and can’t be canceled. Once the item
                    arrives, you may <strong>return it for a full refund</strong>{" "}
                    in accordance with our return policy.
                  </p>
                </div>
              </div>
            </PortalMenu>
          </div>

          {/* How to Find Your Model Number */}
          <div
            className="relative inline-block"
            onMouseEnter={() => openWithDelay("model")}
          >
            <button className="flex items-center gap-2">
              <Menu className="w-5 h-5" /> How to Find Your Model Number
            </button>
            <PortalMenu open={hoverKey === "model"} onClose={closeNow} title="How to Find Your Model Number">
              <div className="flex flex-col pad:flex-row gap-6">
                <div className="w-full pad:w-1/2 space-y-2">
                  <h5 className="font-semibold">Where to Look</h5>
                  <p>
                    Your appliance’s model number is on its serial tag, which
                    lists both the model and serial numbers. The tag’s location
                    varies by appliance type and brand.
                  </p>

                  <h6 className="font-semibold mt-2">Washing Machines</h6>
                  <ul className="list-disc pl-5">
                    <li>
                      <strong>Front Load:</strong> Inside the door frame.
                    </li>
                    <li>
                      <strong>Top Load:</strong> Under the lid at the back,
                      bottom front left of the cabinet, side panels, or back of
                      the console (use a mirror if needed).
                    </li>
                  </ul>

                  <h6 className="font-semibold mt-2">Dryers</h6>
                  <ul className="list-disc pl-5">
                    <li>Behind the door on the dryer frame.</li>
                  </ul>

                  <h6 className="font-semibold mt-2">Ranges &amp; Ovens</h6>
                  <ul className="list-disc pl-5">
                    <li>
                      <strong>Freestanding:</strong> On the oven frame behind
                      the oven door or pull-out drawer.
                    </li>
                    <li>
                      <strong>Slide-In:</strong> Behind the oven door, bottom
                      right side of the cabinet, or behind the pull-out drawer.
                    </li>
                    <li>
                      <strong>Built-In Wall Ovens:</strong> On the frame behind
                      the oven door; some models place it on the casing (may
                      require removal from the wall).
                    </li>
                    <li>
                      <strong>Cooktops:</strong> Underneath or on the sides of
                      the metal cabinet.
                    </li>
                  </ul>
                </div>

                <div className="w-full pad:w-1/2 space-y-2">
                  <h6 className="font-semibold">Refrigerators &amp; Freezers</h6>
                  <ul className="list-disc pl-5">
                    <li>Inside the refrigerator section on inner walls.</li>
                    <li>Behind the kick panel at the bottom.</li>
                    <li>
                      <strong>Chest Freezers:</strong> On the front bottom or
                      side of the cabinet.
                    </li>
                  </ul>

                  <h6 className="font-semibold mt-2">Microwaves</h6>
                  <ul className="list-disc pl-5">
                    <li>Inside the microwave on the left wall.</li>
                    <li>Outside casing: Bottom side.</li>
                    <li>
                      <strong>Over-the-range:</strong> Underneath towards the
                      back.
                    </li>
                  </ul>

                  <h6 className="font-semibold mt-2">Dishwashers</h6>
                  <ul className="list-disc pl-5">
                    <li>
                      Inside the door on the left or right front edge, or on the
                      side of the door.
                    </li>
                  </ul>
                </div>
              </div>
            </PortalMenu>
          </div>

          {/* CART BUTTON (desktop) */}
          <button
            onClick={() => navigate("/cart")}
            className="relative flex items-center gap-2 rounded border border-white/20 bg-white/0 hover:bg-white/10 px-3 py-1.5 text-white"
          >
            <ShoppingCart className="w-5 h-5 text-white" />
            <span>Cart</span>
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-[1.3rem] text-[11px] font-bold bg-blue-600 text-white rounded">
              {cartCount}
            </span>
          </button>
        </div>
      </nav>

      {/* MOBILE NAV */}
      <div className="pad:hidden flex items-center justify-end w-full">
        {/* Cart button mobile */}
        <button
          onClick={() => navigate("/cart")}
          className="mr-2 flex items-center gap-2 rounded border border-white/20 bg-white/0 hover:bg-white/10 px-3 py-2 text-white text-sm font-semibold"
        >
          <ShoppingCart className="w-5 h-5 text-white" />
          <span className="text-white text-xs bg-blue-600 rounded px-1.5 py-0.5 font-bold leading-none">
            {cartCount}
          </span>
        </button>

        {/* Hamburger */}
        <button
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 text-white px-3 py-2 rounded border border-white/20"
        >
          <Menu className="w-5 h-5" /> Menu
        </button>

        {mobileOpen && (
          <div className="fixed inset-0 z-[60]">
            {/* dimmer */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileOpen(false)}
            />
            {/* sheet */}
            <div className="absolute top-0 left-0 right-0 bg-[#001F3F] text-white max-h=[90vh] overflow-y-auto shadow-xl">
              {/* sheet header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="font-semibold">Menu</div>
                <button onClick={() => setMobileOpen(false)} aria-label="Close">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* accordions */}
              <div className="divide-y divide-white/10">
                {[
                  {
                    key: "rare",
                    icon: <Search className="w-4 h-4" />,
                    title: "Rare Part Request",
                    content: (
                      <div className="space-y-3 text-sm text-white/90">
                        {/* Toast/inline status for MOBILE rare form */}
                        {rareStatus && (
                          <FormStatus
                            status={rareStatus}
                            onClose={() => setRareStatus(null)}
                            variant="toast"
                          />
                        )}

                        <p>
                          We see thousands of recovered refrigerators on a daily
                          basis. Reach out to us and we will hunt it down.
                        </p>
                        <form
                          className="space-y-3"
                          onSubmit={(e) =>
                            handleRareSubmit(e, {
                              nameId: "m-name",
                              emailId: "m-email",
                              messageId: "m-message",
                              honeypotId: "m-company",
                            })
                          }
                          aria-busy={rareSubmitting}
                        >
                          {/* Honeypot */}
                          <input
                            type="text"
                            id="m-company"
                            name="company"
                            className="hidden"
                            tabIndex={-1}
                            autoComplete="off"
                          />
                          <div className="flex flex-col">
                            <label htmlFor="m-name" className="font-medium">
                              Your Name
                            </label>
                            <input
                              id="m-name"
                              name="name"
                              type="text"
                              required
                              autoComplete="name"
                              disabled={rareSubmitting}
                              className="border p-2 rounded text-black"
                            />
                          </div>

                          <div className="flex flex-col">
                            <label htmlFor="m-email" className="font-medium">
                              Your Email
                            </label>
                            <input
                              id="m-email"
                              name="email"
                              type="email"
                              required
                              autoComplete="email"
                              disabled={rareSubmitting}
                              className="border p-2 rounded text-black"
                            />
                          </div>

                          <div className="flex flex-col">
                            <label htmlFor="m-message" className="font-medium">
                              What part are you looking for?
                            </label>
                            <textarea
                              id="m-message"
                              name="message"
                              rows={4}
                              required
                              disabled={rareSubmitting}
                              className="border p-2 rounded text-black"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={rareSubmitting}
                            className="bg-blue-600 text-white px-4 py-2 rounded w-full disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                          >
                            {rareSubmitting && (
                              <span className="inline-block h-4 w-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                            )}
                            {rareSubmitting ? "Sending…" : "Submit Request"}
                          </button>
                        </form>
                      </div>
                    ),
                  },
                  {
                    key: "ship",
                    icon: <Truck className="w-4 h-4" />,
                    title: "Shipping Policy",
                    content: (
                      <div className="space-y-2 text-sm text-white/90">
                        <p>
                          Orders are processed and shipped within{" "}
                          <strong>one business day</strong>. Orders before
                          cutoff ship the <strong>same day</strong>; after
                          cutoff ship the <strong>next business day</strong>.
                        </p>
                        <p>
                          For help with tracking, email{" "}
                          <a className="underline" href="mailto:support@appliancepartgeeks.com">
                            support@appliancepartgeeks.com
                          </a>
                          .
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>
                            <strong>Address Changes:</strong> Not possible after
                            placing the order.
                          </li>
                          <li>
                            <strong>Undeliverable Packages:</strong> Buyer
                            covers any reship costs.
                          </li>
                          <li>
                            <strong>International:</strong> Duties/taxes may
                            apply; delivery times vary.
                          </li>
                        </ul>
                      </div>
                    ),
                  },
                  {
                    key: "return",
                    icon: <Undo2 className="w-4 h-4" />,
                    title: "Our Return Policy",
                    content: (
                      <div className="space-y-2 text-sm text-white/90">
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Initiate within <strong>30 days</strong> of delivery.</li>
                          <li>Items must be <strong>unused/unmodified</strong> in original condition.</li>
                          <li><strong>RAN required</strong> before returning any item.</li>
                          <li>“For Parts Only”, installed, altered, or incomplete items are non-returnable.</li>
                        </ul>
                        <p>
                          Start a return:{" "}
                          <a className="underline" href="mailto:returns@appliancepartgeeks.com">
                            returns@appliancepartgeeks.com
                          </a>
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "cancel",
                    icon: <Repeat className="w-4 h-4" />,
                    title: "Cancellation Policy",
                    content: (
                      <div className="space-y-2 text-sm text-white/90">
                        <p>
                          Need to cancel? Email{" "}
                          <a className="underline" href="mailto:support@appliancepartgeeks.com">
                            support@appliancepartgeeks.com
                          </a>{" "}
                          immediately.
                        </p>
                        <p><strong>Before shipping:</strong> full refund.</p>
                        <p><strong>After shipping:</strong> cannot cancel; you may return after delivery for a refund.</p>
                      </div>
                    ),
                  },
                  {
                    key: "model",
                    icon: <Menu className="w-4 h-4" />,
                    title: "How to Find Your Model Number",
                    content: (
                      <div className="space-y-2 text-sm text-white/90">
                        <p>
                          Your appliance’s model number is on its serial tag
                          (lists model + serial). Location varies by appliance.
                        </p>

                        <p className="font-semibold">Washing Machines</p>
                        <ul className="list-disc pl-5">
                          <li><strong>Front Load:</strong> Inside the door frame.</li>
                          <li><strong>Top Load:</strong> Under lid (back), bottom front left of cabinet, side panels, or back of console.</li>
                        </ul>

                        <p className="font-semibold mt-2">Dryers</p>
                        <ul className="list-disc pl-5">
                          <li>Behind the door on the dryer frame.</li>
                        </ul>

                        <p className="font-semibold mt-2">Ranges &amp; Ovens</p>
                        <ul className="list-disc pl-5">
                          <li><strong>Freestanding:</strong> Oven frame behind door or pull-out drawer.</li>
                          <li><strong>Slide-In:</strong> Behind door, bottom-right of cabinet, or behind drawer.</li>
                          <li><strong>Wall Ovens:</strong> Frame behind door; sometimes on casing.</li>
                          <li><strong>Cooktops:</strong> Underneath or on cabinet sides.</li>
                        </ul>

                        <p className="font-semibold mt-2">Refrigerators &amp; Freezers</p>
                        <ul className="list-disc pl-5">
                          <li>Inside fridge on inner walls.</li>
                          <li>Behind the kick panel at the bottom.</li>
                          <li><strong>Chest Freezers:</strong> Front bottom or side of cabinet.</li>
                        </ul>

                        <p className="font-semibold mt-2">Microwaves</p>
                        <ul className="list-disc pl-5">
                          <li>Inside the microwave on the left wall.</li>
                          <li>Outside casing: bottom side.</li>
                          <li><strong>Over-the-range:</strong> Underneath toward the back.</li>
                        </ul>

                        <p className="font-semibold mt-2">Dishwashers</p>
                        <ul className="list-disc pl-5">
                          <li>Inside the door on the left/right front edge, or on the door side.</li>
                        </ul>
                      </div>
                    ),
                  },
                ].map(({ key, icon, title, content }) => (
                  <section key={key}>
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                      onClick={() => toggleMobile(key)}
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        {icon} {title}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 transition-transform ${openMobileKey === key ? "rotate-180" : ""}`}
                      />
                    </button>

                    <div
                      className={`px-4 pb-4 transition-[max-height,opacity] duration-300 ease-out ${
                        openMobileKey === key ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"
                      }`}
                    >
                      {content}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
