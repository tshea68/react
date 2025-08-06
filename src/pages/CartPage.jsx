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
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Shopping Cart</h1>

      {cartItems.length === 0 ? (
        <p className="text-gray-600">Your cart is empty.</p>
      ) : (
        <>
          <ul className="space-y-4 mb-6">
            {cartItems.map((item, index) => (
              <li key={index} className="flex justify-between items-center border-b pb-2">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-gray-500">MPN: {item.mpn}</div>
                  <div className="text-sm text-gray-500">Qty: {item.qty || 1}</div>
                </div>
                <div className="flex gap-4 items-center">
                  <span className="text-green-700 font-semibold">${item.price}</span>
                  <button
                    className="text-red-500 hover:text-red-700 text-sm"
                    onClick={() => removeFromCart(item.mpn)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex justify-between items-center border-t pt-4">
            <div className="text-lg font-semibold">Total: ${total}</div>
            <div className="flex gap-4">
              <button
                className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
                onClick={clearCart}
              >
                Clear Cart
              </button>
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                onClick={() => window.location.href = "/checkout"} // still placeholder
              >
                Checkout
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CartPage;
