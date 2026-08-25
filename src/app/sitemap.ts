import type { MetadataRoute } from "next";

const sitio = "https://www.hidroleufu.cl";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: sitio, changeFrequency: "weekly", priority: 1 },
    { url: `${sitio}/catalogo`, changeFrequency: "daily", priority: 0.9 },
  ];
}
