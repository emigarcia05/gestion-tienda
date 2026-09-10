-- Marcas: rename catálogo; titular en Ptos. Vtas.; terminales DUX (id_dux + marca + titular).

ALTER TABLE "global_pto_vtas" RENAME COLUMN "nombre_pto_venta" TO "nombre_titular";

ALTER TABLE "fin_ana_cos_fina_terminales" RENAME TO "fin_ana_cos_fina_terminales_marcas";

ALTER TABLE "fin_ana_cos_fina_terminales_marcas"
  RENAME CONSTRAINT "fin_ana_cos_fina_terminales_pkey" TO "fin_ana_cos_fina_terminales_marcas_pkey";

ALTER INDEX "fin_ana_cos_fina_terminales_nombre_key"
  RENAME TO "fin_ana_cos_fina_terminales_marcas_nombre_key";

ALTER INDEX "fin_ana_cos_fina_terminales_orden_idx"
  RENAME TO "fin_ana_cos_fina_terminales_marcas_orden_idx";

DROP INDEX IF EXISTS "fin_ana_cos_fina_terminales_id_dux_key";

ALTER TABLE "fin_ana_cos_fina_terminales_marcas" DROP COLUMN IF EXISTS "id_dux";

CREATE TABLE "fin_ana_cos_fina_terminales" (
    "id" TEXT NOT NULL,
    "id_dux" TEXT NOT NULL,
    "marca_id" TEXT NOT NULL,
    "titular_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_ana_cos_fina_terminales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_ana_cos_fina_terminales_id_dux_key"
ON "fin_ana_cos_fina_terminales"("id_dux");

CREATE INDEX "fin_ana_cos_fina_terminales_marca_idx"
ON "fin_ana_cos_fina_terminales"("marca_id");

CREATE INDEX "fin_ana_cos_fina_terminales_titular_idx"
ON "fin_ana_cos_fina_terminales"("titular_id");

ALTER TABLE "fin_ana_cos_fina_terminales"
ADD CONSTRAINT "fin_ana_cos_fina_terminales_marca_id_fkey"
FOREIGN KEY ("marca_id") REFERENCES "fin_ana_cos_fina_terminales_marcas"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fin_ana_cos_fina_terminales"
ADD CONSTRAINT "fin_ana_cos_fina_terminales_titular_id_fkey"
FOREIGN KEY ("titular_id") REFERENCES "global_pto_vtas"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
