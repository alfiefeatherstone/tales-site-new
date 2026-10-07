import { getCollection, type CollectionEntry } from 'astro:content';
import { getEpisodes } from './feed';

export type Transcript = CollectionEntry<'transcripts'>;

declare global {
  // eslint-disable-next-line no-var
  var __talesTranscriptReport: boolean | undefined;
}

/** Published (non-draft) transcripts keyed by episode slug. */
export async function getTranscriptMap(): Promise<Map<string, Transcript>> {
  const entries = await getCollection('transcripts', (entry) => !entry.data.draft);
  return new Map(entries.map((entry) => [entry.id, entry]));
}

/**
 * Log, once per process, which episodes lack a usable transcript and which
 * transcript files (draft or not) match no episode.
 */
export async function reportTranscriptCoverage(): Promise<void> {
  if (globalThis.__talesTranscriptReport) return;
  globalThis.__talesTranscriptReport = true;

  const [episodes, all] = await Promise.all([getEpisodes(), getCollection('transcripts')]);
  const slugs = new Set(episodes.map((e) => e.slug));
  const published = new Set(all.filter((t) => !t.data.draft).map((t) => t.id));

  const missing = episodes.filter((e) => !published.has(e.slug));
  const orphans = all.filter((t) => !slugs.has(t.id));

  if (missing.length) {
    console.warn(
      `[transcripts] ${missing.length} of ${episodes.length} episodes have no published transcript:\n` +
        missing.map((e) => `  - ${e.slug}`).join('\n'),
    );
  }
  if (orphans.length) {
    console.warn(
      `[transcripts] ${orphans.length} transcript file(s) match no episode slug:\n` +
        orphans.map((t) => `  - src/content/transcripts/${t.id}.md`).join('\n'),
    );
  }
}
