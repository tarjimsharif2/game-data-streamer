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
      <h1 className="text-2xl font-bold mb-4">Live Match API</h1>
      <p className="mb-4 text-muted-foreground">
        Transformed live match feed. Each match × server is exposed as its own
        entry, with a per-server <code>playerUrl</code> on this domain.
      </p>
      <ul className="space-y-2">
        <li>
          <a className="text-primary underline" href="/api/match.json">
            /api/match.json
          </a>{" "}
          — JSON feed in the requested format.
        </li>
        <li>
          <code>/{`{match-slug}`}/{`{server-slug}`}</code> — player page for a
          specific match + server (e.g.{" "}
          <code>/portugal-vs-dr-congo/fox-sport-english-server-1</code>).
        </li>
      </ul>
    </div>
  );
}
