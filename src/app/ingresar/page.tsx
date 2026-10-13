import type { Metadata } from "next";
import { redirect } from "next/navigation";
import IngresarPageClient from "@/components/ingreso/IngresarPageClient";
import { getIdPersonalSesion } from "@/lib/sesion";
import { getMainAppAreaById } from "@/lib/main-app-areas";
import { primerModuloPermitido } from "@/lib/usuarios";
import { listarUsuariosIngreso, obtenerUsuarioSesion } from "@/services/ingreso.service";

export const metadata: Metadata = {
  title: "Ingresar — TiendaColor",
};

export default async function IngresarPage() {
  const idPersonal = await getIdPersonalSesion();
  const actual = idPersonal == null ? null : await obtenerUsuarioSesion(idPersonal);
  const destinoActual = actual ? primerModuloPermitido(actual.modulosPermitidos) : null;
  if (destinoActual) redirect(getMainAppAreaById(destinoActual).href);

  const res = await listarUsuariosIngreso();
  return (
    <IngresarPageClient
      usuarios={res.success ? res.data : []}
      errorCarga={res.success ? null : res.error}
    />
  );
}
