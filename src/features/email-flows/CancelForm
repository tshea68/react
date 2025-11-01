import React from "react";
import useEmailSubmit from "../../lib/useEmailSubmit";
import FormStatus from "../../components/FormStatus";

/**
 * CancelForm
 * Fields: name, email, orderNumber, message
 */
export default function CancelForm({ idPrefix = "cancel", className = "" }) {
  const { status, loading, submit, clear } = useEmailSubmit("cancel");

  async function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ok = await submit({
      name: fd.get("name")?.toString().trim(),
      email: fd.get("email")?.toString().trim(),
      orderNumber: fd.get("orderNumber")?.toString().trim(),
      message: fd.get("message")?.toString().trim(),
    });
    if (ok) e.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit} className={`space-y-3 ${className}`}>
      {status && <FormStatus status={status} onClose={clear} />}

      <div className="flex flex-col">
        <label htmlFor={`${idPrefix}-name`} className="font-medium">Your Name</label>
        <input
          id={`${idPrefix}-name`}
          name="name"
          type="text"
          required
          autoComplete="name"
          className="border p-2 rounded text-black"
        />
      </div>

      <div className="flex flex-col">
        <label htmlFor={`${idPrefix}-email`} className="font-medium">Your Email</label>
        <input
          id={`${idPrefix}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          className="border p-2 rounded text-black"
        />
      </div>

      <div className="flex flex-col">
        <label htmlFor={`${idPrefix}-order`} className="font-medium">Order #</label>
        <input
          id={`${idPrefix}-order`}
          name="orderNumber"
          type="text"
          required
          className="border p-2 rounded text-black"
        />
      </div>

      <div className="flex flex-col">
        <label htmlFor={`${idPrefix}-message`} className="font-medium">
          Notes (optional)
        </label>
        <textarea
          id={`${idPrefix}-message`}
          name="message"
          rows={4}
          className="border p-2 rounded text-black"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Submitting…" : "Submit Cancellation"}
      </button>
    </form>
  );
}

