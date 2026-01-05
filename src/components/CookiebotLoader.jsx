import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ALLOW_PREFIXES = [
  "/",          // home
  "/brand",
  "/model",
  "/part",
  "/product",
  "/cart",
  "/checkout",
  "/success",
  "/order",
];

function isAllowedPath(pathname) {
  if (pathname === "/") return true;
  return ALLOW_PREFIXES.some((p) => p !== "/" && pathname.startsWith(p));
}

export default function CookiebotLoader() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Do NOT load on 404/junk routes
    if (!isAllowedPath(pathname)) return;

    // Already loaded?
    if (document.getElementById("Cookiebot")) return;

    // Light performance win
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = "https://consent.cookiebot.com";
    preconnect.crossOrigin = "anonymous";
    document.head.appendChild(preconnect);

    const s = document.createElement("script");
    s.id = "Cookiebot";
    s.src = "https://consent.cookiebot.com/uc.js";
    s.type = "text/javascript";
    s.defer = true;
    s.setAttribute("data-cbid", "2e231b70-e334-4947-9391-187ce3d1eaf4");
    s.setAttribute("data-blockingmode", "auto");
    document.head.appendChild(s);
  }, [pathname]);

  return null;
}
