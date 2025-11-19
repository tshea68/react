import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * UNIVERSAL IMAGE COMPONENT
 * - Hover preview (320x320, centered)
 * - "Click for Full Screen" label
 * - Fullscreen modal with dark backdrop
 * - White X in black circle close button
 */

export default function PartImage({
  imageUrl,
  alt = "",
  className = "",
  ...rest
}) {
  const thumbRef = useRef(null);

  const [hoverPos, setHoverPos] = useState(null); // { x, y }
  const [showHover, setShowHover] = useState(false);
  const [fullScreenSrc, setFullScreenSrc] = useState(null);

  const PREVIEW_SIZE = 320;
  const PREVIEW_HALF = PREVIEW_SIZE / 2;

  // -----------------------------
  // Hover logic
  // -----------------------------
  const handleMouseEnter = () => {
    if (!thumbRef.current) return;
    const rect = thumbRef.current.getBoundingClientRect();

    setHoverPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 12, // 12px above thumbnail
    });

    setShowHover(true);
  };

  const handleMouseLeave = () => {
    setShowHover(false);
  };

  // -----------------------------
  // Fullscreen logic
  // -----------------------------
  const handleClick = () => {
    setFullScreenSrc(imageUrl);
  };

  const closeFull = (e) => {
    e.stopPropagation();
    setFullScreenSrc(null);
  };

  return (
    <>
      {/* Thumbnail */}
      <img
        ref={thumbRef}
        src={imageUrl || "/no-image.png"}
        alt={alt}
        className={`${className} cursor-zoom-in`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onError={(e) => (e.currentTarget.src = "/no-image.png")}
        {...rest}
      />

      {/* Hover Preview */}
      {showHover && hoverPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: hoverPos.y - PREVIEW_SIZE,
              left: hoverPos.x - PREVIEW_HALF,
              width: PREVIEW_SIZE,
              height: PREVIEW_SIZE + 20,
              zIndex: 999999,
            }}
            className="pointer-events-none flex flex-col items-center animate-fadeIn"
          >
            <div className="bg-white shadow-2xl border border-gray-300 rounded p-1">
              <img
                src={imageUrl}
                alt={alt}
                className="w-[310px] h-[260px] object-contain"
              />
            </div>

            <div className="text-[11px] bg-black text-white px-2 py-0.5 rounded mt-1 opacity-90">
              Click for Full Screen
            </div>
          </div>,
          document.body
        )}

      {/* Fullscreen Modal */}
      {fullScreenSrc &&
        createPortal(
          <div
            className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80"
            onClick={closeFull}
          >
            {/* Close Button */}
            <div
              className="absolute top-6 right-6 bg-black text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl cursor-pointer z-[1000000] shadow-lg"
              onClick={closeFull}
            >
              ×
            </div>

            <img
              src={fullScreenSrc}
              alt="Full-screen view"
              className="max-w-[92%] max-h-[92%] object-contain shadow-2xl"
            />
          </div>,
          document.body
        )}
    </>
  );
}
