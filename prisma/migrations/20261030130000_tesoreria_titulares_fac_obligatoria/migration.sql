-- Factura Fiscal Obligatoria por titular: monto (pesos enteros > 0) y desde cuándo se descuenta.
-- Restante = monto − Σ ventas fiscales + Σ NC fiscales autorizadas de sus ptos. vta. con created_at >= desde.
ALTER TABLE "tesoreria_titulares"
    ADD COLUMN "fac_obligatoria_monto" INTEGER,
    ADD COLUMN "fac_obligatoria_desde" TIMESTAMP(3);

ALTER TABLE "tesoreria_titulares"
    ADD CONSTRAINT "tesoreria_titulares_fac_obligatoria_chk" CHECK (
        ("fac_obligatoria_monto" IS NULL AND "fac_obligatoria_desde" IS NULL)
        OR ("fac_obligatoria_monto" > 0 AND "fac_obligatoria_desde" IS NOT NULL)
    );
