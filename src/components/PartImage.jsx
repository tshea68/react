import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Unified Part Image Component
 * ---------------------------------------
 * Features:
 *  - Centered hover preview (280px)
 *  - "Click for Full Screen" label on hover preview
 *  - Fullscreen modal with dark backdrop
 *  - White X in black circle close button
 *  - Works everywhere: parts, offers, exploded views
 */

export default function PartImage({
  imageUrl,
  alt = "",
  className = "",
  ...rest
}) {
  const thumbRef = useRef(null);

  const [hoverPos, setHoverPos] = useState(null);  // { x, y }
  const [showHover, setShowHover] = useState(false);
  const [fullScreenSrc, setFullScreenSrc] = useState(null);

  // Calculate hover preview position
  const handleMouseEnter = () => {
    if (!thumbRef.current) return;
    const rect = thumbRef.current.getBoundingClientRect();

    setHoverPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });

    setShowHover(true);
  };

  const handleMouseLeave = () => {
    setShowHover(false);
  };

  const handleClick = () => {
    setFullScreenSrc(imageUrl);
  };

  const handleClose = () => {
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

      {/* Hover Preview (Portal) */}
      {showHover && hoverPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: hoverPos.y - 280,
              left: hoverPos.x - 140,
              width: 280,
              height: 280,
              zIndex: 999999,
            }}
            className="pointer-events-none flex flex-col items-center"
          >
            <div className="bg-white shadow-2xl border border-gray-300 rounded p-1">
              <img
                src={imageUrl}
                alt={alt}
                className="w-[270px] h-[230px] object-contain"
              />
            </div>
            <div className="text-[11px] bg-black text-white px-2 py-0.5 rounded mt-1 opacity-90">
              Click for Full Screen
            </div>
          </div>,
          document.body
        )}

      {/* Fullscreen Modal (Portal) */}
      {fullScreenSrc &&
        createPortal(
          <div
            className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80"
            onClick={handleClose}
          >
            {/* Close button */}
            <div
              className="absolute top-6 right-6 bg-black text-white rounded-full w-8 h-8 flex items-center justify-center text-xl cursor-pointer"
              onClick={handleClose}
            >
              ×
            </div>

            <img
              src={fullScreenSrc}
              alt="Full Screen"
              className="max-w-[90%] max-h-[90%] object-contain shadow-xl"
            />
          </div>,
          document.body
        )}
    </>
  );
}
