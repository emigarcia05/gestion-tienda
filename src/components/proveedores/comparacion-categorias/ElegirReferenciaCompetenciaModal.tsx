"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FiltroIndividualContainer } from "@/components/FilterBar";
import ModalTablaConFiltros, { type ColumnaModalTabla } from "@/components/shared/ModalTablaConFiltros";
import {
  asignarReferenciaCompetenciaAction,
  buscarReferenciaCompetenciaAction,
  listCompetidoresParaReferenciaAction,
} from "@/actions/comparacionCategorias";
import type {
  OpcionReferenciaCompetencia,
  ReferenciaCompetenciaComparacion,
} from "@/services/categoriasComparacion.service";
import { fmtPrecio } from "@/lib/format";
import {
  MODAL_COMP_CATEGORIAS_BUSQUEDA_MAX_WIDTH_CLASS,
  MODAL_COMP_CATEGORIAS_CELDA_DESCRIPCION_CLASS,
  MODAL_COMP_CATEGORIAS_CELDA_ENTIDAD_CLASS,
  MODAL_COMP_CATEGORIAS_CELDA_PRECIO_CLASS,
  MODAL_COMP_CATEGORIAS_FILTROS_STACK_CLASS,
  MODAL_COMP_CATEGORIAS_TABLA_COLUMN_WIDTHS_PCT,
} from "@/lib/comparacionCategoriasLayout";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subcategoriaId: string;
  onSuccess: (referencia: ReferenciaCompetenciaComparacion) => void;
}

type CompetidorOption = { id: string; nombre: string; prefijoProveedor: string | null };

export default function ElegirReferenciaCompetenciaModal({
  open,
  onOpenChange,
  subcategoriaId,
  onSuccess,
}: Props) {
  const [competidores, setCompetidores] = useState<CompetidorOption[]>([]);
  const [competenciaId, setCompetenciaId] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<OpcionReferenciaCompetencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rowsVisibles = rows;

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setCompetenciaId("");
      setQ("");
    });
    listCompetidoresParaReferenciaAction().then((result) => {
      if (result.ok && result.data) setCompetidores(result.data);
      else setCompetidores([]);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    const run = async () => {
      const result = await buscarReferenciaCompetenciaAction({
        q: q.trim() || undefined,
        competenciaId: competenciaId || undefined,
        subcategoriaId,
      });
      setLoading(false);
      if (result.ok && result.data) setRows(result.data);
      else {
        setRows([]);
        if (!result.ok && result.error) toast.error(result.error);
      }
    };
    debounceRef.current = setTimeout(run, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, q, competenciaId, subcategoriaId]);

  async function handleConfirmSingle(row: OpcionReferenciaCompetencia) {
    if (row.pxMostrar == null) {
      toast.error("Elegí una fila con precio disponible.");
      throw new Error("Sin precio");
    }

    setConfirmPending(true);
    try {
      const res = await asignarReferenciaCompetenciaAction(
        subcategoriaId,
        row.codTienda,
        row.competenciaId
      );
      if (!res.ok) {
        toast.error(res.error ?? "Error al asignar referencia.");
        throw new Error(res.error);
      }
      if (!res.data) {
        toast.error("No se recibió la referencia guardada.");
        throw new Error("Sin datos de referencia");
      }
      toast.success("Referencia de competencia agregada.");
      onSuccess(res.data);
    } finally {
      setConfirmPending(false);
    }
  }

  const filterContent = (
    <div className={MODAL_COMP_CATEGORIAS_FILTROS_STACK_CLASS}>
      <FiltroIndividualContainer
        className="w-full"
        activo={!!competenciaId}
        onLimpiar={() => setCompetenciaId("")}
      >
        <Select
          value={competenciaId || "none"}
          onValueChange={(v) => setCompetenciaId(v === "none" ? "" : v)}
        >
          <SelectTrigger className="input-filtro-unificado w-full">
            <SelectValue placeholder="COMPETIDOR" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">TODOS LOS COMPETIDORES</SelectItem>
            {competidores.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.prefijoProveedor ? `[${c.prefijoProveedor}] ` : ""}
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FiltroIndividualContainer>

      <FiltroIndividualContainer className="w-full" activo={!!q.trim()} onLimpiar={() => setQ("")}>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="BUSCAR POR DESCRIPCIÓN O CÓDIGO TIENDA..."
          className="input-filtro-unificado w-full min-w-0"
        />
      </FiltroIndividualContainer>
    </div>
  );

  const columns: ColumnaModalTabla<OpcionReferenciaCompetencia>[] = [
    {
      key: "competidor",
      label: "COMPETIDOR",
      className: MODAL_COMP_CATEGORIAS_CELDA_ENTIDAD_CLASS,
      render: (row) => row.competenciaNombre,
    },
    {
      key: "descripcion",
      label: "DESCRIPCIÓN",
      className: MODAL_COMP_CATEGORIAS_CELDA_DESCRIPCION_CLASS,
      render: (row) => (
        <span className="block truncate" title={row.descripcionTienda ?? row.codTienda}>
          {row.descripcionTienda ?? row.codTienda}
        </span>
      ),
    },
    {
      key: "precio",
      label: "PRECIO",
      className: MODAL_COMP_CATEGORIAS_CELDA_PRECIO_CLASS,
      render: (row) =>
        row.pxMostrar != null ? `$${fmtPrecio(row.pxMostrar)}` : "—",
    },
  ];

  return (
    <ModalTablaConFiltros<OpcionReferenciaCompetencia>
      open={open}
      onClose={() => onOpenChange(false)}
      selectionMode="singleConfirm"
      showSingleConfirmCheckbox
      title="Agregar Referencia De Competencia"
      filterContent={filterContent}
      columns={columns}
      rows={rowsVisibles}
      getRowId={(row) => `${row.codTienda}:${row.competenciaId}`}
      onConfirmSingle={handleConfirmSingle}
      confirmSingleLabel="AGREGAR REFERENCIA"
      confirmPending={confirmPending}
      loading={loading}
      emptyMessage="NO HAY REFERENCIAS O NO COINCIDEN LOS FILTROS."
      count={rowsVisibles.length}
      contentClassName={MODAL_COMP_CATEGORIAS_BUSQUEDA_MAX_WIDTH_CLASS}
      tableColumnWidthsPct={MODAL_COMP_CATEGORIAS_TABLA_COLUMN_WIDTHS_PCT}
    />
  );
}
