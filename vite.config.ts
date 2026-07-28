// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel",
    // @lovable.dev/vite-tanstack-config hardcodes output.{dir,serverDir,publicDir}
    // to a plain dist/ folder regardless of preset — that layout isn't the Vercel
    // Build Output API (v3), so Vercel had nothing to run as a function (404s on
    // every route, 0 functions listed). Restate the "vercel" preset's own output
    // paths here so they survive the wrapper's spread.
    output: {
      dir: ".vercel/output",
      serverDir: ".vercel/output/functions/__server.func",
      publicDir: ".vercel/output/static",
    },
    // Enables Nitro's own filesystem routing (server/routes/**) for raw HTTP
    // endpoints (e.g. the .ics calendar feed) that need custom content-type
    // headers — createServerFn's RPC endpoints aren't suited for URLs meant
    // to be pasted into an external calendar app. It's a real Nitro option
    // the wrapper forwards as-is at runtime, but its TS type only models
    // {preset, output, cloudflare} — cast to bypass that narrow type, not a
    // runtime workaround.
    serverDir: "server",
    // @supabase/supabase-js's client constructor always tries to init its
    // Realtime (WebSocket) client, even when only REST methods are used.
    // Node 20 (Vercel's Node default) has no native WebSocket, so any route
    // calling createClient() 500s with "Node.js detected but native
    // WebSocket not found". Force Node 22 on all functions instead of
    // patching every Supabase call site.
    vercel: {
      functions: { runtime: "nodejs22.x" },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
});
