// src/components/PartImage.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * PartImage (lazy + hover preview)
 * - Lazy loads via IntersectionObserver (using rootRef if provided).
 * - Shows a larger hover preview ("popup") while the user hovers.
 */
export default function PartImage({
  imageUrl,
  alt = "",
  className = "",
  rootRef = null,        // scroll container ref, if any
  threshold = 0.01,
  rootMargin = "200px",
  onClick,
  onLoad,
  onError,
  onMouseEnter,
  onMouseLeave,
  enablePreview = true,  // turn hover preview on/off
  ...rest
}) {
  const imgRef = useRef(null);
  const [src, setSrc] = useState(null);
  const [errored, setErrored] = useState(false);

  // preview overlay state
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewPos, setPreviewPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!imageUrl) return;

    const node = imgRef.current;
    if (!node) return;

    // Fallback: no IntersectionObserver → load immediately
    if (typeof IntersectionObserver === "undefined") {
      setSrc(imageUrl);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setSrc(imageUrl);
            observer.disconnect();
            break;
          }
        }
      },
      {
        root: rootRef?.current || null,
        threshold,
        rootMargin,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [imageUrl, rootRef, threshold, rootMargin]);

  const handleMouseEnter = (e) => {
    if (enablePreview && src && !errored) {
      const rect = e.currentTarget.getBoundingClientRect();
      setPreviewPos({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
      setPreviewVisible(true);
    }
    onMouseEnter && onMouseEnter(e);
  };

  const handleMouseLeave = (e) => {
    if (enablePreview) {
      setPreviewVisible(false);
    }
    onMouseLeave && onMouseLeave(e);
  };

  return (
    <>
      <img
        ref={imgRef}
        // Lazy placeholder until visible
        src={
          src && !errored
            ? src
            : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
        }
        alt={alt}
        className={className}
        decoding="async"
        onClick={onClick}
        onLoad={onLoad}
        onError={(e) => {
          setErrored(true);
          e.currentTarget.src = "/no-image.png";
          onError && onError(e);
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...rest}
      />

      {enablePreview && previewVisible && src && !errored && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: previewPos.top,
            left: previewPos.left,
            transform: "translateX(-50%)",
          }}
        >
          <div className="bg-white border border-gray-300 shadow-lg rounded-md p-1">
            <img
              src={src}
              alt={alt}
              className="max-w-[260px] max-h-[260px] object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
