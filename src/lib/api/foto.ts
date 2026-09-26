/**
 * Lógica de `/api/foto` (ver la ruta para el porqué), separada para poder
 * probarla sin red. Barrido de calidad 2026-09-26: un ID que Google no
 * conoce es un 404, no un 502; y un fallo de red hacia Google ya no se
 * escapa como 500 sin mensaje.
 */
/** Los IDs de Places son alfanuméricos con guiones; nada más entra aquí. */
const ID_VALIDO = /^[A-Za-z0-9_-]{5,300}$/;

/** Respuesta de error que no se cachea, para poder reintentar al arreglarlo. */
function error(mensaje: string, status: number) {
  return new Response(mensaje, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function servirFoto(
  request: Request,
  key: string | undefined,
  pedir: typeof fetch = fetch,
): Promise<Response> {
  try {
    return await servirFotoSinRed(request, key, pedir);
  } catch (err) {
    console.error("api/foto: fallo al hablar con Google:", err);
    return error("No se pudo contactar con Google para traer la foto", 502);
  }
}

async function servirFotoSinRed(
  request: Request,
  key: string | undefined,
  fetch: typeof globalThis.fetch,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const placeId = params.get("place");
  // Qué foto de las que tiene el local: 0 es la portada, el resto la galería.
  const index = Math.min(Math.max(Number(params.get("i") ?? 0) || 0, 0), 9);

  // Se valida la forma antes de reenviar nada: sin esta comprobación el
  // parámetro sería una vía para lanzar peticiones arbitrarias firmadas
  // con nuestra clave.
  if (!placeId || !ID_VALIDO.test(placeId)) {
    return error("Identificador de sitio no válido", 400);
  }

  if (!key) return error("Falta configurar GOOGLE_MAPS_API_KEY", 503);

  // Paso 1: pedir a Places cuál es la foto de ese sitio.
  const detalles = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "photos",
      },
    },
  );

  if (detalles.status === 400 || detalles.status === 404) {
    // Google no reconoce ese ID: es un dato de entrada malo, no una avería.
    return error("Ese sitio no existe en Google", 404);
  }
  if (!detalles.ok) {
    return error(`Google respondió ${detalles.status} al buscar la foto`, 502);
  }

  const json = (await detalles.json()) as { photos?: Array<{ name?: string }> };
  // Se identifica la foto por su posición y no por su nombre porque el
  // nombre que devuelve Places es un token de un solo uso: pedirle dos
  // veces la misma ficha da diez identificadores distintos. El orden, en
  // cambio, se mantiene. Ver lib/demo-photos.ts.
  const referencia = json.photos?.[index]?.name;
  if (!referencia) return error("Ese sitio no tiene esa foto en Google", 404);

  // Paso 2: traer la imagen y devolverla tal cual.
  const imagen = await fetch(
    `https://places.googleapis.com/v1/${referencia}/media?maxWidthPx=1600&key=${key}`,
    { redirect: "follow" },
  );

  if (!imagen.ok || !imagen.body) {
    return error(
      "No se pudo descargar la foto",
      imagen.status >= 400 && imagen.status < 500 ? 404 : 502,
    );
  }

  return new Response(imagen.body, {
    headers: {
      "Content-Type": imagen.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
