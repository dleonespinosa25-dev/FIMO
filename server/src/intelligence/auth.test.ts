import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { login, requireCorporate } from "./auth.js";
import { resetIntel } from "./store.js";

describe("Acceso corporativo a Smart Intelligence", () => {
  it("rechaza credenciales inválidas", async () => {
    await resetIntel();
    await assert.rejects(() => login("nadie@demo", "bad"), /inválidas/i);
  });

  it("emite sesión y exige token para recursos", async () => {
    await resetIntel();
    const session = await login("inteligencia@farmaenlace.demo", "Intel2026!");
    assert.ok(session.token);
    const ok = await requireCorporate(session.token);
    assert.equal(ok.user.role, "marketing");
    await assert.rejects(() => requireCorporate("token-falso"), /Sesión corporativa/);
    await assert.rejects(() => requireCorporate(undefined), /Se requiere sesión/);
  });
});
