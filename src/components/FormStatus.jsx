// src/components/FormStatus.jsx
import React, { useEffect, useRef } from "react";

/**
 * FormStatus
 * Minimal, accessible status message for forms.
 *
 * Props:
 *  - status: { type?: 'success'|'error'|'info', msg: string, sticky?: boolean } | null
 *  - onClose?: () => void
 *  - className?: string          // extra classes for inline variant
 *  - variant?: 'inline'|'toast'|'modal'  (default 'inline')
 *  - duration?: number           // toast auto-dismiss (ms), default 4000
 */
export default function FormStatus({
  status,
  onClose,
  className = "",
  variant = "inline",
  duration = 4000,
}) {
  const ref = useRef(null);
  if (!status) return null;

  const kind = status.type || "info";
  const isError = kind === "error";
  const isSuccess = kind === "success";

  // a11y: inline/modal get focus so SRs announce; toast is polite + auto-dismiss
  useEffect(() => {
    if (variant === "toast") return;
    ref.current?.focus?.();
  }, [variant]);

  useEffect(() => {
    if (variant !== "toast") return;
    if (isError || status.sticky) return; // keep error toasts until closed
    const t = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(t);
  }, [variant, isError, status?.sticky, duration, onClose]);

  const toneInline =
    isError
      ? "border-red-300 bg-red-50 text-red-800"
      : isSuccess
      ? "border-green-300 bg-green-50 text-green-800"
      : "border-blue-300 bg-blue-50 text-blue-800";

  // --- Inline Block (default) ---
  if (variant === "inline") {
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        className={`w-full rounded-md border px-3 py-2 text-sm flex items-start gap-2 ${toneInline} ${className}`}
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

  // --- Toast (larger, clearer) ---
  if (variant === "toast") {
    const chip =
      isError ? "bg-red-600" : isSuccess ? "bg-green-600" : "bg-blue-600";
    return (
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100]">
        <div
          ref={ref}
          role={isError ? "alert" : "status"}
          aria-live={isError ? "assertive" : "polite"}
          className="pointer-events-auto flex max-w-md items-start gap-4 rounded-2xl bg-gray-900/95 p-5 text-white shadow-xl ring-1 ring-black/10 outline-none"
        >
          <div className={`rounded-md px-2.5 py-1.5 text-base font-semibold ${chip}`}>
            {isError ? "Error" : isSuccess ? "Success" : "Notice"}
          </div>
          <div className="min-w-0 text-base whitespace-pre-line">{status.msg}</div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto -mr-1 rounded p-1 text-white/80 hover:text-white"
              aria-label="Dismiss"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- Modal (optional) ---
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div
        ref={ref}
        tabIndex={-1}
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl outline-none"
      >
        <div
          className={`px-4 py-3 font-semibold text-white ${
            isError ? "bg-red-600" : isSuccess ? "bg-green-600" : "bg-blue-600"
          }`}
        >
          {isError ? "Something went wrong" : isSuccess ? "Request received" : "Heads up"}
        </div>
        <div className="px-4 py-4 text-gray-800 whitespace-pre-line">{status.msg}</div>
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-black"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
