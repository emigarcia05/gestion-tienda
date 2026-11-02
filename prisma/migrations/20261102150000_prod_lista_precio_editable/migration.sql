-- PX. LISTA del remito / presupuesto se puede editar a mano solo si el ítem lo permite.
-- Filas ya cargadas quedan en false (el DEFAULT).
ALTER TABLE "prod_lista" ADD COLUMN "precio_editable" BOOLEAN NOT NULL DEFAULT false;
