import { getProveedoresMercaderia } from "@/actions/proveedores";
import { prisma } from "@/lib/prisma";
import SugeridosPageClient from "@/components/proveedores/SugeridosPageClient";

export const dynamic = "force-dynamic";

export default async function PxVtaSugeridosPage() {
  const [proveedores, marcasRows] = await Promise.all([
    getProveedoresMercaderia(),
    prisma.marca.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  const marcas = marcasRows.map((m) => ({ id: m.id, nombre: m.nombre }));

  return (
    <div className="area-page-shell">
      <SugeridosPageClient proveedores={proveedores} marcas={marcas} />
    </div>
  );
}
