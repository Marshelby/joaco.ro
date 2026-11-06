export type LocationSearchResult = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  type?: string;
};

export type LocationSearchProvider = (
  query: string,
  options: { signal: AbortSignal },
) => Promise<readonly LocationSearchResult[]>;
