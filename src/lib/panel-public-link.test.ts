import { describe, expect, it } from "bun:test";
import { decodeDemoProfile, encodeDemoProfile } from "./demo-profile";
import { salon } from "./mock/salon";
import { panelPublicLink } from "./panel-public-link";

describe("panelPublicLink", () => {
  const profile = { ...salon, name: "PeluChic", menu: ["Corte mujer~45~30"] };
  const demoRaw = encodeDemoProfile({ name: "PeluChic", menu: profile.menu });

  it("usa el nombre y conserva ?d= al abrir la web desde el panel", () => {
    expect(panelPublicLink(profile, null, true, demoRaw)).toBe(`/s/peluchic?d=${demoRaw}`);
  });

  it("reconstruye la demo y su carta tras navegar dentro del panel", () => {
    const link = panelPublicLink(profile, null, true);
    expect(link).toStartWith("/s/peluchic?d=");
    expect(decodeDemoProfile(new URL(link, "https://test.local").searchParams.get("d") ?? "")?.menu)
      .toEqual(profile.menu);
  });

  it("prioriza el slug real incluso si queda un parámetro de demo", () => {
    expect(panelPublicLink(profile, "salon-real", true, demoRaw)).toBe("/s/salon-real");
  });

  it("usa el slug del perfil sin demo", () => {
    expect(panelPublicLink(salon, null, false)).toBe(`/s/${salon.slug}`);
  });
});
