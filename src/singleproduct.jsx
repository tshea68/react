*** a/src/SingleProduct.jsx
--- b/src/SingleProduct.jsx
@@
   const isSpecialOrder = useMemo(
     () => (part?.stock_status || "").toLowerCase().includes("special"),
     [part?.stock_status]
   );
 
-  const canAddOrBuy = useMemo(() => {
-    if (!part) return false;
-    if (isSpecialOrder) return true;
-    if (!avail) return true;
-    if (avail.totalAvailable >= quantity) return true;
-    return ALLOW_BACKORDER;
-  }, [part, isSpecialOrder, avail, quantity]);
+  // ---------- LIVE STOCK–FIRST DERIVED FLAGS ----------
+  const stockTotal   = avail?.totalAvailable ?? 0;
+  const hasLiveStock = stockTotal > 0;
+  const zipValid     = /^\d{5}(-\d{4})?$/.test(String(zip || ""));
+  // show "Pre Order" only when truly OOS (or requesting more than available) and backorders allowed
+  const showPreOrder = !isSpecialOrder && !!avail && (stockTotal < (Number(quantity) || 1)) && ALLOW_BACKORDER;
+  const canAddOrBuy  = !!part && (isSpecialOrder || hasLiveStock || (!avail ? true : ALLOW_BACKORDER));
@@
-          {/* Price + catalog status pill */}
-          <p className="text-2xl font-bold mb-1 text-green-600">{fmtCurrency(part.price)}</p>
-          {part.stock_status && (
-            <p className={`inline-block px-3 py-1 text-sm rounded font-semibold mb-3 ${
-              (part.stock_status || "").toLowerCase() === "in stock" ? "bg-green-600 text-white" : "bg-black text-white"
-            }`}>
-              {part.stock_status}
-            </p>
-          )}
+          {/* Price + status (prefer LIVE availability over DB) */}
+          <p className="text-2xl font-bold mb-1 text-green-600">{fmtCurrency(part.price)}</p>
+          {(() => {
+            if (avail) {
+              const label = hasLiveStock ? "In Stock" : "Out of Stock";
+              const cls   = hasLiveStock ? "bg-green-600 text-white" : "bg-red-600 text-white";
+              return <p className={`inline-block px-3 py-1 text-sm rounded font-semibold mb-3 ${cls}`}>{label}</p>;
+            }
+            if (part.stock_status) {
+              const ok = (part.stock_status || "").toLowerCase().includes("in stock");
+              return (
+                <p className={`inline-block px-3 py-1 text-sm rounded font-semibold mb-3 ${ok ? "bg-green-600 text-white" : "bg-black text-white"}`}>
+                  {part.stock_status}
+                </p>
+              );
+            }
+            return null;
+          })()}
@@
-          {/* Special Order OR normal availability */}
+          {/* Special Order OR normal availability */}
           {(part.stock_status || "").toLowerCase().includes("special") ? (
             <div className="p-4 border rounded mb-4 bg-yellow-50">
               <div className="font-semibold mb-1">Special Order Item</div>
               <p className="text-sm text-gray-800">
                 This part is ordered from the manufacturer and ships as soon as it becomes available.
@@
             </div>
           ) : (
             <div className="p-3 border rounded mb-4 bg-white">
-              <div className="flex flex-wrap items-end gap-3">
-                <div>
-                  <label className="block text-sm font-medium">ZIP Code</label>
-                  <input
-                    value={zip}
-                    onChange={(e) => setZip(e.target.value)}
-                    placeholder="ZIP or ZIP+4"
-                    className="border rounded px-3 py-2 w-36"
-                    inputMode="numeric"
-                  />
-                </div>
-
-                <div>
-                  <label className="block text-sm font-medium">Quantity</label>
-                  <select
-                    value={quantity}
-                    onChange={(e) => setQuantity(Number(e.target.value))}
-                    className="border px-2 py-2 rounded"
-                  >
-                    {[...Array(10)].map((_, i) => (
-                      <option key={i + 1} value={i + 1}>{i + 1}</option>
-                    ))}
-                  </select>
-                </div>
-
-                <button
-                  type="button"
-                  onClick={fetchAvailability}
-                  className="bg-gray-900 text-white px-4 py-2 rounded"
-                  disabled={availLoading}
-                >
-                  {availLoading ? "Checking..." : "Check availability"}
-                </button>
-
-                {avail && (
-                  <span className={`ml-auto px-3 py-1 text-sm rounded ${
-                    avail.status === "In Stock" ? "bg-green-600 text-white" : "bg-red-600 text-white"
-                  }`}>
-                    {avail.status} · {avail.totalAvailable} total
-                  </span>
-                )}
-              </div>
+              <div className="flex flex-wrap items-end gap-3">
+                <div>
+                  <label className="block text-sm font-medium">ZIP Code</label>
+                  <input
+                    value={zip}
+                    onChange={(e) => setZip(e.target.value)}
+                    placeholder="ZIP or ZIP+4"
+                    className="border rounded px-3 py-2 w-36"
+                    inputMode="numeric"
+                  />
+                </div>
+                <button
+                  type="button"
+                  onClick={fetchAvailability}
+                  className="bg-gray-900 text-white px-4 py-2 rounded"
+                  disabled={availLoading || !zipValid}
+                >
+                  {availLoading ? "Checking..." : "Check availability"}
+                </button>
+                {avail && (
+                  <span
+                    className={`ml-auto px-3 py-1 text-sm rounded ${hasLiveStock ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
+                  >
+                    {hasLiveStock ? "In Stock" : "Out of Stock"} · {stockTotal} total
+                  </span>
+                )}
+              </div>
@@
-              {avail && avail.totalAvailable === 0 && ALLOW_BACKORDER && (
+              {avail && !hasLiveStock && ALLOW_BACKORDER && (
                 <p className="mt-2 text-xs text-gray-600">
                   Out of stock — you can <strong>Pre Order</strong> now and we’ll ship as soon as inventory arrives.
                 </p>
               )}
 
-              {avail?.totalAvailable > 0 && avail.totalAvailable <= 5 && (
+              {hasLiveStock && stockTotal <= 5 && (
                 <span className="mt-2 inline-block text-xs font-semibold text-red-600">
-                  Only {avail.totalAvailable} left
+                  Only {stockTotal} left
                 </span>
               )}
@@
-          {/* Cart actions */}
+          {/* Cart actions (single Qty control; suppress Pre-Order when in stock) */}
           {!isSpecialOrder && (
             <div className="flex flex-wrap items-center gap-3 mb-4">
               <label className="font-medium">Qty:</label>
               <select
                 value={quantity}
                 onChange={(e) => setQuantity(Number(e.target.value))}
                 className="border px-2 py-1 rounded"
               >
                 {[...Array(10)].map((_, i) => (
                   <option key={i + 1} value={i + 1}>{i + 1}</option>
                 ))}
               </select>
 
               <button
                 type="button"
                 className={`px-4 py-2 rounded text-white ${canAddOrBuy ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"}`}
                 disabled={!canAddOrBuy}
                 onClick={() => canAddOrBuy && (addToCart(part, quantity), navigate("/cart"))}
               >
                 Add to Cart
               </button>
 
               <button
                 type="button"
                 className={`px-4 py-2 rounded text-white ${canAddOrBuy ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 cursor-not-allowed"}`}
                 disabled={!canAddOrBuy}
                 onClick={() =>
                   canAddOrBuy &&
                   navigate(
-                    `/checkout?mpn=${encodeURIComponent(part.mpn)}&qty=${Number(quantity) || 1}&backorder=${avail && avail.totalAvailable < quantity ? "1" : "0"}`
+                    `/checkout?mpn=${encodeURIComponent(part.mpn)}&qty=${Number(quantity) || 1}&backorder=${showPreOrder ? "1" : "0"}`
                   )
                 }
               >
-                {avail && avail.totalAvailable < quantity ? "Pre Order" : "Buy Now"}
+                {showPreOrder ? "Pre Order" : "Buy Now"}
               </button>
             </div>
           )}






