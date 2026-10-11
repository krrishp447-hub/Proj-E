import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", site.demoHref, site.filmHref].map((path) => ({ url: new URL(path, site.url).toString() }));
}
