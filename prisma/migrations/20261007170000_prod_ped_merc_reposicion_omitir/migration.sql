-- «No pedir en este pedido»: la regla REPOSICION se conserva pero no suma cantidad hasta el próximo pedido del proveedor.
ALTER TABLE "prod_ped_merc"
  ADD COLUMN IF NOT EXISTS "reposicion_omitir_pedido" BOOLEAN NOT NULL DEFAULT false;
