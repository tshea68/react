// src/components/PartImage.jsx
import React, { useState } from "react";

export default function PartImage({
  imageUrl,
  alt = "",
  className = "",
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [showModal, setShowModal] = useState(false);

  if (!imageUrl) {
    imageUrl = "/no-image.png";
  }

  return (
    <>
      {/* ─────────────────────────────
          ORIGINAL IMAGE
      ───────────────────────────── */}
      <div
        className={`relative ${className}`}
        onMouseEnter={() => setShowPreview(true)}
        onMouseLeave={() => setShowPreview(false)}
        onClick={() => setShowModal(true)}
        style={{ cursor: "zoom-in" }}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-contain"
          onError={(e) => (e.currentTarget.src = "/no-image.png")}
        />

        {/* ─────────────────────────────
            HOVER PREVIEW POPUP
        ───────────────────────────── */}
        {showPreview && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-[9999] shadow-xl rounded-md overflow-hidden bg-white border border-gray-300"
            style={{
              top: "-10px",
              transform: "translate(-50%, -100%)",
              width: "280px",     // <<— Adjust this for hover size
              height: "280px",
            }}
          >
            <img
              src={imageUrl}
              alt={alt}
              className="w-full h-full object-contain bg-white"
            />
            <div className="text-center text-[11px] bg-black text-white py-1">
              Click for Full Screen
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────
          FULL SCREEN MODAL
      ───────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center"
        >
          {/* DARK BACKDROP */}
          <div
            className="absolute inset-0 bg-black bg-opacity-80"
            onClick={() => setShowModal(false)}
          />

          {/* CLOSE BUTTON - MUST BE ABOVE OVERLAY */}
          <button
            onClick={() => setShowModal(false)}
            className="absolute top-6 right-6 z-[100001] text-white text-3xl font-bold cursor-pointer"
            style={{ textShadow: "0 0 6px black" }}
          >
            ×
          </button>

          {/* FULL SIZE IMAGE */}
          <div className="relative z-[100001] max-w-[90vw] max-h-[90vh]">
            <img
              src={imageUrl}
              alt={alt}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl bg-white"
              onError={(e) => (e.currentTarget.src = "/no-image.png")}
            />
          </div>
        </div>
      )}
    </>
  );
}
