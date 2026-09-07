-- Px Promo Fijo (USD) por ítem. Recrea px_compra_final_sin_iva:
-- con promo → USD × cotizacion_dolar × (1 + cx_transporte/100);
-- sin promo → fórmula previa (dto_* + desc_especial).

ALTER TABLE "prod_precios_provee"
  ADD COLUMN "px_promo_fijo" NUMERIC(14, 4);

ALTER TABLE "prod_precios_provee"
  ADD CONSTRAINT "prod_precios_provee_px_promo_fijo_positivo"
  CHECK ("px_promo_fijo" IS NULL OR "px_promo_fijo" > 0);

ALTER TABLE "prod_precios_provee"
  DROP COLUMN "px_compra_final_sin_iva";

ALTER TABLE "prod_precios_provee"
  ADD COLUMN "px_compra_final_sin_iva" NUMERIC(14, 4) GENERATED ALWAYS AS (
    CASE
      WHEN "px_promo_fijo" IS NOT NULL THEN
        "px_promo_fijo"
        * "cotizacion_dolar"
        * (1 + COALESCE("cx_transporte", 0)::numeric / 100)
      ELSE
        ("px_lista_proveedor" * (CASE WHEN "px_dolares" THEN "cotizacion_dolar" ELSE 1 END))
        * (
            1 - LEAST(
                  100,
                  GREATEST(
                    0,
                    COALESCE("dto_proveedor", 0)
                    + COALESCE("dto_marca", 0)
                    + COALESCE("dto_rubro", 0)
                    + COALESCE("dto_cantidad", 0)
                    + COALESCE("dto_financiero", 0)
                    + COALESCE("desc_especial", 0)
                  )
                )::numeric / 100
          )
        * (1 + COALESCE("cx_transporte", 0)::numeric / 100)
    END
  ) STORED;
