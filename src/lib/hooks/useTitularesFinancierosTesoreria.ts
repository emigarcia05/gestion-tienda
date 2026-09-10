"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listTitularesFinancierosAction } from "@/actions/globalPersonal";
import { opcionesTitularTesoreria } from "@/lib/cajasTesoreriaTitulares";

/** Nombres de `global_personal` con `titular_financiero = true`. */
export function useTitularesFinancierosTesoreria(
  open: boolean,
  valorActual?: string | null
): string[] {
  const [titulares, setTitulares] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void listTitularesFinancierosAction().then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        toast.error(res.error ?? "No se pudieron cargar los titulares.");
        setTitulares(opcionesTitularTesoreria([], valorActual));
        return;
      }
      setTitulares(opcionesTitularTesoreria(res.data, valorActual));
    });
    return () => {
      cancelled = true;
    };
  }, [open, valorActual]);

  return titulares;
}
