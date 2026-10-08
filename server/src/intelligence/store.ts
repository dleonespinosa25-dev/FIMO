import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createIntelligenceSeed, recomputeSaleEconomics } from "./seed.js";
import type { IntelligenceDatabase } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "..", "data", "intelligence.json");

let cache: IntelligenceDatabase | null = null;
let writeChain: Promise<void> = Promise.resolve();

export async function loadIntel(): Promise<IntelligenceDatabase> {
  if (cache) return cache;
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    cache = JSON.parse(raw) as IntelligenceDatabase;
    return cache;
  } catch {
    cache = createIntelligenceSeed();
    await persist(cache);
    return cache;
  }
}

export async function resetIntel(): Promise<IntelligenceDatabase> {
  cache = createIntelligenceSeed();
  await persist(cache);
  return cache;
}

export async function mutateIntel<T>(fn: (db: IntelligenceDatabase) => T): Promise<T> {
  const run = writeChain.then(async () => {
    const db = await loadIntel();
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

async function persist(db: IntelligenceDatabase) {
  await mkdir(dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(db), "utf8");
}

export async function applyMarginAssumptions(
  discountRateMonthly?: number,
  margins?: { brandId: string; contributionMarginRate: number }[],
) {
  return mutateIntel((db) => {
    if (typeof discountRateMonthly === "number" && discountRateMonthly >= 0 && discountRateMonthly < 0.2) {
      db.config.discountRateMonthly = discountRateMonthly;
    }
    if (margins?.length) {
      for (const row of margins) {
        const eco = db.brandEconomics.find((b) => b.brandId === row.brandId);
        if (!eco) continue;
        if (row.contributionMarginRate > 0 && row.contributionMarginRate < 0.9) {
          eco.contributionMarginRate = row.contributionMarginRate;
        }
      }
      db.sales = db.sales.map((s) => {
        const rate = db.brandEconomics.find((b) => b.brandId === s.brandId)?.contributionMarginRate ?? 0.25;
        return recomputeSaleEconomics(s, rate);
      });
    }
    return { config: db.config, brandEconomics: db.brandEconomics };
  });
}
