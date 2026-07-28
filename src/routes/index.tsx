import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/s/$salonSlug", params: { salonSlug: "los-mosqueteros" } });
  },
});
