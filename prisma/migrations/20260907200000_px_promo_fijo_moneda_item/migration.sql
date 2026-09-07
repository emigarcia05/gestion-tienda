-- Px Promo Fijo en moneda del ítem (misma que px_lista_proveedor / px_dolares).
-- Ítems ARS: el valor estaba en USD y se multiplicaba siempre por cotizacion_dolar;
-- se convierte a pesos y se restaura cotizacion_dolar = 1.
-- Generated: promo × (cotización si px_dolares, si no 1) × (1 + cx_transporte/100).

UPDATE "prod_precios_provee"
SET
  "px_promo_fijo" = ROUND("px_promo_fijo" * "cotizacion_dolar", 4),
  "cotizacion_dolar" = 1
WHERE "px_promo_fijo" IS NOT NULL
  AND "px_dolares" = false
  AND "cotizacion_dolar" IS DISTINCT FROM 1;

ALTER TABLE "prod_precios_provee"
  DROP COLUMN "px_compra_final_sin_iva";

ALTER TABLE "prod_precios_provee"
  ADD COLUMN "px_compra_final_sin_iva" NUMERIC(14, 4) GENERATED ALWAYS AS (
    CASE
      WHEN "px_promo_fijo" IS NOT NULL THEN
        "px_promo_fijo"
        * (CASE WHEN "px_dolares" THEN "cotizacion_dolar" ELSE 1 END)
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
