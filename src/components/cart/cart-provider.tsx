"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";

import type { CartItem, CartProductInput } from "@/types/cart";

const STORAGE_KEY = "hidro-leufu-cart-v1";

type CartState = { items: CartItem[] };
type CartAction =
  | { type: "hydrate"; items: CartItem[] }
  | { type: "add"; item: CartProductInput }
  | { type: "increment"; productoId: string; presentacionId: string }
  | { type: "decrement"; productoId: string; presentacionId: string }
  | { type: "remove"; productoId: string; presentacionId: string }
  | { type: "clear" };

const initialState: CartState = { items: [] };

function sameItem(item: CartItem, productoId: string, presentacionId: string) {
  return item.productoId === productoId && item.presentacionId === presentacionId;
}

function cartReducer(state: CartState, action: CartAction): CartState {
  if (action.type === "hydrate") return { items: action.items };
  if (action.type === "clear") return initialState;
  if (action.type === "add") {
    const existing = state.items.find((item) => sameItem(item, action.item.productoId, action.item.presentacionId));
    return existing
      ? { items: state.items.map((item) => sameItem(item, action.item.productoId, action.item.presentacionId) ? { ...item, cantidad: item.cantidad + 1 } : item) }
      : { items: [...state.items, { ...action.item, cantidad: 1 }] };
  }
  if (action.type === "increment") return { items: state.items.map((item) => sameItem(item, action.productoId, action.presentacionId) ? { ...item, cantidad: item.cantidad + 1 } : item) };
  if (action.type === "decrement") return { items: state.items.flatMap((item) => !sameItem(item, action.productoId, action.presentacionId) ? [item] : item.cantidad > 1 ? [{ ...item, cantidad: item.cantidad - 1 }] : []) };
  return { items: state.items.filter((item) => !sameItem(item, action.productoId, action.presentacionId)) };
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return typeof item.productoId === "string" && typeof item.slug === "string" && typeof item.presentacionId === "string" && typeof item.nombre === "string" && typeof item.presentacionNombre === "string" && typeof item.unidad === "string" && typeof item.imageFallback === "string" && Number.isInteger(item.cantidad) && item.cantidad > 0 && typeof item.cantidadPresentacion === "number" && Number.isFinite(item.precioFinalReferencia);
}

type CartContextValue = {
  items: CartItem[];
  cantidadTotal: number;
  totalEstimado: number;
  isHydrated: boolean;
  agregarItem: (item: CartProductInput) => void;
  incrementar: (productoId: string, presentacionId: string) => void;
  disminuir: (productoId: string, presentacionId: string) => void;
  eliminar: (productoId: string, presentacionId: string) => void;
  vaciar: () => void;
  obtenerCantidad: (productoId: string, presentacionId: string) => number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(parsed)) dispatch({ type: "hydrate", items: parsed.filter(isCartItem) });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (isHydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  }, [isHydrated, state.items]);

  const value = useMemo<CartContextValue>(() => ({
    items: state.items,
    cantidadTotal: state.items.reduce((total, item) => total + item.cantidad, 0),
    totalEstimado: state.items.reduce((total, item) => total + item.cantidad * item.precioFinalReferencia, 0),
    isHydrated,
    agregarItem: (item) => dispatch({ type: "add", item }),
    incrementar: (productoId, presentacionId) => dispatch({ type: "increment", productoId, presentacionId }),
    disminuir: (productoId, presentacionId) => dispatch({ type: "decrement", productoId, presentacionId }),
    eliminar: (productoId, presentacionId) => dispatch({ type: "remove", productoId, presentacionId }),
    vaciar: () => dispatch({ type: "clear" }),
    obtenerCantidad: (productoId, presentacionId) => state.items.find((item) => sameItem(item, productoId, presentacionId))?.cantidad ?? 0,
  }), [isHydrated, state.items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe utilizarse dentro de CartProvider.");
  return context;
}
