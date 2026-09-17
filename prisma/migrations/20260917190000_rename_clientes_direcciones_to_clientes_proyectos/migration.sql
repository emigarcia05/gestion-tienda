-- Rename clientes_direcciones → clientes_proyectos + nombre_proyecto.

ALTER TABLE "clientes_direcciones" RENAME TO "clientes_proyectos";

ALTER TABLE "clientes_proyectos" RENAME CONSTRAINT "clientes_direcciones_pkey" TO "clientes_proyectos_pkey";
ALTER TABLE "clientes_proyectos" RENAME CONSTRAINT "clientes_direcciones_persona_id_fkey" TO "clientes_proyectos_persona_id_fkey";
ALTER TABLE "clientes_proyectos" DROP CONSTRAINT IF EXISTS "clientes_direcciones_al_menos_un_dato_chk";

ALTER INDEX IF EXISTS "clientes_direcciones_persona_id_idx" RENAME TO "clientes_proyectos_persona_id_idx";
ALTER INDEX IF EXISTS "clientes_direcciones_calle_nombre_idx" RENAME TO "clientes_proyectos_calle_nombre_idx";
ALTER INDEX IF EXISTS "clientes_direcciones_departamento_idx" RENAME TO "clientes_proyectos_departamento_idx";

ALTER TABLE "clientes_proyectos" ADD COLUMN "nombre_proyecto" TEXT NOT NULL DEFAULT '';
ALTER TABLE "clientes_proyectos" ALTER COLUMN "nombre_proyecto" DROP DEFAULT;

CREATE INDEX "clientes_proyectos_nombre_proyecto_idx" ON "clientes_proyectos"("nombre_proyecto");

ALTER TABLE "clientes_proyectos"
ADD CONSTRAINT "clientes_proyectos_al_menos_un_dato_chk"
CHECK (
  btrim("nombre_proyecto") <> ''
  OR btrim("calle_nombre") <> ''
  OR btrim("numeracion") <> ''
  OR btrim("distrito") <> ''
  OR "departamento" IS NOT NULL
  OR ("url_maps" IS NOT NULL AND btrim("url_maps") <> '')
  OR ("referencia" IS NOT NULL AND btrim("referencia") <> '')
);
