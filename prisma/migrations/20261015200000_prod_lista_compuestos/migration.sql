-- Producto compuesto (kit): un ítem de prod_lista armado con otros ítems de prod_lista.
-- Siempre es PROD. PROPIO. Un componente no puede ser a su vez compuesto (se valida en el servicio).

ALTER TABLE "prod_lista"
  ADD COLUMN IF NOT EXISTS "es_producto_compuesto" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prod_lista_compuesto_es_propio') THEN
    ALTER TABLE "prod_lista"
      ADD CONSTRAINT "prod_lista_compuesto_es_propio"
      CHECK (NOT "es_producto_compuesto" OR "es_producto_propio");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "prod_lista_compuestos" (
  "cod_tienda_compuesto"  TEXT NOT NULL,
  "cod_tienda_componente" TEXT NOT NULL,
  "cantidad"              DECIMAL(12,1) NOT NULL,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prod_lista_compuestos_pkey" PRIMARY KEY ("cod_tienda_compuesto", "cod_tienda_componente"),
  CONSTRAINT "prod_lista_compuestos_cantidad_positiva" CHECK ("cantidad" > 0),
  CONSTRAINT "prod_lista_compuestos_distintos" CHECK ("cod_tienda_compuesto" <> "cod_tienda_componente"),
  CONSTRAINT "prod_lista_compuestos_cod_tienda_compuesto_fkey"
    FOREIGN KEY ("cod_tienda_compuesto") REFERENCES "prod_lista"("cod_tienda")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "prod_lista_compuestos_cod_tienda_componente_fkey"
    FOREIGN KEY ("cod_tienda_componente") REFERENCES "prod_lista"("cod_tienda")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "prod_lista_compuestos_cod_tienda_componente_idx"
  ON "prod_lista_compuestos" ("cod_tienda_componente");
