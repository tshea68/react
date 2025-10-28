import React, { useEffect } from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";

const CartPage = () => {
  const { cartItems, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();

  // always jump to top when cart opens
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  // compute total
  const total = cartItems
    .reduce(
      (sum, item) =>
        sum + (Number(item.price) || 0) * (item.qty || 1),
      0
    )
    .toFixed(2);

  // build checkout target using the ENTIRE cart
  function handleCheckoutClick() {
    if (!cartItems.length) return;

    // Shape each cart line into a lean object the checkout page can render.
    // We include priceEach and lineTotal so we can show totals on the summary UI.
    const summaryPayload = cartItems.map((item) => ({
      mpn: item.mpn,
      qty: item.qty || 1,
      name: item.name || null,
      priceEach: item.price ? Number(item.price) : null,
      lineTotal: item.price
        ? Number(item.price) * (item.qty || 1)
        : null,
    }));

    // URL-encode the JSON so it survives in a query param
    const encodedCart = encodeURIComponent(
      JSON.stringify(summaryPayload)
    );

    // Send the whole cart as ?cart=...
    navigate(`/checkout?cart=${encodedCart}`);
  }

  return (
    <div className="bg-[#001b36] text-white min-h-screen pt-[120px] pb-24 flex flex-col items-center">
      {/* main cart card */}
      <div className="w-full max-w-3xl bg-white rounded border border-gray-300 shadow text-gray-900">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">
            Shopping Cart
          </h1>
        </div>

        {cartItems.length === 0 ? (
          <div className="px-6 py-4 text-sm text-gray-600">
            Your cart is empty.
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-200 px-6">
              {cartItems.map((item, index) => (
                <li
                  key={index}
                  className="py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
                >
                  {/* left: details */}
                  <div className="text-sm leading-snug text-gray-800">
                    <div className="font-semibold text-gray-900">
                      {item.name}
                    </div>

                    <div className="text-[13px] text-gray-600">
                      <span className="font-semibold">MPN:</span>{" "}
                      {item.mpn}
                    </div>

                    <div className="text-[13px] text-gray-600">
                      <span className="font-semibold">Qty:</span>{" "}
                      {item.qty || 1}
                    </div>
                  </div>

                  {/* right: price + remove */}
                  <div className="text-right flex flex-col items-end">
                    <div className="text-green-700 font-semibold text-sm">
                      ${item.price}
                    </div>

                    <button
                      className="text-red-500 hover:text-red-700 text-[12px] font-medium"
                      onClick={() => removeFromCart(item.mpn)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {/* footer row: total + actions */}
            <div className="px-6 py-4 border-t border-gray-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-lg font-semibold text-gray-900">
                Total: ${total}
              </div>

              <div className="flex gap-3">
                <button
                  className="bg-gray-100 border border-gray-300 text-gray-800 text-sm font-medium rounded px-4 py-2 hover:bg-gray-200"
                  onClick={clearCart}
                >
                  Clear Cart
                </button>

                <button
                  className={`text-sm font-semibold rounded px-4 py-2 ${
                    cartItems.length === 0
                      ? "bg-gray-400 text-white cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                  disabled={cartItems.length === 0}
                  onClick={handleCheckoutClick}
                >
                  Checkout
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* tiny footer text */}
      <div className="text-[11px] text-gray-400 mt-8">
        © 2025 Parts Finder. All rights reserved.
      </div>
    </div>
  );
};

export default CartPage;
