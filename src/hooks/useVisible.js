// src/hooks/useVisible.js
import { useEffect, useRef, useState } from "react";

/**
 * Use IntersectionObserver to know when an element is visible
 * within an optional scroll container (rootRef).
 */
export default function useVisible({ rootRef = null, threshold = 0.01, rootMargin = "150px" } = {}) {
  const targetRef = useRef(null);
  const [isVisible, setVisible] = useState(false);

  useEffect(() => {
    const el = targetRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { root: rootRef?.current || null, threshold, rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootRef, threshold, rootMargin]);

  return { ref: targetRef, isVisible };
}
