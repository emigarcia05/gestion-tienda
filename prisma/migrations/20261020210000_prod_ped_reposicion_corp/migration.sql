-- Piso corporativo de reposición (Administrador · REPOSICION CORP.).
CREATE TABLE "prod_ped_reposicion_corp" (
    "cod_tienda" TEXT NOT NULL,
    "forma_pedido" TEXT NOT NULL,
    "punto_pedido" INTEGER NOT NULL,
    "cant_conf" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prod_ped_reposicion_corp_pkey" PRIMARY KEY ("cod_tienda")
);

ALTER TABLE "prod_ped_reposicion_corp"
    ADD CONSTRAINT "prod_ped_reposicion_corp_forma_chk"
    CHECK ("forma_pedido" IN ('UNIDADES_MAX', 'POR_BULTO'));

ALTER TABLE "prod_ped_reposicion_corp"
    ADD CONSTRAINT "prod_ped_reposicion_corp_punto_chk"
    CHECK ("punto_pedido" >= 0);

ALTER TABLE "prod_ped_reposicion_corp"
    ADD CONSTRAINT "prod_ped_reposicion_corp_cant_chk"
    CHECK ("cant_conf" >= 1);

ALTER TABLE "prod_ped_reposicion_corp"
    ADD CONSTRAINT "prod_ped_reposicion_corp_cod_tienda_fkey"
    FOREIGN KEY ("cod_tienda") REFERENCES "prod_lista"("cod_tienda")
    ON DELETE CASCADE ON UPDATE CASCADE;
