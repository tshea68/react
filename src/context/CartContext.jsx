// src/context/CartContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const raw = localStorage.getItem("cartItems");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // persist cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("cartItems", JSON.stringify(cartItems));
    } catch {
      /* ignore */
    }
  }, [cartItems]);

  function addToCart(newItem) {
    setCartItems((prev) => {
      // match by mpn + refurb flag so refurb and OEM can both exist
      const idx = prev.findIndex(
        (it) => it.mpn === newItem.mpn && it.is_refurb === newItem.is_refurb
      );

      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          qty: copy[idx].qty + newItem.qty,
        };
        return copy;
      }

      return [...prev, newItem];
    });
  }

  function updateQty(mpn, is_refurb, qty) {
    setCartItems((prev) =>
      prev.map((it) =>
        it.mpn === mpn && it.is_refurb === is_refurb
          ? { ...it, qty: Number(qty) }
          : it
      )
    );
  }

  function removeFromCart(mpn, is_refurb) {
    setCartItems((prev) =>
      prev.filter(
        (it) => !(it.mpn === mpn && it.is_refurb === is_refurb)
      )
    );
  }

  function clearCart() {
    setCartItems([]);
  }

  return (
    <CartContext.Provider
      value={{ cartItems, addToCart, updateQty, removeFromCart, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
