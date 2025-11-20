// src/components/PartImage.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * PartImage
 * - Optional 320x320 hover preview above & slightly overlapping the thumbnail
 * - "See Full Screen View" overlay on the thumbnail when hovered
 * - Fullscreen modal with dark backdrop
 * - White X in black circle close button
 *
 * Props:
 *  - imageUrl: string
 *  - alt?: string
 *  - className?: string   // applied to wrapper
 *  - disableHoverPreview?: boolean // when true, no floating 320x320 popup (click-only)
 */
export default function PartImage({
  imageUrl,
  alt = "",
  className = "",
  disableHoverPreview = false,
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
  const OVERLAP = 30; // how much the preview overlaps the underlying thumb

  const handleMouseEnterThumb = () => {
    setIsHoveringThumb(true);

    // For click-only mode we skip the floating preview positioning
    if (disableHoverPreview || !thumbRef.current || typeof window === "undefined") {
      return;
    }

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

  // Show hover popup when either the thumb or preview is hovered
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
      {/* Thumbnail + overlay */}
      <div
        ref={thumbRef}
        className={`relative inline-block cursor-zoom-in ${className}`}
        onMouseEnter={handleMouseEnterThumb}
        onMouseLeave={handleMouseLeaveThumb}
        onClick={handleClickThumb}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain"
          onError={(e) => {
            e.currentTarget.src = "/no-image.png";
          }}
          {...rest}
        />

        {/* On-thumb overlay text when hovering */}
        {isHoveringThumb && (
          <div className="absolute inset-0 bg-black/35 flex items-end justify-center pointer-events-none">
            <span className="mb-1 text-[11px] bg-black/80 text-white px-2 py-0.5 rounded">
              See Full Screen View
            </span>
          </div>
        )}
      </div>

      {/* Hover Preview (floating 320x320 box) – disabled in click-only mode */}
      {canPortal &&
        showHover &&
        previewPos &&
        !disableHoverPreview &&
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
              <div className="absolute inset-x-0 bottom-1 flex justify-center pointer-events-none">
                <span className="text-[11px] bg-black/80 text-white px-2 py-0.5 rounded">
                  Click for Full Screen
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
            {/* Close button */}
            <button
              type="button"
              className="absolute top-6 right-6 bg-black text-white rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold shadow-md cursor-pointer z-[2000001]"
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
