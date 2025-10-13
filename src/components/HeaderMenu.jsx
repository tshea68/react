// src/components/HeaderMenu.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Truck, Search, Undo2, Repeat, Menu, X, ChevronDown } from "lucide-react";

/* ─────────────────────────────
   Portal for desktop dropdowns
   ───────────────────────────── */
function PortalMenu({ open, onClose, children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);
  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* click-outside layer */}
      <div
        className="absolute inset-0"
        onMouseEnter={onClose}
        onClick={onClose}
      />
      <div
        className="pointer-events-auto fixed left-1/2 -translate-x-1/2 top-[5rem]
                   bg-white text-black border p-3 pad:p-4
                   w-[min(90vw,64rem)] max-h-[75vh] overflow-y-auto
                   text-sm shadow-lg rounded z-[61]"
        onMouseLeave={onClose}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export default function HeaderMenu() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMobileKey, setOpenMobileKey] = useState(null); // which accordion is open on mobile
  const [hoverKey, setHoverKey] = useState(null); // which desktop dropdown is open

  // tiny hover delay for stability
  const hoverTimer = useRef(null);
  const openWithDelay = (key) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoverKey(key), 60);
  };
  const closeWithDelay = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoverKey(null), 80);
  };

  const toggleMobile = (key) =>
    setOpenMobileKey((cur) => (cur === key ? null : key));

  return (
    <>
      {/* DESKTOP/TABLET (>= pad) — hover dropdowns via portal */}
      <nav className="hidden pad:flex flex-col justify-end pb-2">
        <div
          className="flex justify-center space-x-10
                     text-[clamp(10px,1.15vw,14px)]
                     lap:text-xs
                     desk:text-[clamp(10px,1.15vw,14px)]
                     font-semibold text-white relative z-40 pb-2"
        >
          {/* Rare Part Request */}
          <div
            className="relative inline-block"
            onMouseEnter={() => openWithDelay("rare")}
            onMouseLeave={closeWithDelay}
          >
            <button className="flex items-center gap-2">
              <Search className="w-5 h-5" /> Rare Part Request
            </button>
            <PortalMenu open={hoverKey === "rare"} onClose={() => setHoverKey(null)}>
              <div className="flex flex-col pad:flex-row gap-6">
                <div className="w-full pad:w-1/2 space-y-4">
                  <h2 className="text-xl font-bold">Still Looking For That Rare Part?</h2>
                  <ul className="list-disc pl-5">
                    <li>Need a hard-to-find handle?</li>
                    <li>Can’t find that switch or dial?</li>
                    <li>Old ice maker needs to be replaced?</li>
                  </ul>
                  <p>
                    We see thousands of recovered refrigerators on a daily basis. Reach out to us and we will hunt it down.
                  </p>
                </div>
                <div className="w-full pad:w-1/2 space-y-3">
                  <form
                    className="space-y-3"
                    method="POST"
                    action="mailto:support@appliancepartgeeks.com"
                    encType="text/plain"
                  >
                    <div className="flex flex-col">
                      <label htmlFor="name" className="font-medium">Your Name</label>
                      <input type="text" name="name" id="name" required className="border p-2 rounded" />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="email" className="font-medium">Your Email</label>
                      <input type="email" name="email" id="email" required className="border p-2 rounded" />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="message" className="font-medium">What part are you looking for?</label>
                      <textarea name="message" id="message" rows="4" required className="border p-2 rounded"></textarea>
                    </div>
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                      Submit Request
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
            onMouseLeave={closeWithDelay}
          >
            <button className="flex items-center gap-2">
              <Truck className="w-5 h-5" /> Shipping Policy
            </button>
            <PortalMenu open={hoverKey === "ship"} onClose={() => setHoverKey(null)}>
              <div className="flex flex-col pad:flex-row gap-6">
                <div className="w-full pad:w-1/3 space-y-2">
                  <h5 className="font-semibold">Fast &amp; Reliable Shipping</h5>
                  <p>
                    At <strong>Appliance Part Geeks</strong>, we prioritize fast and efficient shipping to ensure you receive your order as quickly as possible. All orders are processed and shipped within <strong>one business day</strong>.
                  </p>
                  <p>Orders placed before our daily shipping cutoff time will be shipped the <strong>same business day</strong>. Orders placed after the cutoff time will be shipped the <strong>next business day</strong>.</p>
                  <h5 className="font-semibold">Tracking &amp; Delivery</h5>
                  <p>Once your order has shipped, you will receive a tracking number via email. Delivery times vary based on the shipping method selected at checkout.</p>
                </div>
                <div className="w-full pad:w-1/3 space-y-2">
                  <h5 className="font-semibold">Shipping Address Accuracy</h5>
                  <p>Please double-check your shipping address before submitting payment. We can only ship to the address provided at checkout.</p>
                  <ul className="list-disc pl-5">
                    <li><strong>Address Changes:</strong> Once an order has been placed, we are unable to modify the shipping address.</li>
                    <li><strong>Undeliverable Packages:</strong> If an order is returned due to an incorrect or incomplete address, the buyer will be responsible for any additional shipping costs.</li>
                  </ul>
                  <h5 className="font-semibold">Shipping Carriers &amp; Methods</h5>
                  <ul className="list-disc pl-5">
                    <li><strong>Domestic Shipping:</strong> Standard and expedited shipping options are available at checkout.</li>
                    <li><strong>International Shipping:</strong> Availability depends on the destination country. Additional customs duties or taxes may apply.</li>
                  </ul>
                  <h5 className="font-semibold">Lost or Delayed Shipments</h5>
                  <p>
                    If your package is delayed or lost in transit, please contact the carrier first using your tracking number. If further assistance is needed, email{" "}
                    <a className="custom-link" href="mailto:support@appliancepartgeeks.com">support@appliancepartgeeks.com</a>.
                  </p>
                </div>
                <div className="w-full pad:w-1/3 space-y-2">
                  <h5 className="font-semibold">International Customers – Please Read</h5>
                  <p><strong>Effective: March 18, 2025</strong></p>
                  <p>This policy applies only to international orders—any orders shipped outside the United States, including Canada, Mexico, and other countries.</p>
                  <h6 className="font-semibold">Shipping Costs</h6>
                  <p>Some international orders may require additional shipping fees. If additional fees apply, we will contact you. If we do not receive a response within 2 days, the order may be canceled and refunded.</p>
                  <h6 className="font-semibold">Customs &amp; Duties</h6>
                  <p>The receiver is responsible for all duties, tariffs, and taxes. We do not collect these at checkout. We will never undervalue a shipment or mark it as a gift.</p>
                  <h6 className="font-semibold">Refused Deliveries &amp; No Refunds</h6>
                  <p>If duties/tariffs are refused, we will instruct the carrier to dispose of the shipment. No refund will be issued.</p>
                  <h6 className="font-semibold">Delivery Times &amp; Customs Delays</h6>
                  <p>International shipping times vary; customs clearance may cause delays beyond our control.</p>
                  <h6 className="font-semibold">Order Feasibility</h6>
                  <p>For low-value items with disproportionately high shipping, we may reach out to discuss options before proceeding.</p>
                  <p className="text-xs italic">By placing an order with Appliance Part Geeks, you agree to these terms.</p>
                </div>
              </div>
            </PortalMenu>
          </div>

          {/* Our Return Policy */}
          <div
            className="relative inline-block"
            onMouseEnter={() => openWithDelay("return")}
            onMouseLeave={closeWithDelay}
          >
            <button className="flex items-center gap-2">
              <Undo2 className="w-5 h-5" /> Our Return Policy
            </button>
            <PortalMenu open={hoverKey === "return"} onClose={() => setHoverKey(null)}>
              <div className="flex flex-col pad:flex-row gap-6">
                <div className="w-full pad:w-1/3 space-y-2">
                  <h5 className="font-semibold">Return Eligibility</h5>
                  <ul className="list-disc pl-5">
                    <li><strong>Return Window:</strong> Initiate within <strong>30 days</strong> of delivery.</li>
                    <li><strong>Condition:</strong> Items must be unused, unmodified, and in original condition with all packaging, labels, and components.</li>
                    <li><strong>RAN Required:</strong> A Return Authorization Number must be obtained before returning any item. Returns without an approved RAN will be refused.</li>
                  </ul>
                  <h5 className="font-semibold">Non-Returnable Items</h5>
                  <ul className="list-disc pl-5">
                    <li>“For Parts Only” or “As-Is” items.</li>
                    <li>Installed, modified, or damaged items due to improper installation/handling.</li>
                    <li>Items missing essential components or original packaging (may be refused or incur a restocking fee).</li>
                  </ul>
                </div>
                <div className="w-full pad:w-1/3 space-y-2">
                  <h5 className="font-semibold">How to Initiate a Return</h5>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Email <a className="custom-link" href="mailto:returns@appliancepartgeeks.com">returns@appliancepartgeeks.com</a> with your order number in the subject line.</li>
                    <li>Include your full name, order date, reason for return, and photos (if applicable).</li>
                    <li>Our team will review your request within <strong>3 business days</strong> and provide return instructions.</li>
                  </ol>
                  <h5 className="font-semibold">Shipping &amp; Return Process</h5>
                  <ul className="list-disc pl-5">
                    <li>If <strong>our error</strong> (wrong/defective item), we cover return shipping.</li>
                    <li>If <strong>customer error</strong> (wrong item, changed mind), customer covers return shipping.</li>
                    <li>Items must be securely packed to prevent transit damage and include the issued RAN on the package.</li>
                  </ul>
                </div>
                <div className="w-full pad:w-1/3 space-y-2">
                  <h5 className="font-semibold">Refunds &amp; Processing</h5>
                  <ul className="list-disc pl-5">
                    <li>Refunds issued within <strong>5–7 business days</strong> after item is received and inspected.</li>
                    <li>Refunds credited to the original payment method.</li>
                    <li>Shipping fees are non-refundable unless the return is due to our error.</li>
                  </ul>
                  <h5 className="font-semibold">Right to Refuse</h5>
                  <p>Appliance Part Geeks reserves the right to refuse any return that does not meet our policy guidelines or is deemed fraudulent.</p>
                  <p className="text-sm">Need help? Email <a className="custom-link" href="mailto:returns@appliancepartgeeks.com">returns@appliancepartgeeks.com</a>.</p>
                </div>
              </div>
            </PortalMenu>
          </div>

          {/* Cancellation Policy */}
          <div
            className="relative inline-block"
            onMouseEnter={() => openWithDelay("cancel")}
            onMouseLeave={closeWithDelay}
          >
            <button className="flex items-center gap-2">
              <Repeat className="w-5 h-5" /> Cancellation Policy
            </button>
            <PortalMenu open={hoverKey === "cancel"} onClose={() => setHoverKey(null)}>
              <div className="flex flex-col pad:flex-row gap-6">
                <div className="w-full pad:w-1/2 space-y-2">
                  <h5 className="font-semibold">Need to Cancel Your Order?</h5>
                  <p>
                    Appliance repairs are time-sensitive, and at Appliance Part Geeks, we prioritize fast and efficient shipping. If you need to cancel your order, please contact us immediately at{" "}
                    <a className="custom-link" href="mailto:support@appliancepartgeeks.com">support@appliancepartgeeks.com</a>.
                  </p>
                  <h5 className="font-semibold">Can I Cancel Before It Ships?</h5>
                  <p>
                    Yes! Orders canceled before shipment will receive a <strong>full refund</strong>. Due to quick processing times, reach out as soon as possible to request a cancellation.
                  </p>
                </div>
                <div className="w-full pad:w-1/2 space-y-2">
                  <h5 className="font-semibold">What If My Order Has Already Shipped?</h5>
                  <p>
                    If you received a shipping confirmation email, your order is already on its way and can’t be canceled. Once the item arrives, you may <strong>return it for a full refund</strong> in accordance with our return policy.
                  </p>
                </div>
              </div>
            </PortalMenu>
          </div>

          {/* How to Find Your Model Number */}
          <div
            className="relative inline-block"
            onMouseEnter={() => openWithDelay("model")}
            onMouseLeave={closeWithDelay}
          >
            <button className="flex items-center gap-2">
              <Menu className="w-5 h-5" /> How to Find Your Model Number
            </button>
            <PortalMenu open={hoverKey === "model"} onClose={() => setHoverKey(null)}>
              <div className="flex flex-col pad:flex-row gap-6">
                <div className="w-full pad:w-1/2 space-y-2">
                  <h5 className="font-semibold">Where to Look</h5>
                  <p>Your appliance’s model number is on its serial tag, which lists both the model and serial numbers. The tag’s location varies by appliance type and brand.</p>
                  <h6 className="font-semibold mt-2">Washing Machines</h6>
                  <ul className="list-disc pl-5">
                    <li><strong>Front Load:</strong> Inside the door frame.</li>
                    <li><strong>Top Load:</strong> Under the lid at the back, bottom front left of the cabinet, side panels, or back of the console (use a mirror if needed).</li>
                  </ul>
                  <h6 className="font-semibold mt-2">Dryers</h6>
                  <ul className="list-disc pl-5">
                    <li>Behind the door on the dryer frame.</li>
                  </ul>
                  <h6 className="font-semibold mt-2">Ranges &amp; Ovens</h6>
                  <ul className="list-disc pl-5">
                    <li><strong>Freestanding:</strong> On the oven frame behind the oven door or pull-out drawer.</li>
                    <li><strong>Slide-In:</strong> Behind the oven door, bottom right side of the cabinet, or behind the pull-out drawer.</li>
                    <li><strong>Built-In Wall Ovens:</strong> On the frame behind the oven door; some models place it on the casing (may require removal from the wall).</li>
                    <li><strong>Cooktops:</strong> Underneath or on the sides of the metal cabinet.</li>
                  </ul>
                </div>
                <div className="w-full pad:w-1/2 space-y-2">
                  <h6 className="font-semibold">Refrigerators &amp; Freezers</h6>
                  <ul className="list-disc pl-5">
                    <li>Inside the refrigerator section on inner walls.</li>
                    <li>Behind the kick panel at the bottom.</li>
                    <li><strong>Chest Freezers:</strong> On the front bottom or side of the cabinet.</li>
                  </ul>
                  <h6 className="font-semibold mt-2">Microwaves</h6>
                  <ul className="list-disc pl-5">
                    <li>Inside the microwave on the left wall.</li>
                    <li>Outside casing: Bottom side.</li>
                    <li><strong>Over-the-range:</strong> Underneath towards the back.</li>
                  </ul>
                  <h6 className="font-semibold mt-2">Dishwashers</h6>
                  <ul className="list-disc pl-5">
                    <li>Inside the door on the left or right front edge, or on the side of the door.</li>
                  </ul>
                </div>
              </div>
            </PortalMenu>
          </div>
        </div>
      </nav>

      {/* MOBILE (< pad) — hamburger + SEPARATE sections (accordions) */}
      <div className="pad:hidden flex items-center justify-end">
        <button
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 text-white px-3 py-2 rounded border border-white/20"
        >
          <Menu className="w-5 h-5" /> Menu
        </button>

        {mobileOpen && (
          <div className="fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <div className="absolute top-0 left-0 right-0 bg-[#001F3F] text-white max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="font-semibold">Menu</div>
                <button onClick={() => setMobileOpen(false)} aria-label="Close">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="divide-y divide-white/10">
                {[
                  {
                    key: "rare",
                    icon: <Search className="w-4 h-4" />,
                    title: "Rare Part Request",
                    content: (
                      <div className="space-y-3 text-sm text-white/90">
                        <p>
                          We see thousands of recovered refrigerators on a daily basis. Reach out to us and we will hunt it down.
                        </p>
                        <form
                          className="space-y-3"
                          method="POST"
                          action="mailto:support@appliancepartgeeks.com"
                          encType="text/plain"
                        >
                          <div className="flex flex-col">
                            <label htmlFor="m-name" className="font-medium">Your Name</label>
                            <input id="m-name" name="name" type="text" required className="border p-2 rounded text-black" />
                          </div>
                          <div className="flex flex-col">
                            <label htmlFor="m-email" className="font-medium">Your Email</label>
                            <input id="m-email" name="email" type="email" required className="border p-2 rounded text-black" />
                          </div>
                          <div className="flex flex-col">
                            <label htmlFor="m-message" className="font-medium">What part are you looking for?</label>
                            <textarea id="m-message" name="message" rows="4" required className="border p-2 rounded text-black"></textarea>
                          </div>
                          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded w-full">Submit Request</button>
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
                          Orders are processed and shipped within <strong>one business day</strong>. Orders before cutoff ship the <strong>same day</strong>; after cutoff ship the <strong>next business day</strong>.
                        </p>
                        <p>
                          For help with tracking, email{" "}
                          <a className="underline" href="mailto:support@appliancepartgeeks.com">support@appliancepartgeeks.com</a>.
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li><strong>Address Changes:</strong> Not possible after placing the order.</li>
                          <li><strong>Undeliverable Packages:</strong> Buyer covers any reship costs.</li>
                          <li><strong>International:</strong> Duties/taxes may apply; delivery times vary.</li>
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
                          Start a return: <a className="underline" href="mailto:returns@appliancepartgeeks.com">returns@appliancepartgeeks.com</a>
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
                          <a className="underline" href="mailto:support@appliancepartgeeks.com">support@appliancepartgeeks.com</a>{" "}
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
                        <p>Your appliance’s model number is on its serial tag (lists model + serial). Location varies by appliance.</p>
                        <p className="font-semibold">Washing Machines</p>
                        <ul className="list-disc pl-5">
                          <li><strong>Front Load:</strong> Inside the door frame.</li>
                          <li><strong>Top Load:</strong> Under lid (back), bottom front left of cabinet, side panels, or back of console (mirror may help).</li>
                        </ul>
                        <p className="font-semibold mt-2">Dryers</p>
                        <ul className="list-disc pl-5">
                          <li>Behind the door on the dryer frame.</li>
                        </ul>
                        <p className="font-semibold mt-2">Ranges &amp; Ovens</p>
                        <ul className="list-disc pl-5">
                          <li><strong>Freestanding:</strong> Oven frame behind oven door or pull-out drawer.</li>
                          <li><strong>Slide-In:</strong> Behind oven door, bottom right of cabinet, or behind pull-out drawer.</li>
                          <li><strong>Built-In Wall Ovens:</strong> Frame behind door; sometimes on casing (may require removal).</li>
                          <li><strong>Cooktops:</strong> Underneath or on sides of metal cabinet.</li>
                        </ul>
                        <p className="font-semibold mt-2">Refrigerators &amp; Freezers</p>
                        <ul className="list-disc pl-5">
                          <li>Inside refrigerator section on inner walls.</li>
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
                      className={`px-4 pb-4 transition-[max-height,opacity] duration-300 ease-out
                                  ${openMobileKey === key ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"}`}
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
