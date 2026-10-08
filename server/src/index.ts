import cors from "cors";
import express from "express";
import os from "node:os";
import { resetDb, loadDb } from "./store.js";
import * as svc from "./services.js";
import * as intel from "./intelligence/api.js";
import * as ident from "./identity.js";
import { resetWalletLinkedSales } from "./intelligence/ingest.js";
import type { BrandId } from "./types.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

async function demoUser(req: express.Request) {
  const token = ident.bearer(req);
  if (token) {
    const { user } = await ident.requireRole(token, ["CLIENTE"]);
    return user.id;
  }
  const fallback = (req.header("x-demo-user-id") || req.body?.userId || req.query.userId || "user-general") as string;
  const db = await loadDb();
  const u = db.users.find((x) => x.id === fallback);
  if (!u || u.role !== "CLIENTE") {
    throw Object.assign(new Error("Cliente no autorizado."), { status: 401, code: "UNAUTHORIZED" });
  }
  return u.id;
}

function asyncHandler(
  fn: (req: express.Request, res: express.Response) => Promise<unknown>,
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    fn(req, res).catch(next);
  };
}

function lanAppOrigin() {
  const port = process.env.APP_PORT || "5173";
  const nets = os.networkInterfaces();
  for (const addrs of Object.values(nets)) {
    for (const a of addrs ?? []) {
      const family = String(a.family);
      if ((family === "IPv4" || family === "4") && !a.internal) {
        return `http://${a.address}:${port}`;
      }
    }
  }
  return `http://localhost:${port}`;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "SMARTWALLET Demo API",
    official: false,
    message: "Prototipo local. Sin bancos, sin VENDIX real y sin SmartClub oficial.",
  });
});

app.get(
  "/api/catalog",
  asyncHandler(async (_req, res) => {
    const db = await loadDb();
    res.json({
      users: db.users.filter((u) => u.role === "CLIENTE" && u.dataset === "live").map((u) => ident.publicUser(u)),
      brands: db.brands,
      products: db.products,
      membership: db.membership,
      publicAppUrl: process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || null,
    });
  }),
);

app.get("/api/demo/signup-url", (_req, res) => {
  const lan = lanAppOrigin();
  const https = process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || null;
  const base = (https || lan).replace(/\/$/, "");
  res.json({
    lanOrigin: lan,
    httpsOrigin: https,
    signupUrl: `${base}/registro`,
    note: "El QR de captación abre el formulario de SmartWallet. No es el QR de cobro de VENDIX.",
  });
});

app.post(
  "/api/demo/reset",
  asyncHandler(async (_req, res) => {
    const db = await resetDb();
    await resetWalletLinkedSales();
    res.json({ ok: true, message: "Datos de demostración restaurados.", users: db.users });
  }),
);

app.post(
  "/api/auth/register",
  asyncHandler(async (req, res) => {
    res.status(201).json(await ident.registerClient(req.body ?? {}));
  }),
);
app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    res.json(await ident.loginWithRole(String(req.body?.email || ""), String(req.body?.password || ""), ["CLIENTE"]));
  }),
);
app.post(
  "/api/pos/login",
  asyncHandler(async (req, res) => {
    res.json(await ident.loginWithRole(String(req.body?.email || ""), String(req.body?.password || ""), ["CAJERO_DEMO"]));
  }),
);
app.post(
  "/api/auth/logout",
  asyncHandler(async (req, res) => {
    res.json(await ident.logout(ident.bearer(req)));
  }),
);
app.get(
  "/api/me",
  asyncHandler(async (req, res) => {
    const token = ident.bearer(req);
    if (!token) {
      res.json({ user: null });
      return;
    }
    const { user } = await ident.requireRole(token, ["CLIENTE", "CAJERO_DEMO", "ADMIN_EMPRESA"]);
    res.json({ user: ident.publicUser(user) });
  }),
);
app.post(
  "/api/pos/recharges",
  asyncHandler(async (req, res) => {
    const { user } = await ident.requireRole(ident.bearer(req), ["CAJERO_DEMO"]);
    const amountCents = Number(req.body?.amountCents);
    res.status(201).json(
      await ident.posRecharge({
        cashierId: user.id,
        cashierName: user.name,
        lookup: String(req.body?.lookup || ""),
        amountCents,
        tender: req.body?.tender === "card_sim" ? "card_sim" : "cash_sim",
        idempotencyKey: String(req.body?.idempotencyKey || ""),
      }),
    );
  }),
);

app.get(
  "/api/wallet",
  asyncHandler(async (req, res) => {
    res.json(await svc.walletSnapshot(await demoUser(req)));
  }),
);

app.get(
  "/api/wallet/movements/:id",
  asyncHandler(async (req, res) => {
    res.json(await svc.getMovement(await demoUser(req), req.params.id));
  }),
);

app.post(
  "/api/recharges",
  asyncHandler(async (req, res) => {
    const amountCents = Number(req.body?.amountCents);
    res.status(201).json(await svc.requestRecharge(await demoUser(req), amountCents));
  }),
);

app.post(
  "/api/recharges/:id/simulate",
  asyncHandler(async (req, res) => {
    const outcome = req.body?.outcome as "approved" | "rejected";
    if (outcome !== "approved" && outcome !== "rejected") {
      res.status(400).json({ error: "Indique outcome approved o rejected." });
      return;
    }
    res.json(await svc.settleRecharge(req.params.id, outcome));
  }),
);

app.post(
  "/api/orders",
  asyncHandler(async (req, res) => {
    const { brandId, channel, items, userId } = req.body ?? {};
    if (channel !== "physical" && channel !== "online") {
      res.status(400).json({ error: "channel debe ser physical u online." });
      return;
    }
    res.status(201).json(
      await svc.createPaymentOrder({
        brandId: brandId as BrandId,
        channel,
        items,
        userId: userId ?? null,
      }),
    );
  }),
);

app.get(
  "/api/orders/:id",
  asyncHandler(async (req, res) => {
    res.json(await svc.getOrder(req.params.id, await demoUser(req)));
  }),
);

app.post(
  "/api/payments/confirm",
  asyncHandler(async (req, res) => {
    const { orderId, reference, idempotencyKey } = req.body ?? {};
    const result = await svc.confirmPayment({
      orderIdOrRef: orderId || reference,
      userId: await demoUser(req),
      idempotencyKey,
    });
    res.status(result.ok ? 200 : 409).json(result);
  }),
);

app.post(
  "/api/payments/cancel",
  asyncHandler(async (req, res) => {
    const { orderId, reference } = req.body ?? {};
    res.json(await svc.cancelOrder(orderId || reference, await demoUser(req)));
  }),
);

app.post(
  "/api/online/checkout",
  asyncHandler(async (req, res) => {
    const { brandId, items, idempotencyKey } = req.body ?? {};
    const created = await svc.createPaymentOrder({
      brandId,
      channel: "online",
      items,
      userId: await demoUser(req),
    });
    const paid = await svc.confirmPayment({
      orderIdOrRef: created.order.id,
      userId: await demoUser(req),
      idempotencyKey: idempotencyKey || created.order.id,
    });
    res.status(paid.ok ? 201 : 409).json({ ...paid, createdOrder: created.order });
  }),
);

app.post(
  "/api/refunds",
  asyncHandler(async (req, res) => {
    res.json(await svc.refundMovement(req.body?.movementId));
  }),
);

app.get(
  "/api/admin/stats",
  asyncHandler(async (_req, res) => {
    res.json(await svc.adminStats());
  }),
);

app.post("/api/intelligence/login", asyncHandler(intel.postLogin));
app.post("/api/intelligence/logout", asyncHandler(intel.postLogout));
app.get("/api/intelligence/me", asyncHandler(intel.getMe));
app.get("/api/intelligence/overview", asyncHandler(intel.getOverview));
app.get("/api/intelligence/customers", asyncHandler(intel.getCustomers));
app.get("/api/intelligence/customers/:id", asyncHandler(intel.getCustomer));
app.get("/api/intelligence/segmentation", asyncHandler(intel.getSegmentation));
app.get("/api/intelligence/clv", asyncHandler(intel.getClv));
app.patch("/api/intelligence/assumptions", asyncHandler(intel.patchAssumptions));
app.get("/api/intelligence/cross-brand", asyncHandler(intel.getCross));
app.get("/api/intelligence/nba", asyncHandler(intel.getNba));
app.post("/api/intelligence/nba/:id/decision", asyncHandler(intel.postNbaDecision));
app.get("/api/intelligence/campaigns", asyncHandler(intel.getCampaigns));
app.post("/api/intelligence/campaigns/:id/decision", asyncHandler(intel.postCampaignDecision));
app.post("/api/intelligence/campaigns/:id/simulate", asyncHandler(intel.postCampaignSimulate));
app.get("/api/intelligence/wallet-performance", asyncHandler(intel.getWalletPerf));
app.post("/api/intelligence/reset", asyncHandler(intel.postResetIntel));
app.get("/api/intelligence/flow", asyncHandler(intel.getFlow));
app.get("/api/intelligence/lab", asyncHandler(intel.getLab));
app.post("/api/intelligence/lab/generate", asyncHandler(intel.postLabGenerate));
app.get("/api/intelligence/lab/customers", asyncHandler(intel.getLabCustomers));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const e = err as { status?: number; message?: string; code?: string; extra?: unknown };
  const status = e.status ?? 500;
  res.status(status).json({
    error: e.message || "Error interno del demo",
    code: e.code || "DEMO_ERROR",
    ...(e.extra && typeof e.extra === "object" ? e.extra : {}),
  });
});

app.listen(PORT, () => {
  console.log(`SMARTWALLET backend de demostración en http://localhost:${PORT}`);
  console.log("Prototipo no oficial. Sin conexiones bancarias.");
});
