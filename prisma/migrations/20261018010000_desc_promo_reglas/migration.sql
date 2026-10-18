-- POR_FORMA_PAGO: % por rubro / sub-rubro. Cabecera `desc` queda opcional (solo POR_ITEM).

ALTER TABLE "desc_promo" ALTER COLUMN "desc" DROP NOT NULL;

ALTER TABLE "desc_promo" DROP CONSTRAINT "desc_promo_desc_chk";
ALTER TABLE "desc_promo" ADD CONSTRAINT "desc_promo_desc_chk" CHECK ("desc" IS NULL OR ("desc" >= 0 AND "desc" <= 100));

CREATE TABLE "desc_promo_reglas" (
    "id" TEXT NOT NULL,
    "promo_id" TEXT NOT NULL,
    "id_rubro" TEXT NOT NULL,
    "id_sub_rubro" TEXT,
    "desc" INTEGER NOT NULL,

    CONSTRAINT "desc_promo_reglas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "desc_promo_reglas_desc_chk" CHECK ("desc" >= 0 AND "desc" <= 100)
);

CREATE INDEX "desc_promo_reglas_promo_id_idx" ON "desc_promo_reglas"("promo_id");
CREATE INDEX "desc_promo_reglas_id_rubro_idx" ON "desc_promo_reglas"("id_rubro");

CREATE UNIQUE INDEX "desc_promo_reglas_promo_rubro_todos_uidx"
  ON "desc_promo_reglas"("promo_id", "id_rubro")
  WHERE "id_sub_rubro" IS NULL;

CREATE UNIQUE INDEX "desc_promo_reglas_promo_rubro_sub_uidx"
  ON "desc_promo_reglas"("promo_id", "id_rubro", "id_sub_rubro")
  WHERE "id_sub_rubro" IS NOT NULL;

ALTER TABLE "desc_promo_reglas" ADD CONSTRAINT "desc_promo_reglas_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "desc_promo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "desc_promo_reglas" ADD CONSTRAINT "desc_promo_reglas_id_rubro_fkey" FOREIGN KEY ("id_rubro") REFERENCES "prod_rubros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "desc_promo_reglas" ADD CONSTRAINT "desc_promo_reglas_id_sub_rubro_id_rubro_fkey" FOREIGN KEY ("id_sub_rubro", "id_rubro") REFERENCES "prod_sub_rubros"("id", "id_rubro") ON DELETE RESTRICT ON UPDATE CASCADE;
