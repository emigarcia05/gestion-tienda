"use client";

import { useState, useTransition, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SELECT_TRIGGER_FILTER_CLASS } from "@/components/FilterBar";
import { crearContrasenaUsuarioAction, ingresarUsuarioAction } from "@/actions/sesion";
import { getMainAppAreaById } from "@/lib/main-app-areas";
import { type SucursalPreferida } from "@/lib/sucursalPreferida";
import { etiquetaSucursalPorDefecto, primerModuloPermitido } from "@/lib/usuarios";
import { guardarUsuarioSesion, type UsuarioSesion } from "@/lib/usuarioSesion";
import { cn } from "@/lib/utils";
import { CONTRASENA_MIN } from "@/lib/validations/ingreso";
import type { UsuarioIngresoItem } from "@/services/ingreso.service";

interface Props {
  usuarios: UsuarioIngresoItem[];
  errorCarga: string | null;
}

const TARJETA_CLASS = "flex w-full flex-col gap-3 rounded-lg bg-card p-4 shadow-lg";

function CampoContrasena({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  autoFocus,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  autoFocus?: boolean;
  autoComplete: "current-password" | "new-password";
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          tabIndex={-1}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/**
 * Pantalla de ingreso (sin slidenav): fondo `bg-primary`, logo y un solo bloque
 * (sucursal / usuario en Select + contraseña) que entra en una vista.
 */
export default function IngresarPageClient({ usuarios, errorCarga }: Props) {
  const router = useRouter();
  const [sucursal, setSucursal] = useState<SucursalPreferida | "">("");
  const [idPersonal, setIdPersonal] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const sucursales = sucursalesDeUsuarios(usuarios);
  const usuariosSucursal = sucursal
    ? usuarios.filter((u) => u.sucursalPorDefecto === sucursal)
    : [];
  const idNum = idPersonal.trim() ? Number.parseInt(idPersonal, 10) : NaN;
  const usuario =
    Number.isInteger(idNum) && idNum > 0
      ? (usuariosSucursal.find((u) => u.idPersonal === idNum) ?? null)
      : null;
  const creando = usuario != null && !usuario.tieneContrasena;

  function limpiarContrasena() {
    setContrasena("");
    setConfirmacion("");
    setVisible(false);
    setError("");
  }

  function elegirSucursal(codigo: SucursalPreferida | "") {
    setSucursal(codigo);
    setIdPersonal("");
    limpiarContrasena();
  }

  function elegirUsuario(id: string) {
    setIdPersonal(id);
    limpiarContrasena();
  }

  function entrar(sesion: UsuarioSesion) {
    guardarUsuarioSesion(sesion);
    const destino = primerModuloPermitido(sesion.modulosPermitidos);
    router.replace(destino ? getMainAppAreaById(destino).href : "/");
    router.refresh();
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!usuario || pending) return;
    setError("");
    startTransition(async () => {
      const res = creando
        ? await crearContrasenaUsuarioAction({
            idPersonal: usuario.idPersonal,
            contrasena,
            confirmacion,
          })
        : await ingresarUsuarioAction({ idPersonal: usuario.idPersonal, contrasena });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      entrar(res.data);
    });
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-primary px-4 py-6">
      <Image
        src="/logo_tiendacolor_letras_blancas.png"
        alt="TiendaColor"
        width={615}
        height={375}
        priority
        className="h-auto w-44"
      />

      <form
        className={cn(TARJETA_CLASS, "mt-6 w-[24rem]")}
        onSubmit={handleSubmit}
        aria-label="Ingreso"
      >
        {errorCarga ? <p className="text-sm text-destructive">{errorCarga}</p> : null}
        {!errorCarga && sucursales.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay usuarios configurados. Cargá sucursal y módulos en Usuarios.
          </p>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="ingreso-sucursal">SUCURSAL</Label>
          <Select
            value={sucursal}
            onValueChange={(v) => elegirSucursal(v as SucursalPreferida)}
            disabled={pending || sucursales.length === 0}
          >
            <SelectTrigger
              id="ingreso-sucursal"
              className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
            >
              <SelectValue placeholder="SUCURSAL" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              side="bottom"
              align="start"
              className="select-content-filtro"
            >
              {sucursales.map((codigo) => (
                <SelectItem key={codigo} value={codigo}>
                  {etiquetaSucursalPorDefecto(codigo)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ingreso-usuario">USUARIO</Label>
          <Select
            value={idPersonal}
            onValueChange={elegirUsuario}
            disabled={pending || !sucursal || usuariosSucursal.length === 0}
          >
            <SelectTrigger
              id="ingreso-usuario"
              className={cn(SELECT_TRIGGER_FILTER_CLASS, "w-full")}
            >
              <SelectValue placeholder="USUARIO" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              side="bottom"
              align="start"
              className="select-content-filtro"
            >
              {usuariosSucursal.map((u) => (
                <SelectItem key={u.idPersonal} value={String(u.idPersonal)}>
                  {u.nombrePersonal.toLocaleUpperCase("es-AR")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {usuario ? (
          <>
            {creando ? (
              <p className="text-sm text-muted-foreground">
                Primer ingreso: mínimo {CONTRASENA_MIN} caracteres.
              </p>
            ) : null}
            <CampoContrasena
              key={`${usuario.idPersonal}-contrasena`}
              id="ingreso-contrasena"
              label={creando ? "NUEVA CONTRASEÑA" : "CONTRASEÑA"}
              value={contrasena}
              onChange={(v) => {
                setContrasena(v);
                setError("");
              }}
              visible={visible}
              onToggleVisible={() => setVisible((v) => !v)}
              autoFocus
              autoComplete={creando ? "new-password" : "current-password"}
            />
            {creando ? (
              <CampoContrasena
                id="ingreso-confirmacion"
                label="REPETIR CONTRASEÑA"
                value={confirmacion}
                onChange={(v) => {
                  setConfirmacion(v);
                  setError("");
                }}
                visible={visible}
                onToggleVisible={() => setVisible((v) => !v)}
                autoComplete="new-password"
              />
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              type="submit"
              className="w-full"
              disabled={pending || !contrasena || (creando && !confirmacion)}
            >
              {pending ? "Ingresando..." : creando ? "Crear E Ingresar" : "Ingresar"}
            </Button>
          </>
        ) : null}
      </form>
    </div>
  );
}

function sucursalesDeUsuarios(usuarios: UsuarioIngresoItem[]): SucursalPreferida[] {
  const set = new Set<SucursalPreferida>();
  for (const u of usuarios) {
    if (u.sucursalPorDefecto === "guaymallen" || u.sucursalPorDefecto === "maipu") {
      set.add(u.sucursalPorDefecto);
    }
  }
  const orden: SucursalPreferida[] = ["guaymallen", "maipu"];
  return orden.filter((c) => set.has(c));
}
