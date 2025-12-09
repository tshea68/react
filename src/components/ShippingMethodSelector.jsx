// src/components/ShippingMethodSelector.jsx
import React from "react";

const OEM_OPTIONS = [
  {
    key: "GROUND",
    label: "Standard Ground (3–7 business days)",
    surchargeCents: 0,
  },
  {
    key: "2DAY",
    label: "2-Day Shipping",
    surchargeCents: 0, // we'll decide real pricing later
  },
  {
    key: "NEXTDAY",
    label: "Next-Day Shipping",
    surchargeCents: 0, // we can tune this later
  },
];

const REFURB_OPTIONS = [
  {
    key: "REFURB_GROUND",
    label: "Free Ground (3–7 business days)",
    surchargeCents: 0,
  },
  {
    key: "REFURB_NEXTDAY",
    label: "Next Business Day (+$30.00)",
    surchargeCents: 3000,
  },
];

export default function ShippingMethodSelector({
  cartItems,
  value,
  onChange,
}) {
  const hasRefurb = (cartItems || []).some((i) => i?.is_refurb);
  const options = hasRefurb ? REFURB_OPTIONS : OEM_OPTIONS;

  const handleChange = (e) => {
    const key = e.target.value;
    const opt = options.find((o) => o.key === key);
    if (!opt) return;
    onChange({
      key: opt.key,
      label: opt.label,
      surchargeCents: opt.surchargeCents,
    });
  };

  const selectedKey = value?.key || options[0].key;

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="font-semibold text-sm">Shipping method</div>
      <div className="space-y-1">
        {options.map((opt) => (
          <label key={opt.key} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="shipping_method"
              value={opt.key}
              checked={selectedKey === opt.key}
              onChange={handleChange}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
