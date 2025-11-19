// src/components/PartImage.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * PartImage
 * - 320x320 hover preview centered near the thumbnail
 * - "Click for Full Screen" label on hover
 * - Fullscreen modal with dark backdrop
 * - White X in black circle close button
 * - Intended for parts, offers, exploded views, etc.
 */
export default function PartImage({
  imageUrl,
  alt = "",
  className = "",
  ...rest
}) {
  const thumbRef = useRef(null);

  const [previewPos, setPreviewPos] = useState(null); // { top, left }
  const [showHover, setShowHover] = useState(false);
  const [isHoveringThumb, setIsHoveringThumb] = useState(false);
  const [isHoveringPreview, setIsHoveringPreview] = useState(false);

  const [fullScreenSrc, setFullScreenSrc] = useState(null);

  const src = imageUrl || "/no-image.png";

  const PREVIEW_WIDTH = 320;
  const PREVIEW_HEIGHT = 320;
  const MARGIN = 10;

  const handleMouseEnterThumb = () => {
    if (!thumbRef.current || typeof window === "undefined") {
      setIsHoveringThumb(true);
      return;
    }

    const rect = thumbRef.current.getBoundingClientRect();
    const viewportWidth =
      window.innerWidth || document.documentElement.clientWidth || 1024;
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight || 768;

    // Center horizontally relative to the thumbnail
    const centerX = rect.left + rect.width / 2;

    // Try to position ABOVE the thumbnail first
    let top = rect.top - PREVIEW_HEIGHT - MARGIN;
    let placeBelow = false;

    if (top < MARGIN) {
      // Not enough space above; place below
      top = rect.bottom + MARGIN;
      placeBelow = true;
    }

    // Clamp vertically inside viewport (in case really tight)
    if (placeBelow && top + PREVIEW_HEIGHT + MARGIN > viewportHeight) {
      top = Math.max(
        MARGIN,
        viewportHeight - PREVIEW_HEIGHT - MARGIN
      );
    }

    // Center the preview, then clamp horizontally
    let left = centerX - PREVIEW_WIDTH / 2;
    if (left < MARGIN) left = MARGIN;
    if (left + PREVIEW_WIDTH + MARGIN > viewportWidth) {
      left = viewportWidth - PREVIEW_WIDTH - MARGIN;
    }

    setPreviewPos({ top, left });
    setIsHoveringThumb(true);
  };

  const handleMouseLeaveThumb = () => {
    setIsHoveringThumb(false);
  };

  const handleMouseEnterPreview = () => {
    setIsHoveringPreview(true);
  };

  const handleMouseLeavePreview = () => {
    setIsHoveringPreview(false);
  };

  const handleClickThumb = () => {
    if (!src) return;
    setFullScreenSrc(src);
  };

  const handleCloseFullScreen = () => {
    setFullScreenSrc(null);
  };

  // Show hover when either the thumb or preview is hovered
  useEffect(() => {
    if (fullScreenSrc) {
      setShowHover(false);
      return;
    }
    setShowHover(isHoveringThumb || isHoveringPreview);
  }, [isHoveringThumb, isHoveringPreview, fullScreenSrc]);

  const canPortal =
    typeof document !== "undefined" && typeof window !== "undefined";

  return (
    <>
      {/* Thumbnail */}
      <img
        ref={thumbRef}
        src={src}
        alt={alt}
        className={`${className} cursor-zoom-in`}
        onMouseEnter={handleMouseEnterThumb}
        onMouseLeave={handleMouseLeaveThumb}
        onClick={handleClickThumb}
        onError={(e) => {
          e.currentTarget.src = "/no-image.png";
        }}
        {...rest}
      />

      {/* Hover Preview */}
      {canPortal && showHover && previewPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: previewPos.top,
              left: previewPos.left,
              width: PREVIEW_WIDTH,
              height: PREVIEW_HEIGHT,
              zIndex: 999999,
            }}
            className="flex flex-col items-center"
            onMouseEnter={handleMouseEnterPreview}
            onMouseLeave={handleMouseLeavePreview}
          >
            <div className="bg-white shadow-2xl border border-gray-300 rounded p-1">
              <img
                src={src}
                alt={alt}
                className="w-[300px] h-[280px] object-contain"
              />
            </div>
            <div className="mt-1 text-[11px] bg-black text-white px-2 py-0.5 rounded opacity-90">
              Click for Full Screen
            </div>
          </div>,
          document.body
        )}

      {/* Fullscreen Modal */}
      {canPortal && fullScreenSrc &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/80"
            onClick={handleCloseFullScreen}
          >
            {/* Close button */}
            <button
              type="button"
              className="absolute top-6 right-6 bg-black text-white rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold shadow-md cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handleCloseFullScreen();
              }}
            >
              ×
            </button>

            <img
              src={fullScreenSrc}
              alt={alt || "Part image"}
              className="max-w-[90%] max-h-[90%] object-contain shadow-2xl bg-white"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </>
  );
}
