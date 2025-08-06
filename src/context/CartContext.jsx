import React, { createContext, useContext, useState } from "react";

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  const addToCart = (item) => {
    setCartItems((prev) => {
      const exists = prev.find((p) => p.mpn === item.mpn);
      return exists
        ? prev.map((p) => p.mpn === item.mpn ? { ...p, qty: p.qty + 1 } : p)
        : [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (mpn) => {
    setCartItems((prev) => prev.filter((item) => item.mpn !== mpn));
  };

  const clearCart = () => setCartItems([]);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};
