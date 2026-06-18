import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { getStream } from "@/lib/match-lookup.functions";

export const Route = createFileRoute("/$matchId/$serverSlug")({
  head: () => ({
    meta: [
      { title: "Live Player" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
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

function toBase64Url(hex: string): string {
  // hex -> bytes -> base64url
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  let b = "";
  for (let i = 0; i < bytes.length; i++) b += String.fromCharCode(bytes[i]);
  return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

declare global {
  interface Window {
    shaka?: any;
  }
}

function loadShaka(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.shaka) return Promise.resolve(window.shaka);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/shaka-player@4.11.2/dist/shaka-player.compiled.min.js";
    s.async = true;
    s.onload = () => (window.shaka ? resolve(window.shaka) : reject(new Error("shaka missing")));
    s.onerror = () => reject(new Error("Failed to load shaka"));
    document.head.appendChild(s);
  });
}

function PlayerPage() {
  const { matchId, serverSlug } = Route.useParams();
  const getStreamFn = useServerFn(getStream);
  const { data, isLoading, error } = useQuery({
    queryKey: ["stream", matchId, serverSlug],
    queryFn: () => getStreamFn({ data: { matchId, serverSlug } }),
  });
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!data || !data.ok || !videoRef.current) return;
    let player: any;
    let cancelled = false;
    (async () => {
      try {
        const shaka = await loadShaka();
        if (cancelled) return;
        shaka.polyfill.installAll();
        if (!shaka.Player.isBrowserSupported()) {
          console.error("Browser not supported");
          return;
        }
        player = new shaka.Player(videoRef.current);
        if (data.kidHex && data.keyHex) {
          player.configure({
            drm: {
              clearKeys: {
                [toBase64Url(data.kidHex)]: toBase64Url(data.keyHex),
              },
            },
          });
        }
        await player.load(data.streamUrl);
      } catch (e) {
        console.error("Player error:", e);
      }
    })();
    return () => {
      cancelled = true;
      if (player) player.destroy();
    };
  }, [data]);

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

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <div className="flex-1 flex items-center justify-center">
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          className="w-full h-full max-h-screen"
        />
      </div>
      <div className="p-3 text-center text-sm">
        <div className="font-semibold">{data.title}</div>
        <div className="opacity-70">{data.serverName}</div>
      </div>
    </div>
  );
}