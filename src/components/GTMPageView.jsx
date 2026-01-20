// src/components/GTMPageView.jsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function GTMPageView() {
  const location = useLocation();

  useEffect(() => {
    // Only fire once GTM is actually loaded (after consent)
    if (!window.google_tag_manager) return;
    if (!window.dataLayer) return;

    window.dataLayer.push({
      event: "page_view",
      page_path: location.pathname + location.search,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [location]);

  return null;
}
