import { beforeEach, describe, expect, test } from "bun:test";
import { dispositivoId, nombreLegibleDeDispositivo, olvidarDispositivoEnMemoria } from "./dispositivo";

describe("dispositivo", () => {
  beforeEach(() => olvidarDispositivoEnMemoria());
  test("nombres legibles", () => {
    expect(nombreLegibleDeDispositivo("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Mobile/15E148 Safari/604.1")).toBe("iPhone · Safari");
    expect(nombreLegibleDeDispositivo("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 CriOS/120 Mobile/15E148 Safari/604.1")).toBe("iPhone · Chrome");
    expect(nombreLegibleDeDispositivo("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edg/120")).toBe("Windows · Edge");
    expect(nombreLegibleDeDispositivo("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")).toBe("Android · Chrome");
    expect(nombreLegibleDeDispositivo("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605 Version/17 Safari/605")).toBe("Mac · Safari");
    expect(nombreLegibleDeDispositivo("")).toBe("Dispositivo");
  });
  test("el id es estable y no lanza sin localStorage", () => {
    const a = dispositivoId();
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(dispositivoId()).toBe(a);
  });
});
