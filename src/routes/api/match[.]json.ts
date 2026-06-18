import { createFileRoute } from "@tanstack/react-router";
import { fetchSource, transform } from "@/lib/match-transform";

export const Route = createFileRoute("/api/match.json")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const origin = new URL(request.url).origin;
          const source = await fetchSource();
          const data = transform(source, origin);
          return new Response(JSON.stringify(data, null, 2), {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=60",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({ error: (err as Error).message }, null, 2),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});