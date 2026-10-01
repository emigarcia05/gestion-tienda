import { redirect } from "next/navigation";

/** Hub `/facturacion` ya no es un área. Las pantallas viven en Vendedor. */
export default function FacturacionPage() {
  redirect("/");
}
