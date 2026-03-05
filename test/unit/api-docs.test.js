import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const docsPath = resolve(import.meta.dirname, "../../docs/api.md");
const content = readFileSync(docsPath, "utf-8");

describe("API docs", () => {
  it("REQ-001: docs/api.md exists and is not empty", () => {
    assert.ok(content.length > 0, "docs/api.md should not be empty");
  });

  describe("REQ-002: all 6 endpoints documented", () => {
    const endpoints = [
      "/api/genres",
      "/api/tracks",
      "/api/tracks/ingest",
      "/api/tracks/ingest-batch",
      "/api/profile/compute",
      "/api/recommendations",
    ];

    for (const endpoint of endpoints) {
      it(`documents ${endpoint}`, () => {
        assert.ok(content.includes(endpoint), `docs should mention ${endpoint}`);
      });
    }
  });

  describe("REQ-003: quick start section", () => {
    it("contains base URL", () => {
      assert.ok(content.includes("localhost:3000"), "should mention base URL");
    });

    it("contains Content-Type header", () => {
      assert.ok(content.includes("Content-Type"), "should mention Content-Type header");
    });

    it("describes the typical flow", () => {
      const hasGenresStep = content.includes("Genres ophalen") || content.includes("genres");
      const hasProfileStep = content.includes("Profiel berekenen") || content.includes("profile");
      const hasRecsStep =
        content.includes("Recommendations") || content.includes("recommendations");
      assert.ok(
        hasGenresStep && hasProfileStep && hasRecsStep,
        "should describe genres -> profile -> recommendations flow",
      );
    });
  });

  it("REQ-004: template section for adding endpoints", () => {
    assert.ok(
      content.includes("Endpoint toevoegen") || content.includes("endpoint toevoegen"),
      "should have a template section for adding new endpoints",
    );
  });
});
