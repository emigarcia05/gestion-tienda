-- cobros_vinc_cajas: costo_incluye_iva era siempre NOT genera_iva_credito.
-- Queda solo genera_iva_credito (TRUE → Cx Fin S/ IVA; FALSE → C/ IVA).
ALTER TABLE "cobros_vinc_cajas" DROP COLUMN IF EXISTS "costo_incluye_iva";
