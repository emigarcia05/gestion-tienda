-- Bloque de formas de pago del presupuesto. Activo por defecto; el texto se guarda al emitir.
ALTER TABLE "vtas_comprobantes" ADD COLUMN "mostrar_formas_pago" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "vtas_comprobantes" ADD COLUMN "formas_pago_pdf" TEXT;
