-- INCLUYE DESCUENTO: solo aplica cuando el descuento se muestra en presupuestos.
ALTER TABLE "desc_promo"
  ADD COLUMN "incluye_descuento" BOOLEAN NOT NULL DEFAULT false;
