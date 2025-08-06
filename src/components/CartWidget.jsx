import React from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";

const CartWidget = () => {
  const { cartItems } = useCart();
  const navigate = useNavigate();

  const total = cartItems.reduce((sum, item) => sum + item.qty, 0);

  return (
    <button
      onClick={() => navigate("/cart")}
      className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded shadow-lg z-50"
    >
      🛒 Cart ({total})
    </button>
  );
};

export default CartWidget;
