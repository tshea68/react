// src/components/HeaderMenu.jsx
import React, { useState } from "react";
import { Truck, Search, Undo2, Repeat, Menu, X, ChevronDown } from "lucide-react";

export default function HeaderMenu() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [open, setOpen] = useState(null); // which accordion is open on mobile

  const toggle = (key) => setOpen((cur) => (cur === key ? null : key));

  return (
    <>
      {/* DESKTOP/TABLET (>= pad) — hover dropdowns, same copy, responsive panels */}
      <nav className="hidden pad:flex flex-col justify-end pb-2">
        <div
          className="flex justify-center space-x-10
                     text-[clamp(10px,1.15vw,16px)]
                     font-semibold text-white relative z-40 pb-2"
        >
          {/* Rare Part Request */}
          <div className="group relative inline-block">
            <button className="flex items-center gap-2">
              <Search className="w-5 h-5" /> Rare Part Request
            </button>
            <div className="fixed left-1/2 -translate-x-1/2 top-[5rem]
                            pointer-events-none group-hover:pointer-events-auto
                            opacity-0 group-hover:opacity-100
                            transform group-hover:translate-y-2 group-hover:-translate-y-0
                            transition-all duration-300 ease-out
                            group-hover:flex flex-row gap-6
                            bg-white text-black border p-3 pad:p-4
                            w-[min(90vw,64rem)] max-h-[75vh] overflow-y-auto
                            text-sm shadow-lg rounded z-50">
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
          </div>

          {/* We Ship Same Day */}
          <div className="group relative inline-block">
            <button className="flex items-center gap-2">
              <Truck className="w-5 h-5" /> We Ship Same Day
            </button>
            <div className="fixed left-1/2 -translate-x-1/2 top-[5rem]
                            pointer-events-none group-hover:pointer-events-auto
                            opacity-0 group-hover:opacity-100
                            transform group-hover:translate-y-2 group-hover:-translate-y-0
                            transition-all duration-300 ease-out
                            group-hover:flex flex-row gap-6
                            bg-white text-black border p-3 pad:p-4
                            w-[min(90vw,64rem)] max-h-[75vh] overflow-y-auto
                            text-sm shadow-lg rounded z-50">
              <div className="w-full pad:w-1/3 space-y-2">
                <h5>Fast &amp; Reliable Shipping</h5>
                <p>
                  At <strong>A-Z Appliance Parts</strong>, we prioritize fast and efficient shipping. All orders are processed and shipped within <strong>one business day</strong>.
                </p>
                <p>Orders placed before our daily cutoff ship the <strong>same day</strong>. Orders after that ship the <strong>next business day</strong>.</p>
                <h5>Tracking &amp; Delivery</h5>
                <p>Once your order ships, you’ll get tracking via email. Delivery time depends on the method chosen.</p>
                <h5>Lost or Delayed Shipments</h5>
                <p>
                  Contact the carrier with your tracking number. Still need help? Email{" "}
                  <a className="custom-link" href="mailto:support@appliancepartgeeks.com">support@appliancepartgeeks.com</a>
                </p>
              </div>
              <div className="w-full pad:w-1/3 space-y-2">
                <h5>Shipping Address Accuracy</h5>
                <p>Double-check your address before submitting payment. We <strong>can only ship</strong> to the address you provide.</p>
                <ul className="list-disc pl-5">
                  <li><strong>Address Changes:</strong> Not possible after the order is placed.</li>
                  <li><strong>Undeliverable Packages:</strong> Buyer pays any reship costs.</li>
                </ul>
                <h5>Shipping Carriers &amp; Methods</h5>
                <ul className="list-disc pl-5">
                  <li><strong>Domestic:</strong> Standard and expedited available.</li>
                  <li><strong>International:</strong> Customs and duties may apply.</li>
                </ul>
              </div>
              <div className="w-full pad:w-1/3 space-y-2">
                <h5>International Customers</h5>
                <p><strong>Effective: March 18, 2025</strong></p>
                <p>We ship worldwide, but read below first:</p>
                <h6>Shipping Costs</h6>
                <p>If extra fees apply, we’ll notify you. No reply = cancellation.</p>
                <h6>Customs &amp; Duties</h6>
                <p>Customer is responsible for all taxes and tariffs.</p>
                <h6>Refused Deliveries</h6>
                <p>If you refuse to pay customs, the carrier will dispose of your order. No refund.</p>
                <h6>Feasibility</h6>
                <p>If shipping is disproportionately high, we may reach out before fulfillment.</p>
              </div>
            </div>
          </div>

          {/* Return Policy */}
          <div className="group relative inline-block">
            <button className="flex items-center gap-2">
              <Undo2 className="w-5 h-5" /> Return Policy
            </button>
            <div className="fixed left-1/2 -translate-x-1/2 top-[5rem]
                            pointer-events-none group-hover:pointer-events-auto
                            opacity-0 group-hover:opacity-100
                            transform group-hover:translate-y-2 group-hover:-translate-y-0
                            transition-all duration-300 ease-out
                            group-hover:flex flex-row gap-6
                            bg-white text-black border p-3 pad:p-4
                            w-[min(90vw,64rem)] max-h-[75vh] overflow-y-auto
                            text-sm shadow-lg rounded z-50">
              <div className="w-full pad:w-1/3 space-y-2">
                <h5>Return Eligibility</h5>
                <ul className="list-disc pl-5">
                  <li>Must initiate within <strong>30 days</strong></li>
                  <li>Item must be <strong>unused and unmodified</strong></li>
                  <li>Return Authorization (RAN) is required</li>
                </ul>
                <h5>Non-Returnable Items</h5>
                <ul className="list-disc pl-5">
                  <li>“For Parts Only” / “As-Is” items</li>
                  <li>Installed, damaged, or altered parts</li>
                  <li>Missing packaging or components</li>
                </ul>
              </div>
              <div className="w-full pad:w-1/3 space-y-2">
                <h5>How to Initiate a Return</h5>
                <ol className="list-decimal pl-5">
                  <li>Email <a className="custom-link" href="mailto:returns@appliancepartgeeks.com">returns@appliancepartgeeks.com</a> with your order number</li>
                  <li>Include your name, order date, reason, and photos (if applicable)</li>
                  <li>We’ll respond in <strong>3 business days</strong></li>
                </ol>
              </div>
              <div className="w-full pad:w-1/3 space-y-2">
                <h5>Refunds &amp; Processing</h5>
                <ul className="list-disc pl-5">
                  <li>If it’s our fault, we pay return shipping</li>
                  <li>If not, you cover return shipping</li>
                  <li>Refunds in <strong>5–7 business days</strong> after inspection</li>
                  <li>Refund to original payment method</li>
                  <li>Shipping costs are non-refundable</li>
                </ul>
                <h5>Right to Refuse</h5>
                <p>We may reject returns that violate policy or appear fraudulent.</p>
              </div>
            </div>
          </div>

          {/* Changing Orders */}
          <div className="group relative inline-block">
            <button className="flex items-center gap-2">
              <Repeat className="w-5 h-5" /> Changing Orders
            </button>
            <div className="fixed left-1/2 -translate-x-1/2 top-[5rem]
                            pointer-events-none group-hover:pointer-events-auto
                            opacity-0 group-hover:opacity-100
                            transform group-hover:translate-y-2 group-hover:-translate-y-0
                            transition-all duration-300 ease-out
                            group-hover:flex flex-row gap-6
                            bg-white text-black border p-3 pad:p-4
                            w-[min(90vw,64rem)] max-h-[75vh] overflow-y-auto
                            text-sm shadow-lg rounded z-50">
              <div className="w-full pad:w-1/3 space-y-2">
                <p>
                  Appliance repairs are time-sensitive. We ship fast. To cancel or change an order, contact us immediately at{" "}
                  <a href="mailto:support@a-zapplianceparts.com">support@a-zapplianceparts.com</a>.
                </p>
              </div>
              <div className="w-full pad:w-1/3 space-y-2">
                <h5>Cancel Before Shipping</h5>
                <p>
                  Yes — if we haven’t shipped your order, we’ll cancel it and issue a <strong>full refund</strong>. But contact us quickly!
                </p>
              </div>
              <div className="w-full pad:w-1/3 space-y-2">
                <h5>Already Shipped?</h5>
                <p>
                  If your order has already shipped, we cannot cancel. You may still <strong>return it</strong> for a refund after delivery.
                </p>
              </div>
            </div>
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
                {/* Item helper */}
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
                    title: "We Ship Same Day",
                    content: (
                      <div className="space-y-2 text-sm text-white/90">
                        <p>
                          Orders placed before our daily cutoff ship the <strong>same day</strong>. Orders after that ship the <strong>next business day</strong>.
                        </p>
                        <p>
                          For help with tracking, email{" "}
                          <a className="underline" href="mailto:support@appliancepartgeeks.com">support@appliancepartgeeks.com</a>.
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li><strong>Address Changes:</strong> Not possible after the order is placed.</li>
                          <li><strong>Undeliverable Packages:</strong> Buyer pays any reship costs.</li>
                        </ul>
                      </div>
                    ),
                  },
                  {
                    key: "return",
                    icon: <Undo2 className="w-4 h-4" />,
                    title: "Return Policy",
                    content: (
                      <div className="space-y-2 text-sm text-white/90">
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Initiate within <strong>30 days</strong></li>
                          <li>Item must be <strong>unused and unmodified</strong></li>
                          <li>RAN is required</li>
                          <li>“For Parts Only” / installed / altered / incomplete items are non-returnable</li>
                        </ul>
                      </div>
                    ),
                  },
                  {
                    key: "change",
                    icon: <Repeat className="w-4 h-4" />,
                    title: "Changing Orders",
                    content: (
                      <div className="space-y-2 text-sm text-white/90">
                        <p>
                          To cancel or change an order quickly, email{" "}
                          <a className="underline" href="mailto:support@a-zapplianceparts.com">support@a-zapplianceparts.com</a>.
                        </p>
                        <p><strong>Before shipping:</strong> we can cancel and refund in full.</p>
                        <p><strong>After shipping:</strong> cannot cancel; you may return after delivery.</p>
                      </div>
                    ),
                  },
                ].map(({ key, icon, title, content }) => (
                  <section key={key}>
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                      onClick={() => toggle(key)}
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        {icon} {title}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 transition-transform ${open === key ? "rotate-180" : ""}`}
                      />
                    </button>
                    <div
                      className={`px-4 pb-4 transition-[max-height,opacity] duration-300 ease-out
                                  ${open === key ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"}`}
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
