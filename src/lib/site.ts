import { getCollection, getEntry } from 'astro:content';

export async function getSettings() {
  const entry = await getEntry('settings', 'site');
  if (!entry) throw new Error('[settings] src/data/settings.yaml must define a top-level "site" entry.');
  return entry.data;
}

/** Subscribe links in the order they appear in src/data/subscribe.json. */
export async function getSubscribeLinks() {
  const links = await getCollection('subscribe');
  return links.map((link) => link.data).sort((a, b) => a.order - b.order);
}
