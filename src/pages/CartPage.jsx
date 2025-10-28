// src/pages/CartPage.jsx
import React from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";

const CartPage = () => {
  const { cartItems, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();

  const total = cartItems
    .reduce((sum, item) => sum + (item.price || 0) * (item.qty || 1), 0)
    .toFixed(2);

  return (
    <div className="bg-[#001b36] text-white min-h-screen p-4 flex flex-col items-center">
      {/* main cart card */}
      <div className="w-full max-w-4xl bg-white rounded border p-6 text-gray-900">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">
          Shopping Cart
        </h1>

        {cartItems.length === 0 ? (
          <p className="text-gray-600">Your cart is empty.</p>
        ) : (
          <>
            <ul className="space-y-4 mb-6">
              {cartItems.map((item, index) => (
                <li
                  key={index}
                  className="flex justify-between items-start border-b pb-2"
                >
                  <div className="text-sm leading-snug">
                    <div className="font-medium text-gray-800">
                      {item.name}
                    </div>
                    <div className="text-gray-500">
                      <span className="font-semibold">MPN:</span>{" "}
                      {item.mpn}
                    </div>
                    <div className="text-gray-500">
                      <span className="font-semibold">Qty:</span>{" "}
                      {item.qty || 1}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-sm">
                    <span className="text-green-700 font-semibold">
                      ${item.price}
                    </span>

                    <button
                      className="text-red-500 hover:text-red-700 text-xs"
                      onClick={() => removeFromCart(item.mpn)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-t pt-4 gap-4">
              <div className="text-lg font-semibold text-gray-900">
                Total: ${total}
              </div>

              <div className="flex gap-4">
                <button
                  className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 text-sm font-medium text-gray-800 border border-gray-300"
                  onClick={clearCart}
                >
                  Clear Cart
                </button>

                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-semibold"
                  onClick={() => navigate("/checkout")}
                >
                  Checkout
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* footer (optional; mirrors PDP footer spacing) */}
      <div className="text-[11px] text-gray-400 mt-8">
        © 2025 Parts Finder. All rights reserved.
      </div>
    </div>
  );
};

export default CartPage;
