-- Presentación y color elegidos al dar de alta un producto (Lista Productos · Agregar Item).
ALTER TABLE "prod_tienda" ADD COLUMN IF NOT EXISTS "id_presentacion" TEXT;
ALTER TABLE "prod_tienda" ADD COLUMN IF NOT EXISTS "id_color" TEXT;

CREATE INDEX IF NOT EXISTS "prod_tienda_id_presentacion_idx" ON "prod_tienda"("id_presentacion");
CREATE INDEX IF NOT EXISTS "prod_tienda_id_color_idx" ON "prod_tienda"("id_color");

ALTER TABLE "prod_tienda" DROP CONSTRAINT IF EXISTS "prod_tienda_id_presentacion_fkey";
ALTER TABLE "prod_tienda" ADD CONSTRAINT "prod_tienda_id_presentacion_fkey"
  FOREIGN KEY ("id_presentacion") REFERENCES "est_por_prod_presentacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prod_tienda" DROP CONSTRAINT IF EXISTS "prod_tienda_id_color_fkey";
ALTER TABLE "prod_tienda" ADD CONSTRAINT "prod_tienda_id_color_fkey"
  FOREIGN KEY ("id_color") REFERENCES "est_por_prod_colores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
