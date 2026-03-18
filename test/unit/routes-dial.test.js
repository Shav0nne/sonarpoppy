import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import dialRouter from "../../routes/dial.js";
import { DIAL_PRESETS } from "../../src/config/dial.js";

let server;
let baseUrl;

function createApp() {
  const app = express();
  app.use("/api/dial", dialRouter);
  return app;
}

before(async () => {
  const app = createApp();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => server?.close());

// REQ-005: GET /api/dial retourneert presets met filter+sort structuur
describe("GET /api/dial", () => {
  it("retourneert status 200", async () => {
    const res = await fetch(`${baseUrl}/api/dial`);
    assert.equal(res.status, 200);
  });

  it("retourneert presets array met 5 entries", async () => {
    const res = await fetch(`${baseUrl}/api/dial`);
    const body = await res.json();
    assert.equal(body.presets.length, 5);
  });

  it("presets matchen DIAL_PRESETS", async () => {
    const res = await fetch(`${baseUrl}/api/dial`);
    const body = await res.json();
    assert.deepEqual(body.presets, JSON.parse(JSON.stringify(DIAL_PRESETS)));
  });

  it("elke preset bevat filter, sortSignal, unplayedOnly (nieuwe structuur)", async () => {
    const res = await fetch(`${baseUrl}/api/dial`);
    const body = await res.json();
    for (const preset of body.presets) {
      assert.ok(preset.filter, `Stand ${preset.position}: filter ontbreekt`);
      assert.equal(typeof preset.filter.type, "string");
      assert.equal(typeof preset.sortSignal, "string");
      assert.equal(typeof preset.unplayedOnly, "boolean");
    }
  });

  it("presets bevatten GEEN weights property (oud model)", async () => {
    const res = await fetch(`${baseUrl}/api/dial`);
    const body = await res.json();
    for (const preset of body.presets) {
      assert.equal(preset.weights, undefined, `Stand ${preset.position}: weights moet weg zijn`);
    }
  });

  it("bevat default: 3", async () => {
    const res = await fetch(`${baseUrl}/api/dial`);
    const body = await res.json();
    assert.equal(body.default, 3);
  });

  it("bevat _links met self en recommendations", async () => {
    const res = await fetch(`${baseUrl}/api/dial`);
    const body = await res.json();
    assert.ok(body._links);
    assert.equal(body._links.self.href, "/api/dial");
    assert.equal(body._links.recommendations.href, "/api/recommendations");
  });
});
