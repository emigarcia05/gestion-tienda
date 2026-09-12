-- Incluir área `facturacion` en el CHECK de `modulos_permitidos`
-- (MainAppAreaId / Usuarios). Antes anteriores: gestion-productos, finanzas, marketing.

ALTER TABLE "global_personal"
  DROP CONSTRAINT IF EXISTS "global_personal_modulos_permitidos_check";

ALTER TABLE "global_personal"
  ADD CONSTRAINT "global_personal_modulos_permitidos_check"
  CHECK (
    "modulos_permitidos" <@ ARRAY[
      'gestion-productos',
      'finanzas',
      'marketing',
      'facturacion'
    ]::TEXT[]
  );
