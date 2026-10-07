/**
 * Turn an episode title into a URL slug.
 * "Between Stone & Sky: Episode 01" -> "between-stone-and-sky-episode-01"
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** True if the value is already a valid slug (lowercase letters, digits, single hyphens). */
export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
