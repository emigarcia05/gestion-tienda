"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AppModal from "@/components/shared/AppModal";
import { TEXT_WARNING_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export interface ImportProgressResult {
  creados: number;
  actualizados: number;
  eliminados: number;
  errores: string[];
}

type ImportResultModalState =
  | { type: "closed" }
  | { type: "result"; data: ImportProgressResult }
  | { type: "error"; message: string };

interface ImportResultContextValue {
  openResult: (result: ImportProgressResult) => void;
  openError: (message: string) => void;
  close: () => void;
}

const ImportResultContext = createContext<ImportResultContextValue | null>(null);

export function useImportResult() {
  const ctx = useContext(ImportResultContext);
  if (!ctx) throw new Error("useImportResult must be used within ImportResultProvider");
  return ctx;
}

async function descargarResumenAumentos(): Promise<void> {
  const res = await fetch("/api/import-lista-precios/resumen-pdf");
  if (!res.ok) {
    toast.error("No se pudo descargar el resumen de aumentos.");
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "resumen-aumentos-lista.pdf";
  enlace.click();
  URL.revokeObjectURL(url);
}

export function ImportResultProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ImportResultModalState>({ type: "closed" });
  const resumenDescargado = useRef(false);

  const openResult = useCallback((result: ImportProgressResult) => {
    setState({ type: "result", data: result });
  }, []);

  const openError = useCallback((message: string) => {
    setState({ type: "error", message });
  }, []);

  const close = useCallback(() => {
    setState({ type: "closed" });
  }, []);

  useEffect(() => {
    if (state.type !== "result") {
      resumenDescargado.current = false;
      return;
    }
    if (resumenDescargado.current) return;
    resumenDescargado.current = true;
    void descargarResumenAumentos();
  }, [state]);

  const open = state.type !== "closed";

  return (
    <ImportResultContext.Provider value={{ openResult, openError, close }}>
      {children}
      <Dialog open={open} onOpenChange={(open) => !open && close()}>
        <AppModal
          title={state.type === "error" ? "Error En La Importación" : "Resultado De Importación"}
          actions={
            <>
              {state.type === "result" ? (
                <Button type="button" variant="outline" onClick={() => void descargarResumenAumentos()}>
                  Descargar Resumen
                </Button>
              ) : null}
              <Button variant="default" onClick={close}>
                Cerrar
              </Button>
            </>
          }
        >
          {state.type === "error" && (
            <p className="text-destructive text-sm">{state.message}</p>
          )}
          {state.type === "result" && (
            <div className="space-y-4 text-sm">
              <ul className="grid gap-2">
                <li>
                  <span className="font-medium">CREADOS:</span> {state.data.creados}
                </li>
                <li>
                  <span className="font-medium">ACTUALIZADOS:</span> {state.data.actualizados}
                </li>
                {state.data.eliminados > 0 && (
                  <li>
                    <span className="font-medium">ELIMINADOS:</span> {state.data.eliminados}
                  </li>
                )}
              </ul>
              {state.data.errores.length > 0 && (
                <div>
                  <p className={cn("mb-1 font-medium", TEXT_WARNING_CLASS)}>
                    ADVERTENCIAS ({state.data.errores.length}):
                  </p>
                  <ul className="max-h-40 overflow-auto list-disc list-inside text-muted-foreground space-y-0.5">
                    {state.data.errores.slice(0, 20).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {state.data.errores.length > 20 && (
                      <li>… y {state.data.errores.length - 20} más</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </AppModal>
      </Dialog>
    </ImportResultContext.Provider>
  );
}
