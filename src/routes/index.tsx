import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getMatches } from "@/lib/matches.functions";

interface MatchItem {
  id: string;
  name: string;
  league: string;
  time: string;
  image: string;
  playerUrl: string;
  serverName: string;
}

const matchesQuery = queryOptions({
  queryKey: ["matches"],
  queryFn: () => getMatches() as Promise<{ count: number; matches: MatchItem[] }>,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live Match Player" },
      { name: "description", content: "Live match streaming player." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(matchesQuery),
  errorComponent: ({ error }) => (
    <div className="p-6 text-destructive">{error.message}</div>
  ),
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(matchesQuery);
  // group by match name
  const groups = new Map<string, MatchItem[]>();
  for (const m of data.matches) {
    const key = m.name.replace(/\s*---\s*S\d+\s*$/, "");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  return (
    <div className="min-h-screen bg-background text-foreground p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Live Matches ({groups.size})</h1>
      <div className="space-y-4">
        {[...groups.entries()].map(([name, servers]) => (
          <div key={name} className="border border-border rounded-lg p-3 bg-card">
            <div className="flex items-center gap-3 mb-2">
              {servers[0].image && (
                <img src={servers[0].image} alt="" className="w-10 h-10 rounded object-cover" />
              )}
              <div>
                <div className="font-semibold">{name}</div>
                <div className="text-xs text-muted-foreground">{servers[0].time}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {servers.map((s) => {
                const path = new URL(s.playerUrl).pathname;
                return (
                  <a
                    key={s.id}
                    href={path}
                    className="px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:opacity-90"
                  >
                    {s.serverName}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
