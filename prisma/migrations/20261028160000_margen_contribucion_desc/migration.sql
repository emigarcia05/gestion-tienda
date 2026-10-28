-- Margen Contribución: DESC. por combinación forma × entidad × cuota (`cobros_cx_fin`).
-- Reemplaza `fin_ana_mc_descuento_fp` (DESC. por forma de pago); no se copian sus valores.

DROP TABLE IF EXISTS "fin_ana_mc_descuento_fp";

CREATE TABLE IF NOT EXISTS "margen_contribucion_desc" (
    "id" TEXT NOT NULL,
    "cx_fin_id" TEXT NOT NULL,
    "descuento_pct" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "margen_contribucion_desc_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "margen_contribucion_desc_pct_chk" CHECK ("descuento_pct" BETWEEN -100 AND 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS "margen_contribucion_desc_cx_fin_id_key" ON "margen_contribucion_desc"("cx_fin_id");

ALTER TABLE "margen_contribucion_desc" DROP CONSTRAINT IF EXISTS "margen_contribucion_desc_cx_fin_id_fkey";
ALTER TABLE "margen_contribucion_desc" ADD CONSTRAINT "margen_contribucion_desc_cx_fin_id_fkey" FOREIGN KEY ("cx_fin_id") REFERENCES "cobros_cx_fin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
