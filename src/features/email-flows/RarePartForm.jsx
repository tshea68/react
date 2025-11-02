// src/features/email-flows/RarePartForm.jsx
import React from "react";
import useEmailSubmit from "../../lib/useEmailSubmit";
import FormStatus from "../../components/FormStatus";

/**
 * RarePartForm
 * Props:
 *  - idPrefix?: string   // unique ids when rendering more than once
 *  - className?: string
 *  - statusVariant?: 'inline' | 'toast' | 'modal'   // default 'toast' so you can see it live
 *  - onSuccess?: () => void   // optional: e.g. close drawer/portal after submit
 */
export default function RarePartForm({
  idPrefix = "rare",
  className = "",
  statusVariant = "toast",
  onSuccess,
}) {
  const { status, loading, submit, clear } = useEmailSubmit("rare");

  async function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ok = await submit({
      name: fd.get("name")?.toString().trim(),
      email: fd.get("email")?.toString().trim(),
      message: fd.get("message")?.toString().trim(),
    });
    if (ok) {
      e.currentTarget.reset();
      // Optional: let parent close the container
      onSuccess?.();
    }
  }

  return (
    <form onSubmit={onSubmit} className={`space-y-3 ${className}`}>
      {/* Acknowledgment UI (toast by default so you can see it live) */}
      {status && (
        <FormStatus status={status} onClose={clear} variant={statusVariant} />
      )}

      <div className="flex flex-col">
        <label htmlFor={`${idPrefix}-name`} className="font-medium">
          Your Name
        </label>
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
        <label htmlFor={`${idPrefix}-email`} className="font-medium">
          Your Email
        </label>
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
        <label htmlFor={`${idPrefix}-message`} className="font-medium">
          What part are you looking for?
        </label>
        <textarea
          id={`${idPrefix}-message`}
          name="message"
          rows={4}
          required
          className="border p-2 rounded text-black"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Sending…" : "Submit Request"}
      </button>
    </form>
  );
}
