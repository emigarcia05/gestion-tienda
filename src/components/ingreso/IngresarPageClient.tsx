"use client";

import { useState, useTransition, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearContrasenaUsuarioAction, ingresarUsuarioAction } from "@/actions/sesion";
import { getMainAppAreaById } from "@/lib/main-app-areas";
import { SUCURSALES_PREFERIDAS, type SucursalPreferida } from "@/lib/sucursalPreferida";
import { etiquetaSucursalPorDefecto, primerModuloPermitido } from "@/lib/usuarios";
import { guardarUsuarioSesion, type UsuarioSesion } from "@/lib/usuarioSesion";
import { CONTRASENA_MIN } from "@/lib/validations/ingreso";
import type { UsuarioIngresoItem } from "@/services/ingreso.service";

interface Props {
  usuarios: UsuarioIngresoItem[];
  errorCarga: string | null;
}

const BLOQUE_CLASS = "flex w-full flex-col gap-3 rounded-lg bg-card p-5 shadow-lg";
const BLOQUE_TITULO_CLASS =
  "flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-foreground";
const OPCION_CLASS = "h-auto w-full justify-start px-3 py-2.5 text-left whitespace-normal";

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
 * Pantalla de ingreso (sin slidenav): fondo `bg-primary`, logo arriba al centro y tres bloques
 * apilados — sucursal → usuarios de esa sucursal → contraseña (crear si el usuario no tiene).
 */
export default function IngresarPageClient({ usuarios, errorCarga }: Props) {
  const router = useRouter();
  const [sucursal, setSucursal] = useState<SucursalPreferida | null>(null);
  const [idPersonal, setIdPersonal] = useState<number | null>(null);
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const sucursales = SUCURSALES_PREFERIDAS.map((s) => s.value).filter((codigo) =>
    usuarios.some((u) => u.sucursalPorDefecto === codigo)
  );
  const usuariosSucursal = usuarios.filter((u) => u.sucursalPorDefecto === sucursal);
  const usuario = usuariosSucursal.find((u) => u.idPersonal === idPersonal) ?? null;
  const creando = usuario != null && !usuario.tieneContrasena;

  function limpiarContrasena() {
    setContrasena("");
    setConfirmacion("");
    setVisible(false);
    setError("");
  }

  function elegirSucursal(codigo: SucursalPreferida) {
    setSucursal(codigo);
    setIdPersonal(null);
    limpiarContrasena();
  }

  function elegirUsuario(id: number) {
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
    <div className="flex min-h-screen w-full flex-col items-center overflow-y-auto bg-primary px-4 py-12">
      <Image
        src="/logo_tiendacolor_letras_blancas.png"
        alt="TiendaColor"
        width={615}
        height={375}
        priority
        className="h-auto w-60"
      />

      <div className="mt-10 flex w-[24rem] flex-col gap-4">
        <section className={BLOQUE_CLASS} aria-label="Sucursal">
          <h2 className={BLOQUE_TITULO_CLASS}>
            <MapPin className="h-4 w-4" aria-hidden />
            Seleccioná La Sucursal
          </h2>
          {errorCarga ? <p className="text-sm text-destructive">{errorCarga}</p> : null}
          {!errorCarga && sucursales.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay usuarios configurados. Cargá sucursal y módulos en Usuarios.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {sucursales.map((codigo) => (
              <Button
                key={codigo}
                type="button"
                variant={sucursal === codigo ? "default" : "outline"}
                disabled={pending}
                onClick={() => elegirSucursal(codigo)}
                aria-pressed={sucursal === codigo}
              >
                {etiquetaSucursalPorDefecto(codigo)}
              </Button>
            ))}
          </div>
        </section>

        {sucursal ? (
          <section className={BLOQUE_CLASS} aria-label="Usuario">
            <h2 className={BLOQUE_TITULO_CLASS}>
              <User className="h-4 w-4" aria-hidden />
              Usuario
            </h2>
            <div className="flex max-h-[min(18rem,35vh)] flex-col gap-2 overflow-y-auto">
              {usuariosSucursal.map((u) => (
                <Button
                  key={u.idPersonal}
                  type="button"
                  variant={u.idPersonal === idPersonal ? "default" : "outline"}
                  disabled={pending}
                  onClick={() => elegirUsuario(u.idPersonal)}
                  aria-pressed={u.idPersonal === idPersonal}
                  className={OPCION_CLASS}
                >
                  <span className="truncate text-sm font-semibold tracking-wide">
                    {u.nombrePersonal.toLocaleUpperCase("es-AR")}
                  </span>
                </Button>
              ))}
            </div>
          </section>
        ) : null}

        {usuario ? (
          <form className={BLOQUE_CLASS} onSubmit={handleSubmit} aria-label="Contraseña">
            <h2 className={BLOQUE_TITULO_CLASS}>
              <KeyRound className="h-4 w-4" aria-hidden />
              {creando ? "Creá Tu Contraseña" : "Contraseña"}
            </h2>
            {creando ? (
              <p className="text-sm text-muted-foreground">
                Es tu primer ingreso: elegí una contraseña (mínimo {CONTRASENA_MIN} caracteres).
                Se va a pedir cada vez que ingreses.
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
          </form>
        ) : null}
      </div>
    </div>
  );
}
