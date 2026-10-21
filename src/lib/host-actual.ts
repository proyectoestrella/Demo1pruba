import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
export const hostActual = createIsomorphicFn()
  .server(() => {
    try {
      return new URL(getRequest().url).hostname;
    } catch {
      return "";
    }
  })
  .client(() => window.location.hostname);
export function esHostPeluchic() {
  return hostActual().toLowerCase() === "peluchic.sishow.es";
}
