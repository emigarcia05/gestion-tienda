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
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import PorcentajeEnteroMaskInput from "@/components/shared/PorcentajeEnteroMaskInput";
import ToolbarActionButton from "@/components/shared/ToolbarActionButton";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import type { TextoFormaPagoPresupuesto } from "@/services/formasPagoPresupuesto.service";

const MAX_FORMAS = 30;
const MAX_LARGO = 80;

type Borrador = {
  id?: string;
  descuento: number;
  formas: string[];
};

const BORRADOR_NUEVO: Borrador = { descuento: 0, formas: [""] };

function formasParaGuardar(formas: readonly string[]): string[] {
  return formas.map((forma) => forma.trim()).filter((forma) => forma.length > 0);
}

export default function FormasPagoPresupuestoPageClient({
  filasIniciales,
  esEditor,
}: {
  filasIniciales: TextoFormaPagoPresupuesto[];
  esEditor: boolean;
}) {
  const [filas, setFilas] = useState(filasIniciales);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [borrar, setBorrar] = useState<TextoFormaPagoPresupuesto | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const formasLimpias = borrador ? formasParaGuardar(borrador.formas) : [];
  const puedeGuardar =
    esEditor &&
    !ocupado &&
    Boolean(borrador) &&
    formasLimpias.length > 0 &&
    formasLimpias.every((forma) => forma.length <= MAX_LARGO);

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
      formas: formasLimpias,
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

  function cambiarForma(indice: number, valor: string) {
    if (!borrador) return;
    const formas = borrador.formas.slice();
    formas[indice] = valor;
    setBorrador({ ...borrador, formas });
  }

  return (
    <>
      <ClassicFilteredTableLayout
        title="Administrador"
        subtitle="Form. Pag. en Presp."
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
                <TableHead>FORMA DE PAGO</TableHead>
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
                filas.flatMap((fila, indiceFila) => {
                  const lineas = fila.formas.length > 0 ? fila.formas : [""];
                  return lineas.map((texto, indice) => (
                    <TableRow key={`${fila.id}-${indice}`}>
                      {indice === 0 ? (
                        <TableCell rowSpan={lineas.length} className="align-top font-medium">
                          {fila.descuento}%
                        </TableCell>
                      ) : null}
                      <TableCell className="text-left">{texto}</TableCell>
                      {indice === 0 ? (
                        <TableCell rowSpan={lineas.length} className="align-top">
                          <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                              aria-label="Subir"
                              disabled={!esEditor || ocupado || indiceFila === 0}
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
                              disabled={!esEditor || ocupado || indiceFila === filas.length - 1}
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
                                  formas: fila.formas.length > 0 ? [...fila.formas] : [""],
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
                      ) : null}
                    </TableRow>
                  ));
                })
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
              <div className="flex flex-col gap-2">
                <ModalMicroLabel>FORMA DE PAGO</ModalMicroLabel>
                {borrador.formas.map((forma, indice) => (
                  <div key={indice} className="flex items-center gap-2">
                    <Input
                      value={forma}
                      maxLength={MAX_LARGO}
                      disabled={ocupado}
                      aria-label={`Forma de pago ${indice + 1}`}
                      onChange={(event) => cambiarForma(indice, event.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Quitar forma de pago"
                      disabled={ocupado || borrador.formas.length === 1}
                      onClick={() =>
                        setBorrador({
                          ...borrador,
                          formas: borrador.formas.filter((_, actual) => actual !== indice),
                        })
                      }
                    >
                      <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  disabled={ocupado || borrador.formas.length >= MAX_FORMAS}
                  onClick={() => setBorrador({ ...borrador, formas: [...borrador.formas, ""] })}
                >
                  <Plus />
                  Nueva Forma
                </Button>
              </div>
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
