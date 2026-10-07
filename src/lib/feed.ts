/**
 * Build-time RSS loader. The feed is fetched (or read from disk) and parsed once per
 * process, and the result is memoised on globalThis so dev-server reloads reuse it.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import slugOverrides from '../data/slug-overrides.json';
import { parseTimestamp, formatTimestamp } from './format';
import { excerptFromHtml, sanitizeShowNotes, toPlainText } from './html';
import { isValidSlug, slugify } from './slug';

export const DEFAULT_FEED_URL = 'https://media.rss.com/tales-beneath-the-surface/feed.xml';
export const DEFAULT_CHANNEL_IMAGE = 'https://media.rss.com/tales-beneath-the-surface/podcast_cover.jpg';

const FETCH_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 1_500;

export interface Chapter {
  title: string;
  /** Start time in seconds. */
  start: number;
  /** Display form, e.g. "2:22". */
  startLabel: string;
}

export interface Episode {
  guid: string;
  slug: string;
  /** Title exactly as published. */
  title: string;
  pubDate: Date;
  /** Sanitised show-notes HTML ('' when the feed description is empty). */
  showNotesHtml: string;
  /** Plain-text excerpt from the first paragraph (may be ''). */
  excerpt: string;
  audio: { url: string; type: string; length: number | null };
  /** Seconds, or null if the feed has no usable duration. */
  duration: number | null;
  image: string;
  isTrailer: boolean;
  explicit: boolean;
  chapters: Chapter[];
}

export interface Channel {
  title: string;
  description: string;
  image: string;
  link: string;
}

export interface Feed {
  channel: Channel;
  /** Newest first. */
  episodes: Episode[];
}

type XmlNode = Record<string, unknown>;

/** A problem with slugs or overrides rather than with the XML itself. */
class FeedConfigError extends Error {}

declare global {
  // eslint-disable-next-line no-var
  var __talesFeedCache: Map<string, Promise<Feed>> | undefined;
}

/** The configured feed source (URL or local path). */
export function feedSource(): string {
  return (process.env.PODCAST_RSS_URL || '').trim() || DEFAULT_FEED_URL;
}

/** Load the feed once per process (build or dev server) and reuse the result. */
export function getFeed(): Promise<Feed> {
  const source = feedSource();
  const cache = (globalThis.__talesFeedCache ??= new Map());
  let feed = cache.get(source);
  if (!feed) {
    feed = loadFeed(source);
    // Don't cache failures, so a dev server can recover once the feed is reachable.
    feed.catch(() => cache.delete(source));
    cache.set(source, feed);
  }
  return feed;
}

export async function getEpisodes(): Promise<Episode[]> {
  return (await getFeed()).episodes;
}

async function loadFeed(source: string): Promise<Feed> {
  const xml = await readSource(source);
  let feed: Feed;
  try {
    feed = parseFeed(xml);
  } catch (error) {
    if (error instanceof FeedConfigError) throw new Error(`[feed] ${error.message}`, { cause: error });
    throw new Error(`[feed] Could not parse the RSS feed from ${source}: ${(error as Error).message}`, {
      cause: error,
    });
  }
  console.info(`[feed] Loaded ${feed.episodes.length} episodes from ${source}`);
  return feed;
}

async function readSource(source: string): Promise<string> {
  if (/^https?:\/\//i.test(source)) return fetchWithRetry(source);

  const path = source.startsWith('file:') ? fileURLToPath(source) : resolve(process.cwd(), source);
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`[feed] Could not read the local RSS file at ${path}: ${(error as Error).message}`, {
      cause: error,
    });
  }
}

async function fetchWithRetry(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt === 1) {
        console.warn(`[feed] Fetching ${url} failed (${(error as Error).message}); retrying once…`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  throw new Error(
    `[feed] Could not fetch the RSS feed from ${url} after 2 attempts: ${(lastError as Error).message}. ` +
      'Check your connection or set PODCAST_RSS_URL to a local file path.',
    { cause: lastError },
  );
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Keep values as strings (titles like "1984" must not become numbers).
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => ['item', 'psc:chapter', 'itunes:image', 'enclosure'].includes(name),
});

export function parseFeed(xml: string): Feed {
  const doc = parser.parse(xml) as XmlNode;
  const channelNode = (doc.rss as XmlNode | undefined)?.channel as XmlNode | undefined;
  if (!channelNode || typeof channelNode !== 'object') {
    throw new Error('No <rss><channel> element found. Is this an RSS 2.0 feed?');
  }

  const channelImage =
    attr(first(channelNode['itunes:image']), 'href') || text((channelNode.image as XmlNode)?.url) || DEFAULT_CHANNEL_IMAGE;
  const channelExplicit = isTrue(channelNode['itunes:explicit']);

  const channel: Channel = {
    title: text(channelNode.title),
    description: toPlainText(text(channelNode.description)),
    image: channelImage,
    link: text(channelNode.link),
  };

  const items = (channelNode.item as XmlNode[] | undefined) ?? [];
  const overrides = slugOverrides as Record<string, string>;
  const episodes: Episode[] = [];

  for (const [index, item] of items.entries()) {
    const title = text(item.title) || text(item['itunes:title']);
    const enclosure = first(item.enclosure);
    const audioUrl = attr(enclosure, 'url');
    const label = title ? `"${title}"` : `item #${index + 1}`;

    if (!title) {
      console.warn(`[feed] Skipping ${label}: missing <title>.`);
      continue;
    }
    if (!audioUrl) {
      console.warn(`[feed] Skipping ${label}: missing audio <enclosure>.`);
      continue;
    }

    const pubDate = new Date(text(item.pubDate));
    if (Number.isNaN(pubDate.getTime())) {
      console.warn(`[feed] Skipping ${label}: missing or invalid <pubDate>.`);
      continue;
    }

    const guid = text(item.guid) || audioUrl;
    const override = overrides[guid];
    if (override !== undefined && !isValidSlug(override)) {
      throw new FeedConfigError(`slug-overrides.json maps "${guid}" to "${override}", which is not a valid slug.`);
    }

    const rawDescription = text(item.description) || text(item['content:encoded']) || text(item['itunes:summary']);
    const length = Number(attr(enclosure, 'length'));

    episodes.push({
      guid,
      slug: override ?? slugify(title),
      title,
      pubDate,
      showNotesHtml: sanitizeShowNotes(rawDescription),
      excerpt: excerptFromHtml(rawDescription),
      audio: {
        url: audioUrl,
        type: attr(enclosure, 'type') || 'audio/mpeg',
        length: Number.isFinite(length) && length > 0 ? length : null,
      },
      duration: parseTimestamp(text(item['itunes:duration'])),
      image: attr(first(item['itunes:image']), 'href') || channelImage,
      isTrailer: text(item['itunes:episodeType']).toLowerCase() === 'trailer',
      explicit: item['itunes:explicit'] === undefined ? channelExplicit : isTrue(item['itunes:explicit']),
      chapters: parseChapters(item['psc:chapters']),
    });
  }

  // The feed is oldest first; show newest first.
  episodes.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  assertUniqueSlugs(episodes);

  return { channel, episodes };
}

function parseChapters(node: unknown): Chapter[] {
  const chapters = ((node as XmlNode | undefined)?.['psc:chapter'] as XmlNode[] | undefined) ?? [];
  return chapters
    .map((chapter) => {
      const start = parseTimestamp(attr(chapter, 'start'));
      const title = attr(chapter, 'title');
      return start === null || !title ? null : { title, start, startLabel: formatTimestamp(start) };
    })
    .filter((chapter): chapter is Chapter => chapter !== null)
    .sort((a, b) => a.start - b.start);
}

function assertUniqueSlugs(episodes: Episode[]): void {
  const seen = new Map<string, Episode>();
  for (const episode of episodes) {
    if (!episode.slug) {
      throw new FeedConfigError(`Episode "${episode.title}" produces an empty slug. Add an entry to src/data/slug-overrides.json.`);
    }
    if (/^\d+$/.test(episode.slug)) {
      throw new FeedConfigError(
        `Episode "${episode.title}" has the numeric slug "${episode.slug}", which clashes with archive page URLs. ` +
          'Add an entry to src/data/slug-overrides.json.',
      );
    }
    const clash = seen.get(episode.slug);
    if (clash) {
      throw new FeedConfigError(
        `Slug collision: "${episode.title}" and "${clash.title}" both produce "${episode.slug}". ` +
          `Map one of their guids ("${episode.guid}" / "${clash.guid}") to a unique slug in src/data/slug-overrides.json.`,
      );
    }
    seen.set(episode.slug, episode);
  }
}

// --- small XML helpers -------------------------------------------------------

function text(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === 'object' && '#text' in value) return text((value as XmlNode)['#text']);
  return '';
}

function attr(node: unknown, name: string): string {
  if (!node || typeof node !== 'object') return '';
  return text((node as XmlNode)[`@_${name}`]);
}

function first(value: unknown): XmlNode | undefined {
  const node = Array.isArray(value) ? value[0] : value;
  return node && typeof node === 'object' ? (node as XmlNode) : undefined;
}

function isTrue(value: unknown): boolean {
  return ['true', 'yes', 'explicit'].includes(text(value).toLowerCase());
}
