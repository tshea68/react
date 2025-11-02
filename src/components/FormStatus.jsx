// src/components/FormStatus.jsx
import React, { useEffect, useRef } from "react";

/**
 * FormStatus (backward compatible)
 * Props:
 *  - status: { type?: 'success'|'error'|'info', msg: string, sticky?: boolean } | null
 *  - onClose?: () => void
 *  - className?: string               // used for inline variant
 *  - autoFocus?: boolean              // for inline/modal focus (default true)
 *  - variant?: 'inline'|'toast'|'modal'  (default 'inline')
 *  - duration?: number                // toast auto-dismiss ms (default 4000)
 */
export default function FormStatus({
  status,
  onClose,
  className = "",
  autoFocus = true,
  variant = "inline",
  duration = 4000,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!status) return;
    if (autoFocus && ref.current && (variant === "inline" || variant === "modal")) {
      ref.current.focus();
    }
  }, [status, autoFocus, variant]);

  // Toast auto-dismiss for non-errors unless sticky
  useEffect(() => {
    if (!status || variant !== "toast") return;
    const isError = (status.type || "info") === "error";
    if (status.sticky || isError) return;
    const t = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(t);
  }, [status, variant, duration, onClose]);

  if (!status) return null;

  const kind = status.type || "info";
  const isError = kind === "error";
  const isSuccess = kind === "success";

  const baseInline =
    "w-full rounded-md border px-3 py-2 text-sm flex items-start gap-2 outline-none";
  const toneInline = isError
    ? "border-red-300 bg-red-50 text-red-800"
    : isSuccess
    ? "border-green-300 bg-green-50 text-green-800"
    : "border-blue-300 bg-blue-50 text-blue-800";

  const role = isError ? "alert" : "status";
  const ariaLive = isError ? "assertive" : "polite";

  // --- Inline banner (your original behavior) ---
  if (variant === "inline") {
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role={role}
        aria-live={ariaLive}
        className={`${baseInline} ${toneInline} ${className}`}
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

  // --- Centered modal ---
  if (variant === "modal") {
    const headerTone = isError
      ? "bg-red-600"
      : isSuccess
      ? "bg-green-600"
      : "bg-blue-600";
    const title = isError ? "Something went wrong" : isSuccess ? "Request received" : "Heads up";

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
        <div
          ref={ref}
          tabIndex={-1}
          role={role}
          aria-live={ariaLive}
          className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl outline-none"
        >
          <div className={`px-4 py-3 text-white ${headerTone} font-semibold`}>
            {title}
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

  // --- Toast (bottom-right, non-blocking) ---
  const toneToast =
    isError ? "bg-red-600" : isSuccess ? "bg-green-600" : "bg-blue-600";

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      <div
        ref={ref}
        tabIndex={-1}
        role={role}
        aria-live={ariaLive}
        className="pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl bg-gray-900/95 p-4 text-white shadow-xl ring-1 ring-black/10 outline-none"
      >
        <div className={`rounded-md px-2 py-1 text-sm font-semibold ${toneToast}`}>
          {isError ? "Error" : isSuccess ? "Success" : "Notice"}
        </div>
        <div className="min-w-0">
          <div className="text-sm whitespace-pre-line">{status.msg}</div>
        </div>
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
