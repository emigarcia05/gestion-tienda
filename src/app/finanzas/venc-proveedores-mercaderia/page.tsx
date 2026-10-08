import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function VencProveedoresMercaderiaRedirectPage() {
  permanentRedirect("/finanzas/control-comprobantes");
}
