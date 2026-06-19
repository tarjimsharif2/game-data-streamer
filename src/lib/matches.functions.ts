import { createServerFn } from "@tanstack/react-start";
import { getRequestURL } from "@tanstack/react-start/server";
import { fetchSource, transform, type OutMatch } from "./match-transform";

export const getMatches = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ count: number; matches: OutMatch[] }> => {
    const url = getRequestURL();
    const source = await fetchSource();
    const data = transform(source, url.origin);
    return { count: data.count, matches: data.matches };
  },
);