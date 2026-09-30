"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import ClassicFilteredTableLayout from "@/components/shared/ClassicFilteredTableLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TABLE_ROW_ACTION_ICON_CLASS,
  TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS,
  TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS,
} from "@/lib/ui-classes";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import GestionTiposPinturaModal from "@/components/tienda/GestionTiposPinturaModal";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TipoPinturaRendimiento } from "@/actions/tiposPinturaRendimientos";
import {
  crearFilaParedVacia,
  formatDecimal,
  formatTamanoMts,
  parseDecimalInput,
  sanitizeDecimalUnDigito,
  type FilaParedLts,
} from "@/lib/tiendaCalculosLts";
import { Trash2 } from "lucide-react";

/** Dimensión en metros: el usuario edita solo el número; el sufijo **Mts.** es solo visual (`aria-hidden`). */
function InputDimensionMts({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <div className="relative w-full min-w-0">
      <Input {...props} className={cn("h-8 pr-10 text-center", className)} />
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none"
      >
        Mts.
      </span>
    </div>
  );
}

const CALC_LITROS_FOOTER_CLASS = "pie-pagina border-t border-sidebar-border";
const CALC_LITROS_FOOTER_ROW_CLASS =
  "border-0 bg-muted/50 hover:bg-muted/60 odd:bg-muted/50 even:bg-muted/50";
const CALC_LITROS_FOOTER_TOTAL_LABEL_CLASS =
  "celda-datos !text-right font-semibold text-muted-foreground celda-datos--flush-right";
const CALC_LITROS_FOOTER_VALUE_CLASS =
  "celda-datos text-center tabular-nums font-bold text-foreground";

interface Props {
  tiposPintura: TipoPinturaRendimiento[];
  esEditor: boolean;
}

type FormaCalculoLts = "POR_PAREDES" | "POR_MODULO" | "PILETA";

export default function TiendaCalcLitrosPageClient({
  tiposPintura,
  esEditor,
}: Props) {
  const router = useRouter();
  const [gestionarTiposOpen, setGestionarTiposOpen] = useState(false);
  const [formaCalculo, setFormaCalculo] = useState<FormaCalculoLts>("POR_PAREDES");
  const [tipoPinturaId, setTipoPinturaId] = useState<string>("");
  const [filasPared, setFilasPared] = useState<FilaParedLts[]>([crearFilaParedVacia()]);
  const [moduloLargo, setModuloLargo] = useState<string>("");
  const [moduloAncho, setModuloAncho] = useState<string>("");
  const [moduloAlto, setModuloAlto] = useState<string>("");
  const [moduloIncluyeTecho, setModuloIncluyeTecho] = useState<boolean>(false);
  const [piletaLargo, setPiletaLargo] = useState<string>("");
  const [piletaAncho, setPiletaAncho] = useState<string>("");
  const [piletaProfundidad, setPiletaProfundidad] = useState<string>("");

  const rendimientoSeleccionado = useMemo(() => {
    if (!tipoPinturaId) return 0;
    const row = tiposPintura.find((t) => t.id === tipoPinturaId);
    return row ? Number(row.rendimiento) : 0;
  }, [tipoPinturaId, tiposPintura]);

  const totalesPared = useMemo(() => {
    return filasPared.reduce(
      (acc, row) => {
        const cant = parseDecimalInput(row.cantidad);
        const largo = parseDecimalInput(row.largo);
        const ancho = parseDecimalInput(row.ancho);
        const mts2 = cant * largo * ancho;
        const lts1Mano = rendimientoSeleccionado > 0 ? mts2 / rendimientoSeleccionado : 0;
        const lts2Manos = lts1Mano * 2;

        return {
          mts2: acc.mts2 + mts2,
          lts1Mano: acc.lts1Mano + lts1Mano,
          lts2Manos: acc.lts2Manos + lts2Manos,
        };
      },
      { mts2: 0, lts1Mano: 0, lts2Manos: 0 }
    );
  }, [filasPared, rendimientoSeleccionado]);

  /** POR MÓDULO: MTS y litros desde dimensiones del módulo (fila superior). */
  const calculoModulo = useMemo(() => {
    const L = parseDecimalInput(moduloLargo);
    const A = parseDecimalInput(moduloAncho);
    const H = parseDecimalInput(moduloAlto);
    const R = rendimientoSeleccionado;

    const mtsLargoAlto = L * H;
    const mtsAnchoAlto = A * H;
    const mtsTecho = moduloIncluyeTecho ? L * A : 0;

    function litrosDesdeMts(mts2: number) {
      const l1 = R > 0 ? mts2 / R : 0;
      return { lts1Mano: l1, lts2Manos: l1 * 2 };
    }

    const p12 = litrosDesdeMts(mtsLargoAlto);
    const p34 = litrosDesdeMts(mtsAnchoAlto);
    const techo = litrosDesdeMts(mtsTecho);

    const filas = [
      { id: "modulo-pared-1", label: "Pared 1", tamano: formatTamanoMts(L, H), mts2: mtsLargoAlto, ...p12 },
      { id: "modulo-pared-2", label: "Pared 2", tamano: formatTamanoMts(L, H), mts2: mtsLargoAlto, ...p12 },
      { id: "modulo-pared-3", label: "Pared 3", tamano: formatTamanoMts(A, H), mts2: mtsAnchoAlto, ...p34 },
      { id: "modulo-pared-4", label: "Pared 4", tamano: formatTamanoMts(A, H), mts2: mtsAnchoAlto, ...p34 },
      {
        id: "modulo-techo",
        label: "Techo",
        tamano: moduloIncluyeTecho ? formatTamanoMts(L, A) : "—",
        mts2: mtsTecho,
        ...techo,
      },
    ];

    const total = filas.reduce(
      (acc, row) => ({
        mts2: acc.mts2 + row.mts2,
        lts1Mano: acc.lts1Mano + row.lts1Mano,
        lts2Manos: acc.lts2Manos + row.lts2Manos,
      }),
      { mts2: 0, lts1Mano: 0, lts2Manos: 0 }
    );

    return { filas, total };
  }, [
    moduloLargo,
    moduloAncho,
    moduloAlto,
    moduloIncluyeTecho,
    rendimientoSeleccionado,
  ]);

  /** PILETA: igual que POR MÓDULO pero Alto→Profundidad, Techo→Piso (siempre L×A). */
  const calculoPileta = useMemo(() => {
    const L = parseDecimalInput(piletaLargo);
    const A = parseDecimalInput(piletaAncho);
    const P = parseDecimalInput(piletaProfundidad);
    const R = rendimientoSeleccionado;

    const mtsLargoProf = L * P;
    const mtsAnchoProf = A * P;
    const mtsPiso = L * A;

    function litrosDesdeMts(mts2: number) {
      const l1 = R > 0 ? mts2 / R : 0;
      return { lts1Mano: l1, lts2Manos: l1 * 2 };
    }

    const p12 = litrosDesdeMts(mtsLargoProf);
    const p34 = litrosDesdeMts(mtsAnchoProf);
    const piso = litrosDesdeMts(mtsPiso);

    const filas = [
      { id: "pileta-pared-1", label: "Pared 1", tamano: formatTamanoMts(L, P), mts2: mtsLargoProf, ...p12 },
      { id: "pileta-pared-2", label: "Pared 2", tamano: formatTamanoMts(L, P), mts2: mtsLargoProf, ...p12 },
      { id: "pileta-pared-3", label: "Pared 3", tamano: formatTamanoMts(A, P), mts2: mtsAnchoProf, ...p34 },
      { id: "pileta-pared-4", label: "Pared 4", tamano: formatTamanoMts(A, P), mts2: mtsAnchoProf, ...p34 },
      { id: "pileta-piso", label: "Piso", tamano: formatTamanoMts(L, A), mts2: mtsPiso, ...piso },
    ];

    const total = filas.reduce(
      (acc, row) => ({
        mts2: acc.mts2 + row.mts2,
        lts1Mano: acc.lts1Mano + row.lts1Mano,
        lts2Manos: acc.lts2Manos + row.lts2Manos,
      }),
      { mts2: 0, lts1Mano: 0, lts2Manos: 0 }
    );

    return { filas, total };
  }, [piletaLargo, piletaAncho, piletaProfundidad, rendimientoSeleccionado]);

  function actualizarFilaPared(
    id: string,
    campo: "cantidad" | "largo" | "ancho",
    value: string
  ) {
    const sanitized = sanitizeDecimalUnDigito(value);
    setFilasPared((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [campo]: sanitized } : row))
    );
  }

  function agregarFilaPared() {
    setFilasPared((prev) => [...prev, crearFilaParedVacia()]);
  }

  function eliminarFilaPared(id: string) {
    setFilasPared((prev) =>
      prev.length <= 1 ? [crearFilaParedVacia()] : prev.filter((row) => row.id !== id)
    );
  }

  return (
    <div className="area-page-shell">
      <GestionTiposPinturaModal
        open={gestionarTiposOpen}
        onOpenChange={setGestionarTiposOpen}
        rows={tiposPintura}
        onSaved={() => router.refresh()}
      />
      <ClassicFilteredTableLayout
        title="Calcular Lts"
        contentWidth="full"
        actions={
          esEditor ? (
            <Button type="button" onClick={() => setGestionarTiposOpen(true)}>
              Editar Rendimientos
            </Button>
          ) : undefined
        }
      >
        <section className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card p-4">
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex flex-col items-center gap-1">
              <h2 className="text-center text-sm font-semibold uppercase text-foreground">
                CALCULO DE LTS
              </h2>
              <span className="h-0.5 w-[70%] rounded-full bg-primary" aria-hidden />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={formaCalculo}
                onValueChange={(value) => setFormaCalculo(value as FormaCalculoLts)}
              >
                <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "h-10")}>
                  <SelectValue placeholder="FORMA DE CÁLCULO" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  <SelectItem value="POR_PAREDES">POR PAREDES</SelectItem>
                  <SelectItem value="POR_MODULO">POR MÓDULO</SelectItem>
                  <SelectItem value="PILETA">PILETA</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={tipoPinturaId ?? ""}
                onValueChange={(value) => setTipoPinturaId(value)}
              >
                <SelectTrigger className={cn(SELECT_TRIGGER_FILTER_CLASS, "h-10")}>
                  <SelectValue placeholder="TIPO DE PINTURA" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="select-content-filtro"
                >
                  {tiposPintura.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.tipoPintura}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background">
              <div className="h-full min-h-0 overflow-y-auto no-scrollbar">
                {formaCalculo === "POR_PAREDES" ? (
                  <>
                  <Table variant="compact" scrollX={false}>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[20%]">SUPERFICIE</TableHead>
                        <TableHead className="w-[15%]">CANT.</TableHead>
                        <TableHead className="w-[15%]">LARGO</TableHead>
                        <TableHead className="w-[15%]">ANCHO</TableHead>
                        <TableHead className="w-[10%]">MTS2</TableHead>
                        <TableHead className="w-[10%]">1 MANO</TableHead>
                        <TableHead className="w-[10%]">2 MANOS</TableHead>
                        <TableHead className="w-[5%] tabla-bloque-secundario-head-divider">
                          ACCIONES
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filasPared.map((row, index) => {
                        const cant = parseDecimalInput(row.cantidad);
                        const largo = parseDecimalInput(row.largo);
                        const ancho = parseDecimalInput(row.ancho);
                        const mts2 = cant * largo * ancho;
                        const lts1Mano =
                          rendimientoSeleccionado > 0 ? mts2 / rendimientoSeleccionado : 0;
                        const lts2Manos = lts1Mano * 2;

                        return (
                          <TableRow key={row.id}>
                            <TableCell className="celda-datos text-left font-medium">
                              Pared {index + 1}
                            </TableCell>
                            <TableCell className="celda-datos">
                              <Input
                                value={row.cantidad}
                                onChange={(e) =>
                                  actualizarFilaPared(row.id, "cantidad", e.target.value)
                                }
                                className="h-8 text-center"
                                inputMode="decimal"
                                placeholder="0,0"
                                aria-label="Cantidad"
                              />
                            </TableCell>
                            <TableCell className="celda-datos">
                              <InputDimensionMts
                                value={row.largo}
                                onChange={(e) =>
                                  actualizarFilaPared(row.id, "largo", e.target.value)
                                }
                                inputMode="decimal"
                                placeholder="0,0"
                                aria-label="Largo en metros"
                              />
                            </TableCell>
                            <TableCell className="celda-datos">
                              <InputDimensionMts
                                value={row.ancho}
                                onChange={(e) =>
                                  actualizarFilaPared(row.id, "ancho", e.target.value)
                                }
                                inputMode="decimal"
                                placeholder="0,0"
                                aria-label="Ancho en metros"
                              />
                            </TableCell>
                            <TableCell className="celda-datos text-center tabular-nums">
                              {formatDecimal(mts2, 1)} mts2
                            </TableCell>
                            <TableCell className="celda-datos text-center tabular-nums">
                              {formatDecimal(lts1Mano, 1)} lts
                            </TableCell>
                            <TableCell className="celda-datos text-center tabular-nums">
                              {formatDecimal(lts2Manos, 1)} lts
                            </TableCell>
                            <TableCell className="celda-datos celda-datos--accion-relleno-fila tabla-bloque-secundario-cell-divider">
                              <div className={TABLE_ROW_CELL_ICON_ACTIONS_FLEX_CLASS}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => eliminarFilaPared(row.id)}
                                  aria-label="Eliminar fila"
                                  title="Eliminar"
                                  className={TABLE_ROW_ICON_BUTTON_FILLED_BRAND_CLASS}
                                >
                                  <Trash2 className={TABLE_ROW_ACTION_ICON_CLASS} aria-hidden />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter className={CALC_LITROS_FOOTER_CLASS}>
                      <TableRow className={CALC_LITROS_FOOTER_ROW_CLASS}>
                        <TableCell className="celda-datos bg-muted/50" colSpan={3} aria-hidden />
                        <TableCell className={cn(CALC_LITROS_FOOTER_TOTAL_LABEL_CLASS, "bg-muted/50")}>
                          TOTAL
                        </TableCell>
                        <TableCell className={cn(CALC_LITROS_FOOTER_VALUE_CLASS, "bg-muted/50")}>
                          {formatDecimal(totalesPared.mts2, 1)} mts2
                        </TableCell>
                        <TableCell className={cn(CALC_LITROS_FOOTER_VALUE_CLASS, "bg-muted/50")}>
                          {formatDecimal(totalesPared.lts1Mano, 1)} lts
                        </TableCell>
                        <TableCell className={cn(CALC_LITROS_FOOTER_VALUE_CLASS, "bg-muted/50")}>
                          {formatDecimal(totalesPared.lts2Manos, 1)} lts
                        </TableCell>
                        <TableCell className="celda-datos tabla-bloque-secundario-cell-divider bg-muted/50" />
                      </TableRow>
                    </TableFooter>
                  </Table>
                  <div className="flex justify-center border-t border-border/60 bg-background py-2">
                    <Button type="button" onClick={agregarFilaPared} aria-label="Agregar pared">
                      +
                    </Button>
                  </div>
                  </>
                ) : formaCalculo === "POR_MODULO" ? (
                  <div className="flex h-full min-h-0 flex-col gap-2 p-2">
                    <Table variant="compact" scrollX={false}>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[22%]">LARGO</TableHead>
                          <TableHead className="w-[22%]">ANCHO</TableHead>
                          <TableHead className="w-[22%]">ALTO</TableHead>
                          <TableHead className="w-[34%]">INCLUYE TECHO</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="celda-datos">
                            <InputDimensionMts
                              value={moduloLargo}
                              onChange={(e) =>
                                setModuloLargo(e.target.value.replace(/[^\d.,]/g, ""))
                              }
                              inputMode="decimal"
                              placeholder="0,0"
                              aria-label="Largo módulo en metros"
                            />
                          </TableCell>
                          <TableCell className="celda-datos">
                            <InputDimensionMts
                              value={moduloAncho}
                              onChange={(e) =>
                                setModuloAncho(e.target.value.replace(/[^\d.,]/g, ""))
                              }
                              inputMode="decimal"
                              placeholder="0,0"
                              aria-label="Ancho módulo en metros"
                            />
                          </TableCell>
                          <TableCell className="celda-datos">
                            <InputDimensionMts
                              value={moduloAlto}
                              onChange={(e) =>
                                setModuloAlto(e.target.value.replace(/[^\d.,]/g, ""))
                              }
                              inputMode="decimal"
                              placeholder="0,0"
                              aria-label="Alto módulo en metros"
                            />
                          </TableCell>
                          <TableCell className="celda-datos">
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={moduloIncluyeTecho}
                                onChange={(e) => setModuloIncluyeTecho(e.target.checked)}
                                className="h-4 w-4 rounded border-border accent-primary"
                                aria-label="Incluye techo"
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>

                    <div className="h-px w-full bg-border/60" />

                    <Table variant="compact" scrollX={false}>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[18%]">SUPERFICIE</TableHead>
                          <TableHead className="w-[30%]">TAMAÑO</TableHead>
                          <TableHead className="w-[17%]">MTS2</TableHead>
                          <TableHead className="w-[17%]">1 MANO</TableHead>
                          <TableHead className="w-[18%]">2 MANOS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calculoModulo.filas.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="celda-datos text-left font-medium">
                              {row.label}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "celda-datos text-center text-xs whitespace-normal",
                                row.tamano === "—" ? "text-muted-foreground" : "tabular-nums"
                              )}
                            >
                              {row.tamano}
                            </TableCell>
                            <TableCell className="celda-datos text-center tabular-nums">
                              {formatDecimal(row.mts2, 1)} mts2
                            </TableCell>
                            <TableCell className="celda-datos text-center tabular-nums">
                              {formatDecimal(row.lts1Mano, 1)} lts
                            </TableCell>
                            <TableCell className="celda-datos text-center tabular-nums">
                              {formatDecimal(row.lts2Manos, 1)} lts
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter className={CALC_LITROS_FOOTER_CLASS}>
                        <TableRow className={CALC_LITROS_FOOTER_ROW_CLASS}>
                          <TableCell
                            colSpan={2}
                            className={cn(CALC_LITROS_FOOTER_TOTAL_LABEL_CLASS, "bg-muted/50")}
                          >
                            TOTAL
                          </TableCell>
                          <TableCell className={cn(CALC_LITROS_FOOTER_VALUE_CLASS, "bg-muted/50")}>
                            {formatDecimal(calculoModulo.total.mts2, 1)} mts2
                          </TableCell>
                          <TableCell className={cn(CALC_LITROS_FOOTER_VALUE_CLASS, "bg-muted/50")}>
                            {formatDecimal(calculoModulo.total.lts1Mano, 1)} lts
                          </TableCell>
                          <TableCell className={cn(CALC_LITROS_FOOTER_VALUE_CLASS, "bg-muted/50")}>
                            {formatDecimal(calculoModulo.total.lts2Manos, 1)} lts
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                ) : formaCalculo === "PILETA" ? (
                  <div className="flex h-full min-h-0 flex-col gap-2 p-2">
                    <Table variant="compact" scrollX={false}>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[22%]">LARGO</TableHead>
                          <TableHead className="w-[22%]">ANCHO</TableHead>
                          <TableHead className="w-[22%]">PROFUNDIDAD</TableHead>
                          <TableHead className="w-[34%]">PISO</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="celda-datos">
                            <InputDimensionMts
                              value={piletaLargo}
                              onChange={(e) =>
                                setPiletaLargo(e.target.value.replace(/[^\d.,]/g, ""))
                              }
                              inputMode="decimal"
                              placeholder="0,0"
                              aria-label="Largo pileta en metros"
                            />
                          </TableCell>
                          <TableCell className="celda-datos">
                            <InputDimensionMts
                              value={piletaAncho}
                              onChange={(e) =>
                                setPiletaAncho(e.target.value.replace(/[^\d.,]/g, ""))
                              }
                              inputMode="decimal"
                              placeholder="0,0"
                              aria-label="Ancho pileta en metros"
                            />
                          </TableCell>
                          <TableCell className="celda-datos">
                            <InputDimensionMts
                              value={piletaProfundidad}
                              onChange={(e) =>
                                setPiletaProfundidad(e.target.value.replace(/[^\d.,]/g, ""))
                              }
                              inputMode="decimal"
                              placeholder="0,0"
                              aria-label="Profundidad pileta en metros"
                            />
                          </TableCell>
                          <TableCell className="celda-datos">
                            <div className="flex items-center justify-center text-xs font-medium text-foreground">
                              Siempre incluido
                            </div>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>

                    <div className="h-px w-full bg-border/60" />

                    <Table variant="compact" scrollX={false}>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[18%]">SUPERFICIE</TableHead>
                          <TableHead className="w-[30%]">TAMAÑO</TableHead>
                          <TableHead className="w-[17%]">MTS2</TableHead>
                          <TableHead className="w-[17%]">1 MANO</TableHead>
                          <TableHead className="w-[18%]">2 MANOS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calculoPileta.filas.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="celda-datos text-left font-medium">
                              {row.label}
                            </TableCell>
                            <TableCell className="celda-datos text-center tabular-nums text-xs whitespace-normal">
                              {row.tamano}
                            </TableCell>
                            <TableCell className="celda-datos text-center tabular-nums">
                              {formatDecimal(row.mts2, 1)} mts2
                            </TableCell>
                            <TableCell className="celda-datos text-center tabular-nums">
                              {formatDecimal(row.lts1Mano, 1)} lts
                            </TableCell>
                            <TableCell className="celda-datos text-center tabular-nums">
                              {formatDecimal(row.lts2Manos, 1)} lts
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter className={CALC_LITROS_FOOTER_CLASS}>
                        <TableRow className={CALC_LITROS_FOOTER_ROW_CLASS}>
                          <TableCell
                            colSpan={2}
                            className={cn(CALC_LITROS_FOOTER_TOTAL_LABEL_CLASS, "bg-muted/50")}
                          >
                            TOTAL
                          </TableCell>
                          <TableCell className={cn(CALC_LITROS_FOOTER_VALUE_CLASS, "bg-muted/50")}>
                            {formatDecimal(calculoPileta.total.mts2, 1)} mts2
                          </TableCell>
                          <TableCell className={cn(CALC_LITROS_FOOTER_VALUE_CLASS, "bg-muted/50")}>
                            {formatDecimal(calculoPileta.total.lts1Mano, 1)} lts
                          </TableCell>
                          <TableCell className={cn(CALC_LITROS_FOOTER_VALUE_CLASS, "bg-muted/50")}>
                            {formatDecimal(calculoPileta.total.lts2Manos, 1)} lts
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </ClassicFilteredTableLayout>
    </div>
  );
}
