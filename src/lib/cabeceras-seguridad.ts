const CSP_MINIMA = "base-uri 'self'; object-src 'none'; frame-ancestors 'self'";

/** Cabeceras defensivas que no interfieren con recursos, PWA ni OAuth. */
export function conCabecerasSeguridad(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", CSP_MINIMA);
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

