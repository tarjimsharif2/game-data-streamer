import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchSource, findChannel, slugify, serverName } from "./match-transform";

export const getStream = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ matchId: z.string(), serverSlug: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const source = await fetchSource();
    const found = findChannel(source, data.matchId, data.serverSlug);
    if (!found) return { ok: false as const, reason: "not_found" as const };
    const { match, channel } = found;
    // api format "kid:key" hex
    const [kidHex, keyHex] = (channel.api || "").split(":");
    return {
      ok: true as const,
      title: `${match.eventInfo.teamA} vs ${match.eventInfo.teamB}`,
      serverName: serverName(channel.title),
      streamUrl: channel.link,
      kidHex: kidHex || "",
      keyHex: keyHex || "",
      // Convenience for client redirects
      matchSlug: slugify(`${match.eventInfo.teamA}-vs-${match.eventInfo.teamB}`),
    };
  });