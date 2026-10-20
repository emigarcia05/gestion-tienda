import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { query } from "../src/lib/db";

const envPath = join(__dirname, "..", ".env");
if (existsSync(envPath)) {
  const env = readFileSync(envPath, "utf-8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const a = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE imp_total <> TRUNC(imp_total))::int AS total_con_centavos,
            COUNT(*) FILTER (WHERE imp_cobrado <> TRUNC(imp_cobrado))::int AS cobrado_con_centavos
       FROM vtas_comprobantes`
  );
  console.log("vtas_comprobantes", a.rows[0]);
  const b = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE monto_cents % 100 <> 0)::int AS con_centavos
       FROM clientes_cobros`
  );
  console.log("clientes_cobros", b.rows[0]);
  const c = await query(
    `SELECT imp_total, imp_cobrado FROM vtas_comprobantes
      WHERE imp_total <> TRUNC(imp_total) ORDER BY fecha DESC LIMIT 5`
  );
  console.log("ejemplos", c.rows);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "error");
  process.exit(1);
});
