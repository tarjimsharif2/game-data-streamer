import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { fetchSource, transform, type OutMatch } from "./match-transform";

export const getMatches = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ count: number; matches: OutMatch[] }> => {
    const url = getRequestUrl();
    const source = await fetchSource();
    const data = transform(source, url.origin);
    return { count: data.count, matches: data.matches };
  },
);