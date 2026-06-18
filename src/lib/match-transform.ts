export interface SourceChannel {
  title: string;
  link: string;
  api: string;
  tokenApi?: string;
}

export interface SourceMatch {
  id: string;
  title: string;
  image: string;
  cat: string;
  eventInfo: {
    teamA: string;
    teamB: string;
    teamAFlag: string;
    teamBFlag: string;
    eventName: string;
    Status: string;
    startTime: string;
    endTime: string;
  };
  channels_data: SourceChannel[];
}

export interface OutMatch {
  id: string;
  name: string;
  league: string;
  time: string;
  image: string;
  matchUrl: string;
  playerUrl: string;
  streamUrl: string;
  serverName: string;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\[|\]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slugifyUnderscore(s: string): string {
  return s
    .toLowerCase()
    .replace(/\[|\]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function matchSlug(m: SourceMatch): string {
  const a = m.eventInfo?.teamA;
  const b = m.eventInfo?.teamB;
  if (a && b) return `${slugify(a)}-vs-${slugify(b)}`;
  return slugify(m.id || m.title);
}

export function formatTime(iso: string): string {
  if (!iso) return "TBA";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "TBA";
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  // The source startTime carries +06:00. We want the local-of-source time.
  // Reparse as local-of-offset by using getHours on the original offset string.
  const tzMatch = iso.match(/([+-]\d{2}):?(\d{2})$/);
  if (tzMatch) {
    const sign = tzMatch[1].startsWith("-") ? -1 : 1;
    const offH = parseInt(tzMatch[1].slice(1), 10) * sign;
    const offM = parseInt(tzMatch[2], 10) * sign;
    const utc = d.getTime();
    const local = new Date(utc + (offH * 60 + offM) * 60_000);
    h = local.getUTCHours();
  }
  const ampm = h >= 12 ? "PM" : "AM";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function serverName(channelTitle: string): string {
  return channelTitle.replace(/\s*-\s*Server\s*\d+\s*$/i, "").trim();
}

export function transform(source: SourceMatch[], origin: string): {
  updatedAt: string;
  count: number;
  matches: OutMatch[];
} {
  const out: OutMatch[] = [];
  for (const m of source) {
    const mslug = matchSlug(m);
    const time = formatTime(m.eventInfo?.startTime || "");
    const image = m.eventInfo?.teamAFlag || m.image;
    const channels = m.channels_data || [];
    channels.forEach((ch, i) => {
      const id = i === 0 ? `${mslug}.html` : `${mslug}_${i}.html`;
      const sname = serverName(ch.title);
      const sslug = slugify(ch.title);
      const sUnderscore = slugifyUnderscore(sname);
      const playerUrl = `${origin}/${mslug}/${sslug}`;
      out.push({
        id,
        name: `${m.eventInfo.teamA} vs ${m.eventInfo.teamB} --- S${i + 1}`,
        league: "Live match",
        time,
        image,
        matchUrl: playerUrl,
        playerUrl,
        streamUrl: playerUrl,
        serverName: sname,
      });
      void sUnderscore;
    });
  }
  return {
    updatedAt: new Date().toISOString(),
    count: out.length,
    matches: out,
  };
}

export function findChannel(
  source: SourceMatch[],
  matchSlugStr: string,
  serverSlugStr: string,
): { match: SourceMatch; channel: SourceChannel } | null {
  for (const m of source) {
    if (matchSlug(m) !== matchSlugStr) continue;
    const ch = (m.channels_data || []).find((c) => slugify(c.title) === serverSlugStr);
    if (ch) return { match: m, channel: ch };
  }
  return null;
}

export const SOURCE_URL = "https://api6.photocard.fun/api1/match.json";

export async function fetchSource(): Promise<SourceMatch[]> {
  const res = await fetch(SOURCE_URL, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      accept: "application/json,*/*",
    },
  });
  if (!res.ok) throw new Error(`Source fetch failed: ${res.status}`);
  return (await res.json()) as SourceMatch[];
}