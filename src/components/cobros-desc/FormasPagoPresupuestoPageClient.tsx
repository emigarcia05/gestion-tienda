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
import { TABLE_ROW_ACTION_ICON_CLASS, TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS } from "@/lib/ui-classes";
import type { TextoFormaPagoPresupuesto } from "@/services/formasPagoPresupuesto.service";
import { cn } from "@/lib/utils";

type FormaOpcion = { id: string; nombre: string };

type Borrador = {
  id?: string;
  descTexto: string;
  pagoIds: string[];
};

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
  const puedeGuardar =
    esEditor &&
    !ocupado &&
    Boolean(borrador?.descTexto.trim()) &&
    (borrador?.pagoIds.length ?? 0) > 0;

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
      descTexto: borrador.descTexto,
      pagoIds: borrador.pagoIds,
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
              onClick={() => setBorrador({ descTexto: "", pagoIds: [] })}
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
                    <TableCell className="font-medium">{fila.descTexto}</TableCell>
                    <TableCell>{fila.formas.map((forma) => forma.nombre).join(" - ")}</TableCell>
                    <TableCell>
                      <div className={cn(TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS, "justify-center")}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
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
                          aria-label="Editar"
                          disabled={!esEditor || ocupado}
                          onClick={() =>
                            setBorrador({
                              id: fila.id,
                              descTexto: fila.descTexto,
                              pagoIds: fila.formas.map((forma) => forma.pagoId),
                            })
                          }
                        >
                          <Pencil className={TABLE_ROW_ACTION_ICON_CLASS} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
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
                <Input
                  value={borrador.descTexto}
                  maxLength={80}
                  autoFocus
                  disabled={ocupado}
                  onChange={(event) =>
                    setBorrador({
                      ...borrador,
                      descTexto: event.target.value.toLocaleUpperCase("es-AR"),
                    })
                  }
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <ModalMicroLabel>FORMAS DE PAGO</ModalMicroLabel>
                <FiltroMultiSelect
                  opciones={opciones}
                  selected={borrador.pagoIds}
                  onChange={(pagoIds) => setBorrador({ ...borrador, pagoIds })}
                  placeholder="ELEGIR"
                  ariaLabel="Formas de pago"
                  disabled={ocupado}
                />
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
              Se va a eliminar <span className="font-semibold">{borrar.descTexto}</span> del presupuesto.
            </p>
          </AppModal>
        ) : null}
      </Dialog>
    </>
  );
}
