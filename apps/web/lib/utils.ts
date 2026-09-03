import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Notice detail URLs: readable title slug + the uuid the route reads back
// via slug.slice(-36). Canonical here because sitemap.xml and every link
// must agree — a drifted copy silently publishes 404s to search engines.
// Devanagari is kept: stripping it left every Nepali notice at a bare
// "-<uuid>" URL, which is most of this corpus.
export function generateSlug(title: string, id: string): string {
  const slug = (title ?? "")
    .toLowerCase()
    // Full Devanagari block including U+0900-U+0903 combining marks, without
    // which "संविधान" splits into "स-विधान".
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[^a-z0-9ऀ-ॿ]+/g, "-")
    .replace(/(^-|-$)/g, "")
  return slug ? `${slug}-${id}` : id
}
