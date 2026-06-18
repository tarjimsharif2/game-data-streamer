import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live Match API" },
      { name: "description", content: "Live match streaming JSON API and per-server player." },
      { property: "og:title", content: "Live Match API" },
      { property: "og:description", content: "Live match streaming JSON API and per-server player." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Live Match Player</h1>
      <p className="text-muted-foreground">
        Welcome. This service hosts live match player pages.
      </p>
    </div>
  );
}
