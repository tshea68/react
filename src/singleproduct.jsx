{(() => {
  if (avail) {
    const label = hasLiveStock
      ? `In Stock • ${stockTotal} total`
      : "Out of Stock";
    const cls = hasLiveStock
      ? "bg-green-600 text-white"
      : "bg-red-600 text-white";
    return (
      <p className={`inline-block px-3 py-1 text-sm rounded font-semibold mb-3 ${cls}`}>
        {label}
      </p>
    );
  }
  if (part.stock_status) {
    const ok = (part.stock_status || "").toLowerCase().includes("in stock");
    return (
      <p className={`inline-block px-3 py-1 text-sm rounded font-semibold mb-3 ${ok ? "bg-green-600 text-white" : "bg-black text-white"}`}>
        {part.stock_status}
      </p>
    );
  }
  return null;
})()}
