import { expect, it } from "bun:test";
import { randomBytes } from "node:crypto";
it("token del feed: 32 bytes aleatorios (256 bits) en 43 caracteres base64url", () => {
  const t = randomBytes(32).toString("base64url");
  expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(new Set(Array.from({ length: 50 }, () => randomBytes(32).toString("base64url"))).size).toBe(50);
});
