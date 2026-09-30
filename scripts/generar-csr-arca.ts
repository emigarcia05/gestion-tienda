/**
 * Genera clave RSA 2048 + CSR PKCS#10 para WSASS / ARCA.
 * Formato oficial: /C=AR/O=empresa/CN=sistema/serialNumber=CUIT 11digitos
 * Salida en certs/arca/{cuit}/ (gitignored). No commitear ni pegar la clave.
 *
 *   npx tsx scripts/generar-csr-arca.ts
 *   npx tsx scripts/generar-csr-arca.ts --cuit=20372672235 --cn=tienda-gestion-constancia
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const OPENSSL = "C:\\Program Files\\Git\\usr\\bin\\openssl.exe";
const CN_DEFAULT = "TiedaColorGestion";

function loadEnv(): void {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    if (process.env[key]) continue;
    process.env[key] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

function argCuit(): string | null {
  const raw = process.argv.find((a) => a.startsWith("--cuit="))?.slice("--cuit=".length) ?? "";
  const d = raw.replace(/\D/g, "");
  return d.length === 11 ? d : null;
}

function argCn(): string {
  const raw = (process.argv.find((a) => a.startsWith("--cn="))?.slice("--cn=".length) ?? "").trim();
  const cn = raw.replace(/[^A-Za-z0-9-]/g, "");
  return cn || CN_DEFAULT;
}

function opensslPath(): string {
  if (existsSync(OPENSSL)) return OPENSSL;
  const fromPath = spawnSync("openssl", ["version"], { encoding: "utf8" });
  if (fromPath.status === 0) return "openssl";
  throw new Error("No se encontró OpenSSL. Instalalo o usá Git for Windows (usr\\bin\\openssl.exe).");
}

function sanitizarOrg(nombre: string): string {
  return nombre
    .replace(/[/\\]/g, " ")
    .replace(/"/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64) || "TiedaColor";
}

function runOpenssl(bin: string, args: string[]): void {
  const r = spawnSync(bin, args, { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || "openssl falló").trim());
  }
}

async function emisoresDesdeDb(): Promise<{ cuit: string; titular: string }[]> {
  const { prisma } = await import("../src/lib/prisma");
  const rows = await prisma.globalPtoVta.findMany({
    where: { cuit: { not: null } },
    select: { cuit: true, titular: true },
    orderBy: { ptoVenta: "asc" },
  });
  await prisma.$disconnect();
  const vistos = new Set<string>();
  const out: { cuit: string; titular: string }[] = [];
  for (const row of rows) {
    const cuit = (row.cuit ?? "").replace(/\D/g, "");
    if (cuit.length !== 11 || vistos.has(cuit)) continue;
    vistos.add(cuit);
    out.push({ cuit, titular: row.titular });
  }
  return out;
}

function generarUno(
  bin: string,
  cuit: string,
  org: string,
  cn: string
): { csrPath: string; keyPath: string; subject: string } {
  const dir = join(ROOT, "certs", "arca", cuit);
  mkdirSync(dir, { recursive: true });
  const keyPath = join(dir, "privada.key");
  const csrPath = join(dir, "pedido.csr");
  const aliasPath = join(dir, `${cn}.csr`);
  const subj = `/C=AR/O=${sanitizarOrg(org)}/CN=${cn}/serialNumber=CUIT ${cuit}`;
  if (!existsSync(keyPath)) {
    runOpenssl(bin, ["genrsa", "-out", keyPath, "2048"]);
  }
  runOpenssl(bin, ["req", "-new", "-key", keyPath, "-subj", subj, "-out", csrPath]);
  copyFileSync(csrPath, aliasPath);
  const subjOut = spawnSync(bin, ["req", "-in", csrPath, "-noout", "-subject", "-nameopt", "RFC2253"], {
    encoding: "utf8",
  });
  return {
    csrPath: aliasPath,
    keyPath,
    subject: (subjOut.stdout || "").trim(),
  };
}

async function main(): Promise<void> {
  loadEnv();
  const bin = opensslPath();
  const filtro = argCuit();
  const cn = argCn();
  let emisores: { cuit: string; titular: string }[];
  try {
    emisores = await emisoresDesdeDb();
  } catch (e) {
    console.error("No se pudo leer ptos_vtas:", e instanceof Error ? e.message : e);
    emisores = [];
  }
  if (filtro) {
    const match = emisores.find((e) => e.cuit === filtro);
    emisores = match ? [match] : [{ cuit: filtro, titular: "TiedaColor" }];
  }
  if (emisores.length === 0) {
    throw new Error("No hay CUIT emisor. Pasá --cuit=XXXXXXXXXXX o cargá CUIT en ptos_vtas.");
  }
  for (const emisor of emisores) {
    const r = generarUno(bin, emisor.cuit, emisor.titular, cn);
    console.log(`CUIT ${emisor.cuit}`);
    console.log(`  ${r.subject}`);
    console.log(`  CSR: ${r.csrPath}`);
    console.log(`  Clave (no subir a ARCA, no commitear): ${r.keyPath}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
