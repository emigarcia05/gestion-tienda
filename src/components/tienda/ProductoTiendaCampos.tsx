"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ModalMicroLabel from "@/components/shared/ModalMicroLabel";
import type { CatalogosProductoTienda } from "@/lib/hooks/useCatalogosProductoTienda";

/** Sentinel de los Select opcionales (PRESENTACIÓN / COLOR). */
export const SIN_VALOR_PRODUCTO_TIENDA = "none";

/** Grilla de dos columnas de los modales Agregar / Editar producto. */
export const PRODUCTO_TIENDA_GRID_CLASS = "grid grid-cols-2 gap-3";

export type CamposProductoTiendaForm = {
  descripcion: string;
  idRubro: string;
  subRubro: string;
  idMarca: string;
  idPresentacion: string;
  idColor: string;
  /** Texto del input UN. POR BULTO (solo dígitos; vacío = sin bulto). */
  bulto: string;
};

export const CAMPOS_PRODUCTO_TIENDA_VACIOS: CamposProductoTiendaForm = {
  descripcion: "",
  idRubro: "",
  subRubro: "",
  idMarca: "",
  idPresentacion: SIN_VALOR_PRODUCTO_TIENDA,
  idColor: SIN_VALOR_PRODUCTO_TIENDA,
  bulto: "",
};

export function parsearBultoProductoTienda(value: string): { bulto: number | null; invalido: boolean } {
  const trim = value.trim();
  const bulto = trim ? Number(trim) : null;
  return { bulto, invalido: bulto !== null && (!Number.isInteger(bulto) || bulto < 1) };
}

export function camposProductoTiendaCompletos(campos: CamposProductoTiendaForm): boolean {
  return (
    campos.descripcion.trim().length > 0 &&
    !!campos.idRubro &&
    !!campos.idMarca &&
    !parsearBultoProductoTienda(campos.bulto).invalido
  );
}

/** Campos en el formato que esperan las actions (`null` = vacío). */
export function camposProductoTiendaParaAction(campos: CamposProductoTiendaForm) {
  return {
    descripcion: campos.descripcion,
    idRubro: campos.idRubro,
    subRubro: campos.subRubro.trim() || null,
    idMarca: campos.idMarca,
    idPresentacion: campos.idPresentacion === SIN_VALOR_PRODUCTO_TIENDA ? null : campos.idPresentacion,
    idColor: campos.idColor === SIN_VALOR_PRODUCTO_TIENDA ? null : campos.idColor,
    bulto: parsearBultoProductoTienda(campos.bulto).bulto,
  };
}

function SelectCatalogo({
  label,
  value,
  onChange,
  opciones,
  placeholder,
  opcionVacia,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  opciones: { id: string; nombre: string }[];
  placeholder: string;
  /** Texto de la opción sentinel; sin ella el campo es obligatorio. */
  opcionVacia?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <ModalMicroLabel>{label}</ModalMicroLabel>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {opcionVacia ? <SelectItem value={SIN_VALOR_PRODUCTO_TIENDA}>{opcionVacia}</SelectItem> : null}
          {opciones.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Agregar / Editar producto:
 * DESCRIPCIÓN · RUBRO | SUB-RUBRO · MARCA | COLOR · PRESENTACIÓN | UN. POR BULTO.
 */
export default function ProductoTiendaCampos({
  campos,
  onChange,
  catalogos,
  disabled,
  autoFocus,
}: {
  campos: CamposProductoTiendaForm;
  onChange: (patch: Partial<CamposProductoTiendaForm>) => void;
  catalogos: CatalogosProductoTienda;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const bultoInvalido = parsearBultoProductoTienda(campos.bulto).invalido;
  return (
    <>
      <div className="flex flex-col gap-1">
        <ModalMicroLabel>DESCRIPCIÓN</ModalMicroLabel>
        <Input
          value={campos.descripcion}
          onChange={(e) => onChange({ descripcion: e.target.value })}
          placeholder="DESCRIPCIÓN DEL PRODUCTO"
          disabled={disabled}
          autoFocus={autoFocus}
        />
      </div>
      <div className={PRODUCTO_TIENDA_GRID_CLASS}>
        <SelectCatalogo
          label="RUBRO"
          value={campos.idRubro}
          onChange={(v) => onChange({ idRubro: v })}
          opciones={catalogos.rubros}
          placeholder="RUBRO (OBLIGATORIO)"
          disabled={disabled}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <ModalMicroLabel>SUB-RUBRO</ModalMicroLabel>
          <Input
            value={campos.subRubro}
            onChange={(e) => onChange({ subRubro: e.target.value })}
            placeholder="SUB-RUBRO"
            disabled={disabled}
          />
        </div>
        <SelectCatalogo
          label="MARCA"
          value={campos.idMarca}
          onChange={(v) => onChange({ idMarca: v })}
          opciones={catalogos.marcas}
          placeholder="MARCA (OBLIGATORIO)"
          disabled={disabled}
        />
        <SelectCatalogo
          label="COLOR"
          value={campos.idColor}
          onChange={(v) => onChange({ idColor: v })}
          opciones={catalogos.colores}
          placeholder="COLOR"
          opcionVacia="SIN COLOR"
          disabled={disabled}
        />
        <SelectCatalogo
          label="PRESENTACIÓN"
          value={campos.idPresentacion}
          onChange={(v) => onChange({ idPresentacion: v })}
          opciones={catalogos.presentaciones}
          placeholder="PRESENTACIÓN"
          opcionVacia="SIN PRESENTACIÓN"
          disabled={disabled}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <ModalMicroLabel>UN. POR BULTO</ModalMicroLabel>
          <Input
            value={campos.bulto}
            onChange={(e) => onChange({ bulto: e.target.value.replace(/[^0-9]/g, "") })}
            inputMode="numeric"
            placeholder="UN. POR BULTO"
            disabled={disabled}
            aria-invalid={bultoInvalido || undefined}
          />
        </div>
      </div>
    </>
  );
}
