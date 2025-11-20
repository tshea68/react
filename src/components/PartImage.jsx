// src/components/PartImage.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * PartImage
 * - 320x320 hover preview just above & slightly overlapping the thumbnail
 * - "Click for Full Screen" label overlaid on bottom of the preview image
 * - Fullscreen modal with dark backdrop
 * - White X in black circle close button
 *
 * Hover preview is anchored to the thumbnail itself (no viewport math),
 * so it behaves the same on PartsExplorer, model page, single-part page, etc.
 */
export default function PartImage({
  imageUrl,
  alt = "",
  className = "",
  ...rest
}) {
  const [showHover, setShowHover] = useState(false);
  const [isHoveringThumb, setIsHoveringThumb] = useState(false);
  const [isHoveringPreview, setIsHoveringPreview] = useState(false);
  const [fullScreenSrc, setFullScreenSrc] = useState(null);

  const src = imageUrl || "/no-image.png";

  const PREVIEW_WIDTH = 320;
  const PREVIEW_HEIGHT = 320;
  const OVERLAP = 30; // how much the preview overlaps the underlying thumb

  const handleMouseEnterThumb = () => {
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
      {/* Wrapper so the preview can be positioned relative to the thumb */}
      <span className="relative inline-block">
        {/* Thumbnail */}
        <img
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

        {/* Hover Preview (anchored to the thumbnail) */}
        {showHover && (
          <div
            className="absolute z-[999999] flex items-center justify-center cursor-pointer"
            style={{
              width: PREVIEW_WIDTH,
              height: PREVIEW_HEIGHT,
              left: "50%",
              // Position the preview above the thumb, overlapping it slightly
              top: `-${PREVIEW_HEIGHT - OVERLAP}px`,
              transform: "translateX(-50%)",
            }}
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
          </div>
        )}
      </span>

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
