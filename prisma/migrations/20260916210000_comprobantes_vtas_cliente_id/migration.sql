-- Relación opcional comprobantes_vtas → clientes (receptor de catálogo).
-- El snapshot fiscal (receptor_*) se mantiene; cliente_id permite vincular al catálogo.

ALTER TABLE "comprobantes_vtas"
  ADD COLUMN IF NOT EXISTS "cliente_id" TEXT;

ALTER TABLE "comprobantes_vtas"
  DROP CONSTRAINT IF EXISTS "comprobantes_vtas_cliente_id_fkey";
ALTER TABLE "comprobantes_vtas"
  ADD CONSTRAINT "comprobantes_vtas_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "comprobantes_vtas_cliente_id_idx"
  ON "comprobantes_vtas" ("cliente_id");
