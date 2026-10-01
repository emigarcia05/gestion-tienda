-- Incluir el módulo principal Finanzas (`area-finanzas`) en el CHECK de `modulos_permitidos`.
-- Quien ya tiene Administración (`finanzas`) lo ve en el switcher sin esta fila;
-- el alta explícita queda habilitada cuando se aplica esta migración.

ALTER TABLE "personal"
  DROP CONSTRAINT IF EXISTS "personal_modulos_permitidos_check";

ALTER TABLE "personal"
  ADD CONSTRAINT "personal_modulos_permitidos_check"
  CHECK (
    "modulos_permitidos" <@ ARRAY[
      'gestion-productos',
      'finanzas',
      'marketing',
      'facturacion',
      'area-finanzas'
    ]::TEXT[]
  );
