// ...snip...
const AVAIL_URL = "https://api.appliancepartgeeks.com/api";
const DEFAULT_ZIP = "10001";

function toFiveDigitZip(z) {
  const m = String(z || "").match(/^\d{5}/);
  return m ? m[0] : "";
}

async function fetchAvailability() {
  const zip5 = toFiveDigitZip(zip);
  if (!part?.mpn || !zip5) {
    setAvail(null);
    setAvailError("Please enter a valid US ZIP (##### or #####-####).");
    return;
  }
  setAvailError(null);
  setAvailLoading(true);
  try {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const res = await fetch(`${AVAIL_URL}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        partNumber: part.mpn,
        postalCode: zip5,
        quantity: Math.max(1, Number(quantity) || 1),
        distanceMeasure: "m",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
    }
    const data = await res.json();
    setAvail(data?.locations ? data : { locations: [], ...data });
  } catch (e) {
    if (e.name !== "AbortError") {
      console.error("availability error:", e);
      setAvail(null);
      setAvailError("Inventory service unavailable. Please try again.");
    }
  } finally {
    setAvailLoading(false);
  }
}

// auto fetch when part / zip / quantity changes
useEffect(() => {
  if (part?.mpn) fetchAvailability();
  localStorage.setItem("user_zip", zip || "");
  return () => abortRef.current?.abort(); // cleanup on unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [part?.mpn, zip, quantity]);
