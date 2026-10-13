-- `prod_lista.descripcion_tienda` se renombró a `descripcion` (20261008160000), pero PostgreSQL no reescribe
-- el cuerpo de funciones plpgsql: el trigger BEFORE INSERT OR UPDATE fallaba en toda escritura de prod_lista.
CREATE OR REPLACE FUNCTION public.fn_uppercase_precios_tienda()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.cod_tienda := public.upper_trim_or_null(NEW.cod_tienda);
  NEW.proveedor := public.upper_trim_or_null(NEW.proveedor);
  NEW.descripcion := public.upper_trim_or_null(NEW.descripcion);
  RETURN NEW;
END;
$function$;
