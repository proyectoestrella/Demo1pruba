import { expect, it } from "bun:test";
import { existsSync } from "node:fs";

it("no deja una server function de ejemplo sin ruta ni consumidor", () => {
  expect(existsSync(new URL("./example.functions.ts", import.meta.url))).toBe(false);
});
