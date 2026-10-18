-- Descuentos promocionales: cabecera + N:M a productos o formas de pago.

CREATE TYPE "desc_promo_tipo" AS ENUM ('POR_ITEM', 'POR_FORMA_PAGO');

CREATE TABLE "desc_promo" (
    "id" TEXT NOT NULL,
    "tipo" "desc_promo_tipo" NOT NULL,
    "nombre" TEXT NOT NULL,
    "desc" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "desc_promo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "desc_promo_desc_chk" CHECK ("desc" >= 0 AND "desc" <= 100)
);

CREATE INDEX "desc_promo_tipo_idx" ON "desc_promo"("tipo");

CREATE TABLE "desc_promo_items" (
    "promo_id" TEXT NOT NULL,
    "cod_tienda" TEXT NOT NULL,

    CONSTRAINT "desc_promo_items_pkey" PRIMARY KEY ("promo_id","cod_tienda")
);

CREATE INDEX "desc_promo_items_cod_tienda_idx" ON "desc_promo_items"("cod_tienda");

CREATE TABLE "desc_promo_formas_pago" (
    "promo_id" TEXT NOT NULL,
    "pago_id" TEXT NOT NULL,

    CONSTRAINT "desc_promo_formas_pago_pkey" PRIMARY KEY ("promo_id","pago_id")
);

CREATE INDEX "desc_promo_formas_pago_pago_id_idx" ON "desc_promo_formas_pago"("pago_id");

ALTER TABLE "desc_promo_items" ADD CONSTRAINT "desc_promo_items_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "desc_promo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "desc_promo_items" ADD CONSTRAINT "desc_promo_items_cod_tienda_fkey" FOREIGN KEY ("cod_tienda") REFERENCES "prod_lista"("cod_tienda") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "desc_promo_formas_pago" ADD CONSTRAINT "desc_promo_formas_pago_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "desc_promo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "desc_promo_formas_pago" ADD CONSTRAINT "desc_promo_formas_pago_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "cobros_forma_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
