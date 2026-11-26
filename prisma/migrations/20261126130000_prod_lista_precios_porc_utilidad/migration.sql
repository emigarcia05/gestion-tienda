-- PORC. UTILIDAD es el valor persistido. El PX de venta se recalcula con el costo vigente.
ALTER TABLE "prod_lista_precios"
  ADD COLUMN "porc_utilidad" DECIMAL(8, 2);

ALTER TABLE "prod_lista_precios_edicion"
  ADD COLUMN "porc_utilidad" DECIMAL(8, 2);

-- Costo simple: CX elegido (si está habilitado) o costo manual.
CREATE TEMP TABLE "_costo_px_lista" ON COMMIT DROP AS
SELECT
  pl.cod_tienda,
  CASE
    WHEN pl.es_producto_compuesto THEN COALESCE(comp.costo, 0)
    WHEN pl.costo_compra_cod_ext IS NOT NULL THEN
      CASE
        WHEN lp.habilitado THEN COALESCE(lp.px_compra_final_sin_iva, 0)
        ELSE 0
      END
    ELSE COALESCE(pl.costo_manual, 0)
  END AS costo
FROM prod_lista pl
LEFT JOIN proveedores_prod_lista lp
  ON lp.cod_ext = pl.costo_compra_cod_ext
LEFT JOIN (
  SELECT
    c.cod_tienda_compuesto,
    SUM(
      c.cantidad * (
        CASE
          WHEN comp.costo_compra_cod_ext IS NOT NULL THEN
            CASE
              WHEN lp2.habilitado THEN COALESCE(lp2.px_compra_final_sin_iva, 0)
              ELSE 0
            END
          ELSE COALESCE(comp.costo_manual, 0)
        END
      )
    ) AS costo
  FROM prod_lista_compuestos c
  JOIN prod_lista comp ON comp.cod_tienda = c.cod_tienda_componente
  LEFT JOIN proveedores_prod_lista lp2 ON lp2.cod_ext = comp.costo_compra_cod_ext
  GROUP BY c.cod_tienda_compuesto
) comp ON comp.cod_tienda_compuesto = pl.cod_tienda;

UPDATE prod_lista_precios p
SET porc_utilidad = GREATEST(
  0,
  round((((p.precio / 1.21) / c.costo) - 1) * 100, 2)
)
FROM _costo_px_lista c
WHERE c.cod_tienda = p.cod_tienda
  AND c.costo > 0
  AND p.precio > 0;

UPDATE prod_lista_precios_edicion e
SET porc_utilidad = GREATEST(
  0,
  round((((e.precio / 1.21) / c.costo) - 1) * 100, 2)
)
FROM _costo_px_lista c
WHERE c.cod_tienda = e.cod_tienda
  AND c.costo > 0
  AND e.precio > 0;
