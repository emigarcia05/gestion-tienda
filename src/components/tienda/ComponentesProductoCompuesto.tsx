"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import { PRODUCTO_TIENDA_GRID_CLASS } from "@/components/tienda/ProductoTiendaCampos";
import SeleccionarComponenteCompuestoModal from "@/components/tienda/SeleccionarComponenteCompuestoModal";
import TablaComponentesCompuesto, {
  aFilaComponente as aFila,
  type FilaComponente,
} from "@/components/tienda/TablaComponentesCompuesto";
import {
  getComposicionProductoTiendaAction,
  guardarComponentesCompuestoAction,
  setProductoCompuestoTiendaAction,
} from "@/actions/listaProductos";
import { parseCantidadComponente, type ComponenteCandidatoItem } from "@/lib/productoCompuesto";
import { cn } from "@/lib/utils";

/**
 * Editar producto · PRODUCTO COMPUESTO. Marca el ítem como kit (siempre PROD. PROPIO) y edita sus
 * componentes de `prod_lista` con su cantidad. Cada cambio se guarda al instante (lista completa).
 */
export default function ComponentesProductoCompuesto({
  codTienda,
  esCompuestoInicial,
  puedeEditar,
  onCompuestoChange,
}: {
  codTienda: string;
  esCompuestoInicial: boolean;
  puedeEditar: boolean;
  onCompuestoChange: (esCompuesto: boolean) => void;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [esCompuesto, setEsCompuesto] = useState(esCompuestoInicial);
  const [esComponenteDe, setEsComponenteDe] = useState(0);
  const [filas, setFilas] = useState<FilaComponente[]>([]);
  const [guardadas, setGuardadas] = useState<FilaComponente[]>([]);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let activo = true;
    void getComposicionProductoTiendaAction(codTienda).then((res) => {
      if (!activo) return;
      if (res.ok) {
        const iniciales = res.data.componentes.map(aFila);
        setEsCompuesto(res.data.esProductoCompuesto);
        setEsComponenteDe(res.data.esComponenteDe);
        setFilas(iniciales);
        setGuardadas(iniciales);
      } else {
        toast.error(res.error);
      }
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [codTienda]);

  const bloqueado = !puedeEditar || isPending || cargando;

  function cambiarCompuesto(siguiente: boolean) {
    startTransition(async () => {
      const res = await setProductoCompuestoTiendaAction({ codTienda, esProductoCompuesto: siguiente });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEsCompuesto(res.data.esProductoCompuesto);
      if (!res.data.esProductoCompuesto) {
        setFilas([]);
        setGuardadas([]);
      }
      onCompuestoChange(res.data.esProductoCompuesto);
      toast.success(
        res.data.esProductoCompuesto ? "Marcado como producto compuesto." : "Ya no es producto compuesto."
      );
      router.refresh();
    });
  }

  function persistir(siguientes: FilaComponente[], mensaje: string) {
    const componentes: { codTienda: string; cantidad: number }[] = [];
    for (const f of siguientes) {
      const cantidad = parseCantidadComponente(f.cantidadInput);
      if (cantidad == null) {
        toast.error(`Cantidad inválida en «${f.descripcion || f.codTienda}» (mayor a 0, hasta 4 decimales).`);
        setFilas(guardadas);
        return;
      }
      componentes.push({ codTienda: f.codTienda, cantidad });
    }
    setFilas(siguientes);
    startTransition(async () => {
      const res = await guardarComponentesCompuestoAction({ codTienda, componentes });
      if (!res.ok) {
        toast.error(res.error);
        setFilas(guardadas);
        return;
      }
      const normalizadas = siguientes.map((f, i) => aFila({ ...f, cantidad: componentes[i].cantidad }));
      setFilas(normalizadas);
      setGuardadas(normalizadas);
      toast.success(mensaje);
      router.refresh();
    });
  }

  function agregar(item: ComponenteCandidatoItem) {
    setSelectorAbierto(false);
    persistir(
      [...filas, aFila({ ...item, cantidad: 1 })],
      `Componente agregado: ${item.descripcion || item.codTienda}`
    );
  }

  function quitar(codComponente: string) {
    persistir(
      filas.filter((f) => f.codTienda !== codComponente),
      "Componente quitado."
    );
  }

  function editarCantidad(codComponente: string, valor: string) {
    setFilas((prev) =>
      prev.map((f) => (f.codTienda === codComponente ? { ...f, cantidadInput: valor } : f))
    );
  }

  function confirmarCantidad(codComponente: string) {
    const fila = filas.find((f) => f.codTienda === codComponente);
    const guardada = guardadas.find((f) => f.codTienda === codComponente);
    if (!fila || !guardada || fila.cantidadInput === guardada.cantidadInput) return;
    persistir(filas, "Cantidad guardada.");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={cn(PRODUCTO_TIENDA_GRID_CLASS, "items-center")}>
        <ModalSiNoChoice
          label="PROD. COMPUESTO"
          value={esCompuesto}
          onChange={cambiarCompuesto}
          disabled={bloqueado || (!esCompuesto && esComponenteDe > 0)}
        />
        <Button
          type="button"
          variant="default"
          className="w-full gap-2"
          disabled={bloqueado || !esCompuesto}
          onClick={() => setSelectorAbierto(true)}
        >
          <Plus aria-hidden />
          Agregar Componente
        </Button>
      </div>
      {!esCompuesto && esComponenteDe > 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          Es componente de {esComponenteDe} producto(s) compuesto(s): no puede ser compuesto.
        </p>
      ) : null}
      {esCompuesto ? (
        <TablaComponentesCompuesto
          filas={filas}
          cargando={cargando}
          bloqueado={bloqueado}
          puedeQuitar={puedeEditar}
          onCantidadChange={editarCantidad}
          onCantidadBlur={confirmarCantidad}
          onQuitar={quitar}
        />
      ) : null}
      {selectorAbierto ? (
        <SeleccionarComponenteCompuestoModal
          codTienda={codTienda}
          excluir={filas.map((f) => f.codTienda)}
          onSeleccionar={agregar}
          onClose={() => setSelectorAbierto(false)}
        />
      ) : null}
    </div>
  );
}
