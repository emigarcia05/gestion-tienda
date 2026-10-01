-- Facturación deja de ser un módulo principal. Quien solo tenía `facturacion`
-- pasa a Vendedor (`gestion-productos`).

UPDATE "personal"
SET "modulos_permitidos" = (
  SELECT COALESCE(array_agg(m ORDER BY ord), ARRAY[]::TEXT[])
  FROM (
    SELECT DISTINCT ON (m) m, ord
    FROM (
      SELECT
        CASE WHEN x = 'facturacion' THEN 'gestion-productos' ELSE x END AS m,
        ordinality AS ord
      FROM unnest("modulos_permitidos") WITH ORDINALITY AS t(x, ordinality)
    ) mapped
    ORDER BY m, ord
  ) uniq
)
WHERE 'facturacion' = ANY ("modulos_permitidos");

ALTER TABLE "personal"
  DROP CONSTRAINT IF EXISTS "personal_modulos_permitidos_check";

ALTER TABLE "personal"
  ADD CONSTRAINT "personal_modulos_permitidos_check"
  CHECK (
    "modulos_permitidos" <@ ARRAY[
      'gestion-productos',
      'finanzas',
      'marketing',
      'area-finanzas'
    ]::TEXT[]
  );
