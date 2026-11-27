"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppModal from "@/components/shared/AppModal";
import {
  asignarFamiliaPrioridadAction,
  listarFamiliasParaPrioridadAction,
} from "@/actions/comparacionCategorias";
import type { FamiliaPrioridadComparacion } from "@/services/categoriasComparacion.service";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subcategoriaId: string;
  excluirIds: string[];
  onSuccess: (familia: FamiliaPrioridadComparacion) => void;
}

type FamiliaOpcion = { id: string; nombre: string };

export default function AgregarFamiliaPrioridadModal({
  open,
  onOpenChange,
  subcategoriaId,
  excluirIds,
  onSuccess,
}: Props) {
  const [familias, setFamilias] = useState<FamiliaOpcion[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setLoading(true);
    listarFamiliasParaPrioridadAction().then((result) => {
      setFamilias(result.ok && result.data ? result.data : []);
      if (!result.ok) toast.error(result.error);
      setLoading(false);
    });
  }, [open]);

  const excluidas = useMemo(() => new Set(excluirIds), [excluirIds]);
  const visibles = useMemo(() => {
    const texto = q.trim().toLocaleUpperCase("es-AR");
    return familias.filter((familia) => {
      if (excluidas.has(familia.id)) return false;
      if (!texto) return true;
      return familia.nombre.toLocaleUpperCase("es-AR").includes(texto);
    });
  }, [excluidas, familias, q]);

  async function agregar(familiaId: string) {
    if (pendingId) return;
    setPendingId(familiaId);
    try {
      const result = await asignarFamiliaPrioridadAction(subcategoriaId, familiaId);
      if (!result.ok || !result.data) {
        toast.error(result.ok ? "No se pudo agregar la familia." : result.error);
        return;
      }
      toast.success("Familia agregada a la prioridad de venta.");
      onSuccess(result.data);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppModal
        title="AGREGAR FAMILIA"
        size="md"
        scrollBody={false}
        actions={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        }
      >
        <div className="flex h-[24rem] min-h-0 flex-col gap-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="BUSCAR FAMILIA..."
            autoFocus
            disabled={loading}
          />
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
            {loading ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Cargando familias…</p>
            ) : visibles.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {familias.length === 0
                  ? "No hay familias cargadas."
                  : "No hay familias para agregar."}
              </p>
            ) : (
              visibles.map((familia) => (
                <button
                  key={familia.id}
                  type="button"
                  className="flex w-full border-b px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                  disabled={pendingId != null}
                  onClick={() => void agregar(familia.id)}
                >
                  {familia.nombre}
                </button>
              ))
            )}
          </div>
        </div>
      </AppModal>
    </Dialog>
  );
}
