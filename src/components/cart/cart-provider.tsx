"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";

import { getCartLineSubtotal, getCartQuantityStep, isValidCartQuantity } from "@/lib/cart-quantity";
import type { CartItem, CartProductInput } from "@/types/cart";

const STORAGE_KEY = "hidro-leufu-cart-v1";

type CartState = { items: CartItem[] };
export type ModoCargaCarrito = "fusionar" | "reemplazar";
export type LineaCargaCarrito = { item: CartProductInput; cantidad: number };
export type ResultadoCargaCarrito = {
  agregadas: number;
  fusionadas: number;
  omitidas: number;
};
type CartAction =
  | { type: "hydrate"; items: CartItem[] }
  | { type: "add"; item: CartProductInput; cantidad?: number }
  | { type: "increment"; productoId: string; presentacionId: string }
  | { type: "decrement"; productoId: string; presentacionId: string }
  | { type: "set-quantity"; productoId: string; presentacionId: string; cantidad: number }
  | { type: "remove"; productoId: string; presentacionId: string }
  | { type: "load-lines"; items: CartItem[] }
  | { type: "clear" };

const initialState: CartState = { items: [] };

function sameItem(item: CartItem, productoId: string, presentacionId: string) {
  return item.productoId === productoId && item.presentacionId === presentacionId;
}

function cargarLineasEnEstado(actuales: readonly CartItem[], lineas: readonly LineaCargaCarrito[], modo: ModoCargaCarrito) {
  const items = modo === "reemplazar" ? [] : [...actuales];
  let agregadas = 0;
  let fusionadas = 0;
  let omitidas = 0;

  for (const linea of lineas) {
    if (!isValidCartQuantity(linea.item, linea.cantidad)) {
      omitidas += 1;
      continue;
    }

    const index = items.findIndex((item) => sameItem(item, linea.item.productoId, linea.item.presentacionId));
    if (index === -1) {
      items.push({ ...linea.item, cantidad: linea.cantidad });
      agregadas += 1;
      continue;
    }

    const cantidadFusionada = items[index].cantidad + linea.cantidad;
    if (!isValidCartQuantity(linea.item, cantidadFusionada)) {
      omitidas += 1;
      continue;
    }

    items[index] = { ...linea.item, cantidad: cantidadFusionada };
    fusionadas += 1;
  }

  return { items, resultado: { agregadas, fusionadas, omitidas } satisfies ResultadoCargaCarrito };
}

function cartReducer(state: CartState, action: CartAction): CartState {
  if (action.type === "hydrate") return { items: action.items };
  if (action.type === "clear") return initialState;
  if (action.type === "load-lines") return { items: action.items };
  if (action.type === "add") {
    const existing = state.items.find((item) => sameItem(item, action.item.productoId, action.item.presentacionId));
    return existing
      ? { items: state.items.map((item) => {
        if (!sameItem(item, action.item.productoId, action.item.presentacionId)) return item;
        if (action.cantidad !== undefined) {
          return isValidCartQuantity(item, action.cantidad) ? { ...item, cantidad: action.cantidad } : item;
        }
        const nextQuantity = item.cantidad + getCartQuantityStep(item);
        return isValidCartQuantity(item, nextQuantity) ? { ...item, cantidad: nextQuantity } : item;
      }) }
      : isValidCartQuantity(action.item, action.cantidad ?? 1)
        ? { items: [...state.items, { ...action.item, cantidad: action.cantidad ?? 1 }] }
        : state;
  }
  if (action.type === "increment") return { items: state.items.map((item) => {
    if (!sameItem(item, action.productoId, action.presentacionId)) return item;
    const nextQuantity = item.cantidad + getCartQuantityStep(item);
    return isValidCartQuantity(item, nextQuantity) ? { ...item, cantidad: nextQuantity } : item;
  }) };
  if (action.type === "decrement") return { items: state.items.flatMap((item) => {
    if (!sameItem(item, action.productoId, action.presentacionId)) return [item];
    const nextQuantity = item.cantidad - getCartQuantityStep(item);
    return isValidCartQuantity(item, nextQuantity) ? [{ ...item, cantidad: nextQuantity }] : [];
  }) };
  if (action.type === "set-quantity") return { items: state.items.map((item) => {
    if (!sameItem(item, action.productoId, action.presentacionId)) return item;
    return isValidCartQuantity(item, action.cantidad) ? { ...item, cantidad: action.cantidad } : item;
  }) };
  return { items: state.items.filter((item) => !sameItem(item, action.productoId, action.presentacionId)) };
}

type StoredCartItem = Omit<CartItem, "cantidad"> & { cantidad?: number };

function isStoredCartItem(value: unknown): value is StoredCartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<StoredCartItem>;
  return typeof item.productoId === "string" && typeof item.slug === "string" && typeof item.presentacionId === "string" && typeof item.nombre === "string" && typeof item.presentacionNombre === "string" && typeof item.unidad === "string" && typeof item.imageFallback === "string" && typeof item.cantidadPresentacion === "number" && Number.isFinite(item.cantidadPresentacion) && typeof item.precioFinalReferencia === "number" && Number.isFinite(item.precioFinalReferencia);
}

function normalizeCartItem(value: unknown): CartItem | null {
  if (!isStoredCartItem(value)) return null;
  const cantidad = value.cantidad ?? 1;
  if (!isValidCartQuantity(value, cantidad)) return null;
  return { ...value, cantidad };
}

type CartContextValue = {
  items: CartItem[];
  cantidadTotal: number;
  numeroItems: number;
  totalEstimado: number;
  isHydrated: boolean;
  agregarItem: (item: CartProductInput, cantidadInicial?: number) => void;
  incrementar: (productoId: string, presentacionId: string) => void;
  disminuir: (productoId: string, presentacionId: string) => void;
  setQuantity: (productoId: string, presentacionId: string, cantidad: number) => void;
  eliminar: (productoId: string, presentacionId: string) => void;
  vaciar: () => void;
  cargarLineas: (lineas: readonly LineaCargaCarrito[], modo: ModoCargaCarrito) => ResultadoCargaCarrito;
  obtenerCantidad: (productoId: string, presentacionId: string) => number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(parsed)) dispatch({ type: "hydrate", items: parsed.flatMap((item) => {
        const normalizado = normalizeCartItem(item);
        return normalizado ? [normalizado] : [];
      }) });
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
    numeroItems: state.items.length,
    totalEstimado: state.items.reduce((total, item) => total + getCartLineSubtotal(item), 0),
    isHydrated,
    agregarItem: (item, cantidadInicial) => dispatch({ type: "add", item, cantidad: cantidadInicial }),
    incrementar: (productoId, presentacionId) => dispatch({ type: "increment", productoId, presentacionId }),
    disminuir: (productoId, presentacionId) => dispatch({ type: "decrement", productoId, presentacionId }),
    setQuantity: (productoId, presentacionId, cantidad) => dispatch({ type: "set-quantity", productoId, presentacionId, cantidad }),
    eliminar: (productoId, presentacionId) => dispatch({ type: "remove", productoId, presentacionId }),
    vaciar: () => dispatch({ type: "clear" }),
    cargarLineas: (lineas, modo) => {
      const { items, resultado } = cargarLineasEnEstado(state.items, lineas, modo);
      dispatch({ type: "load-lines", items });
      return resultado;
    },
    obtenerCantidad: (productoId, presentacionId) => state.items.find((item) => sameItem(item, productoId, presentacionId))?.cantidad ?? 0,
  }), [isHydrated, state.items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe utilizarse dentro de CartProvider.");
  return context;
}
