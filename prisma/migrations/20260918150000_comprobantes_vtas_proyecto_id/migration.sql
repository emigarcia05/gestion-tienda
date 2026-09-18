-- Relación opcional comprobantes_vtas → clientes_proyectos.
-- Si hay proyecto, debe haber cliente de catálogo (CHECK).

ALTER TABLE "comprobantes_vtas"
  ADD COLUMN IF NOT EXISTS "proyecto_id" TEXT;

ALTER TABLE "comprobantes_vtas"
  DROP CONSTRAINT IF EXISTS "comprobantes_vtas_proyecto_id_fkey";
ALTER TABLE "comprobantes_vtas"
  ADD CONSTRAINT "comprobantes_vtas_proyecto_id_fkey"
  FOREIGN KEY ("proyecto_id") REFERENCES "clientes_proyectos"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "comprobantes_vtas_proyecto_id_idx"
  ON "comprobantes_vtas" ("proyecto_id");

ALTER TABLE "comprobantes_vtas"
  DROP CONSTRAINT IF EXISTS "comprobantes_vtas_proyecto_cliente_chk";
ALTER TABLE "comprobantes_vtas"
  ADD CONSTRAINT "comprobantes_vtas_proyecto_cliente_chk"
  CHECK ("proyecto_id" IS NULL OR "cliente_id" IS NOT NULL);
