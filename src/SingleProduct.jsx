const handleCheckInventory = async () => {
  // force HTTPS to avoid mixed-content
  const safeAvail = (AVAIL_URL || "").replace("http://", "https://");
  if (!safeAvail) {
    setInvError("Inventory service unavailable.");
    setInvOpen(true);
    return;
  }
  try {
    setInvLoading(true);
    setInvError(null);
    setInvOpen(true);

    const payload = {
      partNumber: part?.mpn || routeMpn,
      postalCode: "10001",         // TODO: wire this to user ZIP if you collect it
      quantity: qty || 1
    };

    const r = await fetch(`${safeAvail}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) throw new Error(`Inventory request failed: ${r.status}`);
    const data = await r.json();
    const rows = Array.isArray(data?.locations)
      ? data.locations
      : Array.isArray(data) ? data : [];
    setInvRows(rows);
  } catch (e) {
    console.error(e);
    setInvError("No live inventory returned.");
    setInvRows([]);
  } finally {
    setInvLoading(false);
  }
};

