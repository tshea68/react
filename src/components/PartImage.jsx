// src/components/PartImage.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * PartImage (lazy)
 * - Defers setting the real `src` until the image is visible inside the
 *   given scroll container (rootRef), falling back to viewport if none.
 * - Uses a tiny 1x1 placeholder to avoid network requests before intersecting.
 */
export default function PartImage({
  imageUrl,
  alt = "",
  className = "",
  rootRef = null,        // pass the scroll container ref (e.g., Available/AllKnown scroller)
  threshold = 0.01,
  rootMargin = "200px",  // prefetch slightly before visible for snappier paint
  onClick,
  onLoad,
  onError,
  ...rest
}) {
  const imgRef = useRef(null);
  const [src, setSrc] = useState(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!imageUrl) return;

    const node = imgRef.current;
    if (!node) return;

    // If IntersectionObserver is unavailable, just set src (graceful fallback)
    if (typeof IntersectionObserver === "undefined") {
      setSrc(imageUrl);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setSrc(imageUrl); // set real src the moment it’s visible
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

  return (
    <img
      ref={imgRef}
      // IMPORTANT: do NOT set loading="lazy" here; we control loading via IO.
      // Use a 1x1 transparent placeholder until visible.
      src={
        src && !errored
          ? src
          : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
      }
      alt={alt}
      className={className}
      decoding="async"
      // If it errors, fall back to a local placeholder and stop retrying.
      onError={(e) => {
        setErrored(true);
        e.currentTarget.src = "/no-image.png";
        onError && onError(e);
      }}
      onLoad={onLoad}
      {...rest}
    />
  );
}


