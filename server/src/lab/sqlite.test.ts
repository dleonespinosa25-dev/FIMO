import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateLab, labKpis } from "./sqlite.js";

describe("Simulation Lab", () => {
  it("genera 100 clientes LAB sin mezclarlos con cuentas LIVE", () => {
    const r = generateLab(100);
    assert.equal(r.customers, 100);
    assert.ok(r.sales > 100);
    assert.ok(r.recharges > 0);
    const k = labKpis();
    assert.equal(k.dataset, "lab");
    assert.equal(k.rechargeIsNotSale, true);
    assert.ok(k.queryMs >= 0);
  });
});
