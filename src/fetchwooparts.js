export async function fetchWooParts(modelNumber) {
  const API_BASE = "https://fastapi-app-kkkq.onrender.com";

  try {
    const response = await fetch(`${API_BASE}/api/models/${encodeURIComponent(modelNumber)}/parts`);
    const data = await response.json();

    const wooParts = (data.parts || []).map(part => {
      const normalizedStatus = (part.stock_status || "").toLowerCase().replace(/\s/g, "");
      return {
        title: part.title,
        price: part.price,
        inventory: normalizedStatus,
        image: part.image_url,
      };
    });

    console.log("🧪 Before sort:", wooParts.map(p => p.inventory));

    // Prioritize 'instock' first
    wooParts.sort((a, b) => {
      if (a.inventory === "instock" && b.inventory !== "instock") return -1;
      if (a.inventory !== "instock" && b.inventory === "instock") return 1;
      return 0;
    });

    console.log("✅ After sort:", wooParts.map(p => p.inventory));
    return wooParts;
  } catch (err) {
    console.error("Error fetching Woo parts:", err);
    return [];
  }
}

