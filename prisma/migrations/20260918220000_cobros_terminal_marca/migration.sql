-- Marcas Cx. Fin. Cobros: cx_fin_cobro_marcas → cobros_terminal_marca
-- Idempotente: Neon pudo aplicar 20260918200000 (tabla cobros_cx_fin_marcas).
-- 20260918250000 pasa cobros_cx_fin_marcas / cobros_terminal_marca → cobros_terminales.

DO $$
BEGIN
  IF to_regclass('public.cobros_terminal_marca') IS NOT NULL THEN
    NULL;
  ELSIF to_regclass('public.cx_fin_cobro_marcas') IS NOT NULL THEN
    ALTER TABLE "cx_fin_cobro_marcas" RENAME TO "cobros_terminal_marca";
  ELSIF to_regclass('public.cobros_cx_fin_marcas') IS NOT NULL THEN
    NULL;
  ELSIF to_regclass('public.cobros_terminales') IS NOT NULL THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'No se encontró cx_fin_cobro_marcas ni sucesor para cobros_terminal_marca';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.cobros_terminal_marca') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cx_fin_cobro_marcas_pkey') THEN
    ALTER TABLE "cobros_terminal_marca"
      RENAME CONSTRAINT "cx_fin_cobro_marcas_pkey" TO "cobros_terminal_marca_pkey";
  END IF;

  IF to_regclass('public.cx_fin_cobro_marcas_nombre_key') IS NOT NULL THEN
    ALTER INDEX "cx_fin_cobro_marcas_nombre_key" RENAME TO "cobros_terminal_marca_nombre_key";
  END IF;

  IF to_regclass('public.cx_fin_cobro_marcas_orden_idx') IS NOT NULL THEN
    ALTER INDEX "cx_fin_cobro_marcas_orden_idx" RENAME TO "cobros_terminal_marca_orden_idx";
  END IF;
END $$;
