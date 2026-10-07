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

export type CamposProductoTiendaForm = {
  descripcion: string;
  idRubro: string;
  subRubro: string;
  idMarca: string;
  idPresentacion: string;
  idColor: string;
};

export const CAMPOS_PRODUCTO_TIENDA_VACIOS: CamposProductoTiendaForm = {
  descripcion: "",
  idRubro: "",
  subRubro: "",
  idMarca: "",
  idPresentacion: SIN_VALOR_PRODUCTO_TIENDA,
  idColor: SIN_VALOR_PRODUCTO_TIENDA,
};

export function camposProductoTiendaCompletos(campos: CamposProductoTiendaForm): boolean {
  return campos.descripcion.trim().length > 0 && !!campos.idRubro && !!campos.idMarca;
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
  };
}

/** DESCRIPCIÓN · RUBRO · SUB-RUBRO · MARCA · PRESENTACIÓN · COLOR, en una columna (Agregar / Editar producto). */
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
      <div className="flex flex-col gap-1">
        <ModalMicroLabel>RUBRO</ModalMicroLabel>
        <Select value={campos.idRubro} onValueChange={(v) => onChange({ idRubro: v })} disabled={disabled}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="RUBRO (OBLIGATORIO)" />
          </SelectTrigger>
          <SelectContent>
            {catalogos.rubros.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <ModalMicroLabel>SUB-RUBRO</ModalMicroLabel>
        <Input
          value={campos.subRubro}
          onChange={(e) => onChange({ subRubro: e.target.value })}
          placeholder="SUB-RUBRO"
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1">
        <ModalMicroLabel>MARCA</ModalMicroLabel>
        <Select value={campos.idMarca} onValueChange={(v) => onChange({ idMarca: v })} disabled={disabled}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="MARCA (OBLIGATORIO)" />
          </SelectTrigger>
          <SelectContent>
            {catalogos.marcas.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <ModalMicroLabel>PRESENTACIÓN</ModalMicroLabel>
        <Select
          value={campos.idPresentacion}
          onValueChange={(v) => onChange({ idPresentacion: v })}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="PRESENTACIÓN" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_VALOR_PRODUCTO_TIENDA}>SIN PRESENTACIÓN</SelectItem>
            {catalogos.presentaciones.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <ModalMicroLabel>COLOR</ModalMicroLabel>
        <Select value={campos.idColor} onValueChange={(v) => onChange({ idColor: v })} disabled={disabled}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="COLOR" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_VALOR_PRODUCTO_TIENDA}>SIN COLOR</SelectItem>
            {catalogos.colores.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

/** Input BULTO (entero ≥ 1 o vacío). */
export function ProductoTiendaBultoInput({
  value,
  onChange,
  invalido,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  invalido: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <ModalMicroLabel>BULTO</ModalMicroLabel>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        inputMode="numeric"
        placeholder="UNIDADES POR BULTO"
        disabled={disabled}
        aria-invalid={invalido || undefined}
      />
    </div>
  );
}

export function parsearBultoProductoTienda(value: string): { bulto: number | null; invalido: boolean } {
  const trim = value.trim();
  const bulto = trim ? Number(trim) : null;
  return { bulto, invalido: bulto !== null && (!Number.isInteger(bulto) || bulto < 1) };
}
