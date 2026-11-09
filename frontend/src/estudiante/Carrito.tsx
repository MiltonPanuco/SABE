// Carrito de solicitud: altas desde el catálogo y bajas desde el horario.
// Vive solo en el navegador (sessionStorage); F5 lo envía como folio y el backend vuelve a validar todo.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Grupo, TipoTramite } from "../api/tipos";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "./Toast";

export interface ItemCarrito {
  grupo: Grupo;
  tipo: TipoTramite;
}

interface Carrito {
  items: ItemCarrito[];
  /** Movimiento del carrito para ese grupo, si lo hay. */
  buscar: (grupoId: number) => ItemCarrito | undefined;
  agregar: (grupo: Grupo, tipo: TipoTramite) => void;
  quitar: (grupoId: number) => void;
  vaciar: () => void;
  /** El cajón flotante del catálogo está abierto. */
  abierto: boolean;
  setAbierto: (abierto: boolean) => void;
}

const CarritoContext = createContext<Carrito | null>(null);

function leer(clave: string): ItemCarrito[] {
  try {
    const valor = JSON.parse(sessionStorage.getItem(clave) ?? "[]");
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

function guardar(clave: string, items: ItemCarrito[]) {
  try {
    sessionStorage.setItem(clave, JSON.stringify(items));
  } catch {
    // Sin almacenamiento: el carrito dura mientras la página esté abierta.
  }
}

export function CarritoProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const mostrarAviso = useToast();
  // Una clave por usuario para no mezclar carritos si dos alumnos usan la misma pestaña.
  const clave = `sabe.carrito.${usuario?.username ?? "anonimo"}`;
  const [items, setItems] = useState<ItemCarrito[]>(() => leer(clave));
  // Abierto de entrada como en stitch, salvo en celular, donde taparía buena parte del catálogo.
  const [abierto, setAbierto] = useState(() => window.matchMedia("(min-width: 640px)").matches);

  useEffect(() => guardar(clave, items), [clave, items]);

  const buscar = useCallback((grupoId: number) => items.find((i) => i.grupo.id === grupoId), [items]);

  const agregar = useCallback(
    (grupo: Grupo, tipo: TipoTramite) => {
      const nombre = grupo.materia.nombre;
      if (items.some((i) => i.grupo.id === grupo.id)) {
        mostrarAviso("Ya en la lista", `${nombre} ya fue agregada como solicitud.`);
        return;
      }
      setItems([...items, { grupo, tipo }]);
      mostrarAviso(tipo === "ALTA" ? "Alta añadida" : "Baja añadida", `${nombre} agregada al carrito.`);
    },
    [items, mostrarAviso],
  );

  const quitar = useCallback(
    (grupoId: number) => {
      setItems(items.filter((i) => i.grupo.id !== grupoId));
      mostrarAviso("Movimiento retirado", "Se eliminó la asignatura del carrito.");
    },
    [items, mostrarAviso],
  );

  const vaciar = useCallback(() => setItems([]), []);

  const valor = useMemo(
    () => ({ items, buscar, agregar, quitar, vaciar, abierto, setAbierto }),
    [items, buscar, agregar, quitar, vaciar, abierto],
  );
  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}

export function useCarrito(): Carrito {
  const carrito = useContext(CarritoContext);
  if (!carrito) throw new Error("useCarrito debe usarse dentro de <CarritoProvider>");
  return carrito;
}
