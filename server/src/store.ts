import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSeed } from "./seed.js";
import type { Database, User } from "./types.js";

function normalize(db: Database): Database {
  db.sessions ??= [];
  db.flowEvents ??= [];
  db.usedIdempotencyKeys ??= {};
  if (!db.users.some((u) => u.role === "CAJERO_DEMO" || u.id === "user-cajero")) {
    db.users.push({
      id: "user-cajero",
      name: "Caja VENDIX Demo",
      email: "cajero@farmaenlace.demo",
      phone: "+593 99 000 0003",
      isMember: false,
      memberTier: null,
      memberSince: null,
      role: "CAJERO_DEMO",
      password: "Caja2026!",
      customerCode: "STAFF-CAJA",
      virtualCard: "SW-DEMO-STAFF-CAJA",
      consentMarketing: false,
      termsAccepted: true,
      dataset: "live",
    });
  }
  for (const u of db.users) {
    const user = u as User;
    user.role ??= user.email?.includes("cajero") ? "CAJERO_DEMO" : "CLIENTE";
    user.password ??= null;
    user.customerCode ??= `SWC-${user.id.slice(-6).toUpperCase()}`;
    user.virtualCard ??= `SW-DEMO-${user.id.slice(-4).toUpperCase()}`;
    user.consentMarketing ??= false;
    user.termsAccepted ??= true;
    user.dataset ??= "live";
  }
  for (const r of db.recharges) {
    r.origin ??= "APP";
    r.tender ??= "processor_sim";
    r.cashierId ??= null;
  }
  return db;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "data", "db.json");

let cache: Database | null = null;
let writeChain: Promise<void> = Promise.resolve();

export async function loadDb(): Promise<Database> {
  if (cache) return cache;
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    cache = normalize(JSON.parse(raw) as Database);
    return cache;
  } catch {
    cache = createSeed();
    await persist(cache);
    return cache;
  }
}

export async function resetDb(): Promise<Database> {
  cache = createSeed();
  await persist(cache);
  return cache;
}

export async function mutate<T>(fn: (db: Database) => T): Promise<T> {
  const run = writeChain.then(async () => {
    const db = await loadDb();
    const result = fn(db);
    await persist(db);
    return result;
  });
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function persist(db: Database) {
  await mkdir(dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(db, null, 2), "utf8");
}
