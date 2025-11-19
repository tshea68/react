// src/components/PartImage.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * UNIVERSAL IMAGE COMPONENT
 * -------------------------------------------------------
 * • Lazy loads like before (IntersectionObserver)
 * • Hover = 2x zoom preview OUTSIDE the card (like exploded views)
 * • Shows “Click for Full Screen” hover hint
 * • Click = fullscreen dark overlay with large image
 * -------------------------------------------------------
 */

export default function PartImage({
  imageUrl,
  alt = "",
  className = "",
  rootRef = null,
  threshold = 0.01,
  rootMargin = "200px",
  ...rest
}) {
  const imgRef = useRef(null);
  const [src, setSrc] = useState(null);
  const [errored, setErrored] = useState(false);

  // Hover preview
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewPos, setPreviewPos] = useState({ x: 0, y: 0 });

  // Fullscreen
  const [fullscreen, setFullscreen] = useState(false);

  /** Lazy-load image on intersection */
  useEffect(() => {
    if (!imageUrl) return;

    const node = imgRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setSrc(imageUrl);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setSrc(imageUrl);
            observer.disconnect();
          }
        });
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

  /** Hover preview positioning */
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPreviewPos({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  };

  /** ESC closes fullscreen */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {/* MAIN IMAGE */}
      <img
        ref={imgRef}
        src={
          src && !errored
            ? src
            : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
        }
        alt={alt}
        className={`${className} cursor-pointer`}
        onMouseEnter={() => setPreviewVisible(true)}
        onMouseLeave={() => setPreviewVisible(false)}
        onMouseMove={handleMouseMove}
        onClick={() => setFullscreen(true)}
        onError={(e) => {
          setErrored(true);
          e.currentTarget.src = "/no-image.png";
        }}
        decoding="async"
        {...rest}
      />

      {/* HOVER PREVIEW (about 2x zoom) */}
      {previewVisible && src && !errored && (
        <div
          style={{
            position: "fixed",
            top: previewPos.y,
            left: previewPos.x,
            transform: "translate(-50%, -50%)",
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          <div className="relative">
            <img
              src={src}
              alt={alt}
              className="w-[180px] h-[180px] object-contain rounded-lg shadow-2xl border border-gray-200 bg-white"
            />
            <div className="absolute bottom-0 inset-x-0 bg-black bg-opacity-60 text-white text-[10px] py-1 text-center rounded-b-lg">
              Click for Full Screen
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN OVERLAY */}
      {fullscreen && src && !errored && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 z-[10000] flex items-center justify-center"
          onClick={() => setFullscreen(false)}
        >
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
