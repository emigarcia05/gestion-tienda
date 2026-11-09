"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  eliminarTextoFormaPagoPresupuestoAction,
  guardarTextoFormaPagoPresupuestoAction,
  moverTextoFormaPagoPresupuestoAction,
} from "@/actions/formasPagoPresupuesto";
import AppModal from "@/components/shared/AppModal";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import FiltroMultiSelect from "@/components/shared/FiltroMultiSelect";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import PorcentajeEnteroMaskInput from "@/components/shared/PorcentajeEnteroMaskInput";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { textoFormasPagoPresupuesto } from "@/lib/facturaFormasPagoPdf";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import type { TextoFormaPagoPresupuesto } from "@/services/formasPagoPresupuesto.service";

type CuotaOpcion = { id: string; cuotas: string };

type FormaOpcion = { id: string; nombre: string; cuotas: CuotaOpcion[] };

type Borrador = {
  id?: string;
  descuento: number;
  pagoIds: string[];
  cuotaIdsPorPago: Record<string, string[]>;
};

const BORRADOR_NUEVO: Borrador = { descuento: 0, pagoIds: [], cuotaIdsPorPago: {} };

export default function FormasPagoPresupuestoPageClient({
  filasIniciales,
  formas,
  esEditor,
}: {
  filasIniciales: TextoFormaPagoPresupuesto[];
  formas: FormaOpcion[];
  esEditor: boolean;
}) {
  const [filas, setFilas] = useState(filasIniciales);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [borrar, setBorrar] = useState<TextoFormaPagoPresupuesto | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const opciones = formas.map((forma) => ({ value: forma.id, label: forma.nombre }));
  const formasConCuotas = borrador
    ? borrador.pagoIds
        .map((pagoId) => formas.find((forma) => forma.id === pagoId))
        .filter((forma): forma is FormaOpcion => Boolean(forma && forma.cuotas.length > 0))
    : [];
  const cuotasCompletas = formasConCuotas.every(
    (forma) => (borrador?.cuotaIdsPorPago[forma.id]?.length ?? 0) > 0
  );
  const puedeGuardar =
    esEditor && !ocupado && Boolean(borrador) && (borrador?.pagoIds.length ?? 0) > 0 && cuotasCompletas;

  async function aplicar(res: Awaited<ReturnType<typeof guardarTextoFormaPagoPresupuestoAction>>) {
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setFilas(res.data);
    return true;
  }

  async function guardar() {
    if (!borrador || !puedeGuardar) return;
    setOcupado(true);
    const res = await guardarTextoFormaPagoPresupuestoAction({
      id: borrador.id,
      descuento: borrador.descuento,
      vinculos: borrador.pagoIds.map((pagoId) => ({
        pagoId,
        cuotaIds:
          (formas.find((forma) => forma.id === pagoId)?.cuotas.length ?? 0) > 0
            ? (borrador.cuotaIdsPorPago[pagoId] ?? [])
            : [],
      })),
    });
    setOcupado(false);
    if (await aplicar(res)) {
      toast.success(borrador.id ? "Ítem actualizado." : "Ítem creado.");
      setBorrador(null);
    }
  }

  async function confirmarBaja() {
    if (!borrar || ocupado) return;
    setOcupado(true);
    const res = await eliminarTextoFormaPagoPresupuestoAction({ id: borrar.id });
    setOcupado(false);
    if (await aplicar(res)) {
      toast.success("Ítem eliminado.");
      setBorrar(null);
    }
  }

  async function mover(id: string, direccion: "subir" | "bajar") {
    if (!esEditor || ocupado) return;
    setOcupado(true);
    const res = await moverTextoFormaPagoPresupuestoAction({ id, direccion });
    setOcupado(false);
    if (!(await aplicar(res))) return;
  }

  return (
    <>
      <ClassicFilteredTableLayout
        title="Administrador"
        subtitle="Formas de Pago en Presupuesto"
        actions={
          esEditor ? (
            <ToolbarActionButton
              label="Nuevo Ítem"
              icon={<Plus />}
              onClick={() => setBorrador(BORRADOR_NUEVO)}
              disabled={ocupado}
            />
          ) : null
        }
      >
        <div className="contenedor-tabla-gestion min-h-0 flex-1">
          <Table variant="compact" className="w-full">
            <colgroup>
              <col className="w-[28%]" />
              <col />
              <col className="w-[18%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>DESC.</TableHead>
                <TableHead>FORMAS DE PAGO</TableHead>
                <TableHead className="text-center">ACCIONES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Sin ítems.
                  </TableCell>
                </TableRow>
              ) : (
                filas.map((fila, indice) => (
                  <TableRow key={fila.id}>
                    <TableCell className="font-medium">{fila.descuento}%</TableCell>
                    <TableCell>{textoFormasPagoPresupuesto(fila.formas)}</TableCell>
                    <TableCell>
                      <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          aria-label="Subir"
                          disabled={!esEditor || ocupado || indice === 0}
                          onClick={() => void mover(fila.id, "subir")}
                        >
                          <ChevronUp className={TABLE_ROW_ACTION_ICON_CLASS} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          aria-label="Bajar"
                          disabled={!esEditor || ocupado || indice === filas.length - 1}
                          onClick={() => void mover(fila.id, "bajar")}
                        >
                          <ChevronDown className={TABLE_ROW_ACTION_ICON_CLASS} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          aria-label="Editar"
                          disabled={!esEditor || ocupado}
                          onClick={() =>
                            setBorrador({
                              id: fila.id,
                              descuento: fila.descuento,
                              pagoIds: fila.formas.map((forma) => forma.pagoId),
                              cuotaIdsPorPago: Object.fromEntries(
                                fila.formas
                                  .filter((forma) => forma.cuotas.length > 0)
                                  .map((forma) => [forma.pagoId, forma.cuotas.map((cuota) => cuota.cuotaId)])
                              ),
                            })
                          }
                        >
                          <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                          aria-label="Eliminar"
                          disabled={!esEditor || ocupado}
                          onClick={() => setBorrar(fila)}
                        >
                          <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ClassicFilteredTableLayout>

      <Dialog open={borrador !== null} onOpenChange={(abierto) => !abierto && !ocupado && setBorrador(null)}>
        {borrador ? (
          <AppModal
            title={borrador.id ? "EDITAR ÍTEM" : "NUEVO ÍTEM"}
            size="md"
            actions={
              <>
                <Button type="button" variant="outline" disabled={ocupado} onClick={() => setBorrador(null)}>
                  Cancelar
                </Button>
                <Button type="button" disabled={!puedeGuardar} onClick={() => void guardar()}>
                  Guardar
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <ModalMicroLabel>DESC.</ModalMicroLabel>
                <PorcentajeEnteroMaskInput
                  className="flex h-9 items-center rounded-md border border-primary bg-transparent"
                  value={borrador.descuento}
                  onValueChange={(descuento) => setBorrador({ ...borrador, descuento })}
                  min={0}
                  max={100}
                  autoFocus
                  disabled={ocupado}
                  aria-label="DESC."
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <ModalMicroLabel>FORMAS DE PAGO</ModalMicroLabel>
                <FiltroMultiSelect
                  opciones={opciones}
                  selected={borrador.pagoIds}
                  onChange={(pagoIds) =>
                    setBorrador({
                      ...borrador,
                      pagoIds,
                      cuotaIdsPorPago: Object.fromEntries(
                        pagoIds
                          .filter((pagoId) => borrador.cuotaIdsPorPago[pagoId])
                          .map((pagoId) => [pagoId, borrador.cuotaIdsPorPago[pagoId] ?? []])
                      ),
                    })
                  }
                  placeholder="ELEGIR"
                  ariaLabel="Formas de pago"
                  disabled={ocupado}
                />
              </div>
              {formasConCuotas.map((forma) => (
                <div key={forma.id} className="flex flex-col gap-1.5">
                  <ModalMicroLabel>
                    {formasConCuotas.length === 1 ? "CANT. CUOTAS" : `CANT. CUOTAS · ${forma.nombre}`}
                  </ModalMicroLabel>
                  <FiltroMultiSelect
                    opciones={forma.cuotas.map((cuota) => ({ value: cuota.id, label: cuota.cuotas }))}
                    selected={borrador.cuotaIdsPorPago[forma.id] ?? []}
                    onChange={(cuotaIds) =>
                      setBorrador({
                        ...borrador,
                        cuotaIdsPorPago: { ...borrador.cuotaIdsPorPago, [forma.id]: cuotaIds },
                      })
                    }
                    placeholder="CANT. CUOTAS"
                    ariaLabel={`Cuotas de ${forma.nombre}`}
                    disabled={ocupado}
                  />
                </div>
              ))}
            </div>
          </AppModal>
        ) : null}
      </Dialog>

      <Dialog open={borrar !== null} onOpenChange={(abierto) => !abierto && !ocupado && setBorrar(null)}>
        {borrar ? (
          <AppModal
            title="ELIMINAR ÍTEM"
            size="sm"
            actions={
              <>
                <Button type="button" variant="outline" disabled={ocupado} onClick={() => setBorrar(null)}>
                  Cancelar
                </Button>
                <Button type="button" disabled={ocupado} onClick={() => void confirmarBaja()}>
                  Eliminar
                </Button>
              </>
            }
          >
            <p className="text-sm">
              Se va a eliminar <span className="font-semibold">{borrar.descuento}%</span> del presupuesto.
            </p>
          </AppModal>
        ) : null}
      </Dialog>
    </>
  );
}
