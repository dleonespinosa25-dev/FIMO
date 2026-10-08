import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { mulberry32, randInt } from "../intelligence/rng.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LAB_PATH = join(__dirname, "..", "..", "data", "lab.db");

let lab: DatabaseSync | null = null;

export function labDb() {
  if (lab) return lab;
  mkdirSync(dirname(LAB_PATH), { recursive: true });
  lab = new DatabaseSync(LAB_PATH);
  lab.exec(`
    CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      is_member INTEGER,
      segment TEXT,
      brands INTEGER,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT,
      brand_id TEXT,
      channel TEXT,
      revenue_cents INTEGER,
      contribution_cents INTEGER,
      sold_at TEXT
    );
    CREATE TABLE IF NOT EXISTS recharges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT,
      origin TEXT,
      amount_cents INTEGER,
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sales_cust ON sales(customer_id);
    CREATE INDEX IF NOT EXISTS idx_sales_brand ON sales(brand_id);
  `);
  return lab;
}

const BRANDS = ["farmacias-economicas", "medicity", "wellderma", "ambiente", "mascotas", "byd"];
const MARGIN: Record<string, number> = {
  "farmacias-economicas": 0.32,
  medicity: 0.28,
  wellderma: 0.4,
  ambiente: 0.25,
  mascotas: 0.3,
  byd: 0.18,
};

export function labStats() {
  const db = labDb();
  const num = (sql: string, key = "c") => Number((db.prepare(sql).get() as Record<string, number | string> | undefined)?.[key] ?? 0);
  const str = (sql: string) => String((db.prepare(sql).get() as { v?: string } | undefined)?.v ?? "");
  const customers = num("SELECT COUNT(*) AS c FROM customers");
  const sales = num("SELECT COUNT(*) AS c FROM sales");
  const recharges = num("SELECT COUNT(*) AS c FROM recharges");
  const revenue = num("SELECT COALESCE(SUM(revenue_cents),0) AS c FROM sales");
  const contrib = num("SELECT COALESCE(SUM(contribution_cents),0) AS c FROM sales");
  const recharged = num("SELECT COALESCE(SUM(amount_cents),0) AS c FROM recharges");
  const generatedAt = str("SELECT v FROM meta WHERE k='generatedAt'") || null;
  const genMs = Number(str("SELECT v FROM meta WHERE k='genMs'") || 0);
  const fileHint = LAB_PATH;
  return { customers, sales, recharges, movements: sales + recharges, revenue, contrib, recharged, generatedAt, genMs, fileHint };
}

export function generateLab(n: number) {
  const t0 = Date.now();
  const db = labDb();
  db.exec("DELETE FROM customers; DELETE FROM sales; DELETE FROM recharges;");
  const rand = mulberry32(50_000 + n);
  const insertC = db.prepare("INSERT INTO customers VALUES (?,?,?,?,?)");
  const insertS = db.prepare("INSERT INTO sales (customer_id, brand_id, channel, revenue_cents, contribution_cents, sold_at) VALUES (?,?,?,?,?,?)");
  const insertR = db.prepare("INSERT INTO recharges (customer_id, origin, amount_cents, created_at) VALUES (?,?,?,?)");
  const asOf = Date.parse("2026-10-08T12:00:00.000Z");
  db.exec("BEGIN");
  for (let i = 0; i < n; i++) {
    const id = `lab-${String(i).padStart(6, "0")}`;
    const bucket = i % 10;
    const segment =
      bucket === 0 ? "nuevos" : bucket === 1 ? "inactivos" : bucket === 2 ? "en_riesgo" : bucket === 3 ? "ocasionales" : bucket === 4 ? "reactivados" : "frecuentes";
    const brands = bucket === 5 || bucket === 6 ? 3 : bucket === 9 ? 1 : 2;
    insertC.run(id, rand() < 0.4 ? 1 : 0, segment, brands, new Date(asOf - randInt(rand, 30, 360) * 86400000).toISOString());
    const purchases = segment === "nuevos" ? randInt(rand, 1, 2) : segment === "inactivos" ? randInt(rand, 3, 6) : randInt(rand, 4, 14);
    for (let p = 0; p < purchases; p++) {
      let brand = BRANDS[p % (bucket === 9 ? 1 : brands)]!;
      if (brand === "byd" && rand() > 0.12) brand = "farmacias-economicas";
      const revenue = brand === "byd" ? randInt(rand, 8000, 90000) : randInt(rand, 700, 4500);
      const contribution = Math.round(revenue * (MARGIN[brand] ?? 0.25));
      const daysAgo =
        segment === "inactivos" ? randInt(rand, 120, 320) : segment === "en_riesgo" ? randInt(rand, 40, 90) : randInt(rand, 2, 200);
      insertS.run(id, brand, rand() < 0.55 ? "physical" : "online", revenue, contribution, new Date(asOf - daysAgo * 86400000).toISOString());
    }
    const recN = randInt(rand, 1, 4);
    for (let r = 0; r < recN; r++) {
      insertR.run(id, rand() < 0.6 ? "APP" : "POS", randInt(rand, 1000, 5000), new Date(asOf - randInt(rand, 5, 300) * 86400000).toISOString());
    }
    if (i > 0 && i % 2000 === 0) {
      db.exec("COMMIT; BEGIN");
    }
  }
  const genMs = Date.now() - t0;
  db.prepare("INSERT OR REPLACE INTO meta VALUES (?,?)").run("generatedAt", new Date().toISOString());
  db.prepare("INSERT OR REPLACE INTO meta VALUES (?,?)").run("genMs", String(genMs));
  db.prepare("INSERT OR REPLACE INTO meta VALUES (?,?)").run("n", String(n));
  db.exec("COMMIT");
  return { ...labStats(), genMs };
}

export function labKpis() {
  const t0 = Date.now();
  const db = labDb();
  const stats = labStats();
  const members = Number((db.prepare("SELECT COUNT(*) AS c FROM customers WHERE is_member=1").get() as { c: number } | undefined)?.c ?? 0);
  const bySeg = db.prepare("SELECT segment, COUNT(*) c FROM customers GROUP BY segment").all() as { segment: string; c: number }[];
  const byBrand = db.prepare("SELECT brand_id, COUNT(*) c, SUM(revenue_cents) rev, SUM(contribution_cents) contrib FROM sales GROUP BY brand_id").all();
  const aov = stats.sales ? Math.round(stats.revenue / stats.sales) : 0;
  const queryMs = Date.now() - t0;
  return {
    dataset: "lab",
    note: "Cifras del laboratorio masivo. Separado de Ana, Carlos y cuentas registradas. Mismas reglas de margen por marca. No afirma 50.000 usuarios simultáneos.",
    queryMs,
    ...stats,
    members,
    aov,
    avgContributionPerCustomer: stats.customers ? Math.round(stats.contrib / stats.customers) : 0,
    bySeg,
    byBrand,
    rechargeIsNotSale: true,
  };
}

export function labPage(limit = 40, offset = 0) {
  const db = labDb();
  const rows = db.prepare("SELECT * FROM customers ORDER BY id LIMIT ? OFFSET ?").all(limit, offset);
  return { rows, total: labStats().customers };
}
