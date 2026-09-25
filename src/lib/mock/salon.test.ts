import { describe, expect, it } from "bun:test";
import { employeesForType, servicesForType } from "./salon";
import { SERVICE_CATALOG } from "../business-type";

describe("employeesForType con equipo real", () => {
  it("sin team, da los tres profesionales de ejemplo del tipo", () => {
    const employees = employeesForType("barberia");
    expect(employees.map((e) => e.name)).toEqual(["Mario", "Diego", "Ruben"]);
  });

  it("con un solo nombre, da un único profesional", () => {
    const employees = employeesForType("barberia", ["Adam"]);
    expect(employees).toHaveLength(1);
    expect(employees[0].name).toBe("Adam");
    // El id, el color y el horario salen del primer BASE_EMPLOYEES (mario).
    expect(employees[0].id).toBe("mario");
    expect(employees[0].colorVar).toBe("--stylist-mario");
  });

  it("sin especialidad en el enlace, mantiene la especialidad de ejemplo del tipo", () => {
    const employees = employeesForType("barberia", ["Adam"]);
    expect(employees[0].specialty).toBe("Cortes clásicos y degradados");
  });

  it("con especialidad en el enlace, la usa en vez de la de ejemplo", () => {
    const employees = employeesForType("barberia", ["Adam~Navaja y afeitado"]);
    expect(employees[0].specialty).toBe("Navaja y afeitado");
  });

  it("con dos nombres, da dos profesionales en ese orden", () => {
    const employees = employeesForType("peluqueria", ["Sara", "Nico"]);
    expect(employees.map((e) => e.name)).toEqual(["Sara", "Nico"]);
    expect(employees.map((e) => e.id)).toEqual(["mario", "diego"]);
  });

  it("admite hasta seis profesionales", () => {
    const employees = employeesForType("barberia", ["A", "B", "C", "D"]);
    expect(employees).toHaveLength(4);
    expect(employees[3].id).toBe("profesional-4");
    expect(employeesForType("barberia", ["A", "B", "C", "D", "E", "F", "G"])).toHaveLength(6);
  });

  it("un array vacío se comporta como si no viniera team", () => {
    expect(employeesForType("barberia", [])).toHaveLength(3);
  });

  it("en barbería mantiene la foto de stock también con nombre real", () => {
    const [conNombreReal] = employeesForType("barberia", ["Adam"]);
    const [deEjemplo] = employeesForType("barberia");
    expect(conNombreReal.photo).toBe(deEjemplo.photo);
    expect(conNombreReal.photo.startsWith("data:image/svg+xml")).toBe(false);
  });

  it("fuera de barbería usa avatar de iniciales con el nombre real", () => {
    const [empleado] = employeesForType("peluqueria", ["Sara"]);
    expect(empleado.photo.startsWith("data:image/svg+xml")).toBe(true);
  });
});

describe("servicesForType con carta real", () => {
  it("sin menu, da el catálogo de ejemplo del tipo", () => {
    expect(servicesForType("barberia")).toEqual(SERVICE_CATALOG.barberia);
  });

  it("con menu, sustituye el catálogo entero", () => {
    const services = servicesForType("barberia", ["Corte~30~13", "Arreglo de barba~20~8"]);
    expect(services).toHaveLength(2);
    expect(services.map((s) => s.name)).toEqual(["Corte", "Arreglo de barba"]);
  });

  it("genera el id como slug del nombre", () => {
    const [servicio] = servicesForType("barberia", ["Corte + barba~45~18"]);
    expect(servicio.id).toBe("corte-barba");
  });

  it("category cae en 'Servicios' cuando no viene", () => {
    const [servicio] = servicesForType("barberia", ["Corte~30~13"]);
    expect(servicio.category).toBe("Servicios");
  });

  it("respeta la categoría cuando viene", () => {
    const [servicio] = servicesForType("barberia", ["Corte~30~13~Cortes"]);
    expect(servicio.category).toBe("Cortes");
  });

  it("desambigua ids cuando dos servicios comparten nombre", () => {
    const services = servicesForType("barberia", ["Corte~30~13", "Corte~40~20"]);
    expect(services.map((s) => s.id)).toEqual(["corte", "corte-2"]);
  });

  it("se corta a 60 entradas (el perfil de un salón; el enlace de demo se recorta a 12 al codificarse)", () => {
    const muchas = Array.from({ length: 62 }, (_, i) => `Servicio ${i}~30~10`);
    expect(servicesForType("barberia", muchas)).toHaveLength(60);
  });

  it("un array vacío se comporta como si no viniera menu", () => {
    expect(servicesForType("barberia", [])).toEqual(SERVICE_CATALOG.barberia);
  });

  it("todos los servicios generados quedan activos", () => {
    const services = servicesForType("barberia", ["Corte~30~13"]);
    expect(services.every((s) => s.active)).toBe(true);
  });
});

describe("servicesForType con ids escritos en la carta", () => {
  it("usa el id de la entrada aunque el nombre haya cambiado, y sigue derivándolo del nombre si no hay", () => {
    const servicios = servicesForType("peluqueria", ["Corte y peinado~30~18~~~corte", "Mechas~90~60~Color"]);
    expect(servicios.map((s) => s.id)).toEqual(["corte", "mechas"]);
    expect(servicios[0].name).toBe("Corte y peinado");
  });

  it("admite hasta 60 entradas en el perfil de un salón", () => {
    const menu = Array.from({ length: 60 }, (_, i) => `Servicio ${i}~10~5`);
    expect(servicesForType("peluqueria", menu)).toHaveLength(60);
  });
});
