import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { ShakaPlayer } from "@/components/ShakaPlayer";
import { getStream } from "@/lib/match-lookup.functions";

export const Route = createFileRoute("/$matchId/$serverSlug")({
  head: () => ({
    meta: [
      { title: "Live Player" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PlayerPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <p className="mb-4">Failed to load: {error.message}</p>
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded bg-white px-4 py-2 text-black"
          >
            Retry
          </button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      Stream not found.
    </div>
  ),
});

function PlayerPage() {
  const { matchId, serverSlug } = Route.useParams();
  const getStreamFn = useServerFn(getStream);
  const { data, isLoading, error } = useQuery({
    queryKey: ["stream", matchId, serverSlug],
    queryFn: () => getStreamFn({ data: { matchId, serverSlug } }),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        Loading…
      </div>
    );
  }
  if (error || !data || !data.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        Stream not found.
      </div>
    );
  }

  const drm =
    data.kidHex && data.keyHex ? { [data.kidHex]: data.keyHex } : null;

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col">
      <div className="flex items-center gap-3 p-3 bg-black/80 z-10">
        <Link to="/" className="flex items-center gap-1 text-sm opacity-80 hover:opacity-100">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="text-sm">
          <div className="font-semibold">{data.title}</div>
          <div className="opacity-70 text-xs">{data.serverName}</div>
        </div>
      </div>
      <div className="flex-1 relative">
        <ShakaPlayer
          src={data.streamUrl}
          type="dash"
          title={`${data.title} — ${data.serverName}`}
          drm={drm}
        />
      </div>
    </div>
  );
}
