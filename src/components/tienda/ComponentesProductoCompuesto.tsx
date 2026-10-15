"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ModalSiNoChoice from "@/components/shared/ModalSiNoChoice";
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import { PRODUCTO_TIENDA_GRID_CLASS } from "@/components/tienda/ProductoTiendaCampos";
import SeleccionarComponenteCompuestoModal from "@/components/tienda/SeleccionarComponenteCompuestoModal";
import {
  getComposicionProductoTiendaAction,
  guardarComponentesCompuestoAction,
  setProductoCompuestoTiendaAction,
} from "@/actions/listaProductos";
import {
  costoProductoCompuesto,
  type ComponenteCandidatoItem,
  type ComponenteCompuestoItem,
} from "@/lib/productoCompuesto";
import { formatCantidadInputValor, parseCantidadUnDecimal } from "@/lib/cantidadUnDecimal";
import { fmtPrecio } from "@/lib/format";
import { TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const ROW_ICON_BTN_CLASS = cn(TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS, "h-8 w-8 min-h-8 max-h-8");

/** Fila en edición: `cantidadInput` es el texto del input (`0,5`). */
type FilaComponente = ComponenteCompuestoItem & { cantidadInput: string };

function aFila(c: ComponenteCompuestoItem): FilaComponente {
  return { ...c, cantidadInput: formatCantidadInputValor(c.cantidad) };
}

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

  const costoTotal = costoProductoCompuesto(filas);
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
      const cantidad = parseCantidadUnDecimal(f.cantidadInput);
      if (cantidad == null) {
        toast.error(`Cantidad inválida en «${f.descripcion || f.codTienda}» (mayor a 0, hasta 1 decimal).`);
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
        <Table variant="compact" scrollX={false} className="table-fixed w-full">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20 text-center">COD.</TableHead>
              <TableHead>DESCRIPCIÓN</TableHead>
              <TableHead className="w-20 text-center">CANT.</TableHead>
              <TableHead className="w-28 text-center">COSTO UN.</TableHead>
              <TableHead className="w-28 text-center">SUBTOTAL</TableHead>
              <TableHead className="w-14 text-center" aria-label="Quitar" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Cargando componentes...
                  </div>
                </TableCell>
              </TableRow>
            ) : filas.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <TableEmptyState message="SIN COMPONENTES." placement="panel" />
                </TableCell>
              </TableRow>
            ) : (
              filas.map((f) => (
                <TableRow key={f.codTienda}>
                  <TableCell className="celda-datos celda-mono text-center text-xs">{f.codTienda}</TableCell>
                  <TableCell className="celda-datos min-w-0">
                    <span className="block truncate text-xs" title={f.descripcion}>
                      {f.descripcion}
                    </span>
                  </TableCell>
                  <TableCell className="celda-datos text-center">
                    <Input
                      value={f.cantidadInput}
                      onChange={(e) => editarCantidad(f.codTienda, e.target.value)}
                      onBlur={() => confirmarCantidad(f.codTienda)}
                      inputMode="decimal"
                      className="h-8 text-center tabular-nums"
                      aria-label={`Cantidad de ${f.descripcion || f.codTienda}`}
                      disabled={bloqueado}
                    />
                  </TableCell>
                  <TableCell className="celda-datos celda-numero tabular-nums text-center">
                    ${fmtPrecio(f.costoUnitario)}
                  </TableCell>
                  <TableCell className="celda-datos celda-numero tabular-nums text-center">
                    ${fmtPrecio((parseCantidadUnDecimal(f.cantidadInput) ?? 0) * f.costoUnitario)}
                  </TableCell>
                  <TableCell className="text-center">
                    {puedeEditar ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={ROW_ICON_BTN_CLASS}
                        aria-label={`Quitar ${f.descripcion || f.codTienda}`}
                        disabled={bloqueado}
                        onClick={() => quitar(f.codTienda)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="text-right text-xs font-bold uppercase">
                COSTO COMPUESTO
              </TableCell>
              <TableCell className="celda-numero tabular-nums text-center font-bold">
                ${fmtPrecio(costoTotal)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
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
