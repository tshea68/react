// src/components/PartImage.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * PartImage
 * - Optional 320x320 hover preview (when disableHoverPreview = false)
 * - When disableHoverPreview = true:
 *      • No separate hover popup
 *      • On hover, overlay on the thumbnail saying "Click for Full Screen View"
 * - Fullscreen modal with dark backdrop
 * - Close button on the top-right corner of the large image
 */
export default function PartImage({
  imageUrl,
  alt = "",
  className = "",
  disableHoverPreview = false,
  ...imgProps
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
  const OVERLAP = 30; // how much the preview overlaps the underlying thumb

  const handleMouseEnterThumb = () => {
    setIsHoveringThumb(true);

    // For click-only mode, we don't need to compute popup position
    if (disableHoverPreview) return;

    if (!thumbRef.current || typeof window === "undefined") return;

    const rect = thumbRef.current.getBoundingClientRect();
    const viewportWidth =
      window.innerWidth || document.documentElement.clientWidth || 1024;
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight || 768;

    // Center preview horizontally over the thumbnail
    let left = rect.left + rect.width / 2 - PREVIEW_WIDTH / 2;
    left = Math.max(MARGIN, Math.min(left, viewportWidth - PREVIEW_WIDTH - MARGIN));

    // Put preview ABOVE the thumbnail, overlapping it slightly
    let top = rect.top - PREVIEW_HEIGHT + OVERLAP;

    // If not enough space above, put it just BELOW, still overlapping
    if (top < MARGIN) {
      top = rect.bottom - OVERLAP;
    }

    // Clamp vertically if needed (for extremely small viewports)
    if (top + PREVIEW_HEIGHT + MARGIN > viewportHeight) {
      top = Math.max(MARGIN, viewportHeight - PREVIEW_HEIGHT - MARGIN);
    }

    setPreviewPos({ top, left });
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
      {/* Thumbnail + (optional) overlay text */}
      <div
        ref={thumbRef}
        className="relative inline-block"
        onMouseEnter={handleMouseEnterThumb}
        onMouseLeave={handleMouseLeaveThumb}
        onClick={handleClickThumb}
      >
        <img
          src={src}
          alt={alt}
          className={`${className} cursor-zoom-in`}
          onError={(e) => {
            e.currentTarget.src = "/no-image.png";
          }}
          {...imgProps}
        />

        {/* Click-only mode overlay on the thumbnail */}
        {disableHoverPreview && showHover && (
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center pointer-events-none">
            <span className="text-[11px] text-white font-semibold text-center px-2">
              Click for Full Screen View
            </span>
          </div>
        )}
      </div>

      {/* Hover Preview (for contexts where we want the popup) */}
      {canPortal &&
        !disableHoverPreview &&
        showHover &&
        previewPos &&
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
            className="flex items-center justify-center cursor-pointer"
            onMouseEnter={handleMouseEnterPreview}
            onMouseLeave={handleMouseLeavePreview}
            onClick={handleClickThumb}
          >
            <div className="relative w-full h-full bg-white shadow-2xl border border-gray-300 rounded overflow-hidden">
              <img
                src={src}
                alt={alt}
                className="w-full h-full object-contain"
              />
              {/* Centered notice at the bottom of the preview */}
              <div className="absolute inset-0 flex items-end justify-center pb-1 pointer-events-none">
                <span className="text-[11px] bg-black/80 text-white px-2 py-0.5 rounded">
                  Click for Full Screen View
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Fullscreen Modal */}
      {canPortal &&
        fullScreenSrc &&
        createPortal(
          <div
            className="fixed inset-0 z-[2000000] flex items-center justify-center bg-black/80"
            onClick={handleCloseFullScreen}
          >
            {/* Image container with close button on its corner */}
            <div
              className="relative max-w-[90%] max-h-[90%] bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={fullScreenSrc}
                alt={alt || "Part image"}
                className="max-w-full max-h-full object-contain"
              />

              <button
                type="button"
                className="absolute -top-3 -right-3 bg-black text-white rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold shadow-md cursor-pointer"
                onClick={handleCloseFullScreen}
              >
                ×
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
