// src/components/FormStatus.jsx
import React, { useEffect, useRef } from "react";

/**
 * FormStatus
 * Props:
 *  - status: { type: 'success'|'error'|'info', msg: string } | null
 *  - onClose?: () => void
 *  - className?: string
 *  - autoFocus?: boolean (default true)
 */
export default function FormStatus({ status, onClose, className = "", autoFocus = true }) {
  const ref = useRef(null);

  useEffect(() => {
    if (autoFocus && status && ref.current) {
      // Move focus to the banner so screen readers announce it immediately
      ref.current.focus();
    }
  }, [status, autoFocus]);

  if (!status) return null;

  const kind = status.type || "info";
  const isError = kind === "error";
  const isSuccess = kind === "success";

  const base =
    "w-full rounded-md border px-3 py-2 text-sm flex items-start gap-2 outline-none";
  const tone = isError
    ? "border-red-300 bg-red-50 text-red-800"
    : isSuccess
    ? "border-green-300 bg-green-50 text-green-800"
    : "border-blue-300 bg-blue-50 text-blue-800";

  // a11y roles: errors = alert (assertive), others = status (polite)
  const role = isError ? "alert" : "status";
  const ariaLive = isError ? "assertive" : "polite";

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={role}
      aria-live={ariaLive}
      className={`${base} ${tone} ${className}`}
    >
      <span className="mt-[2px]" aria-hidden="true">
        {isError ? "⚠️" : isSuccess ? "✅" : "ℹ️"}
      </span>
      <div className="flex-1 whitespace-pre-line">{status.msg}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="ml-2 shrink-0 rounded px-2 py-1 text-xs hover:bg-black/5"
          aria-label="Dismiss message"
        >
          ✕
        </button>
      )}
    </div>
  );
}
