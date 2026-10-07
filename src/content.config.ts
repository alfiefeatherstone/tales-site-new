import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** Episode transcripts. The filename (without .md) must equal the episode slug. */
const transcripts = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.md',
    base: './src/content/transcripts',
    // Keep the filename exactly so it can be matched against episode slugs.
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    speakers: z.array(z.string()).optional(),
    draft: z.boolean().default(false),
  }),
});

/** Cast and crew shown on the About page. */
const people = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/people' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      role: z.string(),
      groups: z.array(z.enum(['cast', 'crew'])).min(1),
      order: z.number(),
      /** Portrait, relative to the person's file (e.g. ./photos/jane-doe.jpg). Cropped to a square. */
      photo: image().optional(),
      /**
       * Which part of the portrait to keep when cropping to a square. "attention" lets the
       * image service pick the most detailed region (usually the face).
       */
      photoPosition: z.enum(['top', 'center', 'bottom', 'attention']).default('top'),
      /** The person's own website, shown as a link with its domain name. */
      website: z.url().optional(),
      /** Any other links (social profiles, agent, etc.). */
      links: z
        .array(
          z.object({
            label: z.string(),
            url: z.url(),
          }),
        )
        .optional(),
    }),
});

/** Free-standing Markdown pages (currently just the About intro). */
const pages = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});

/** Site-wide settings, from src/data/settings.yaml (single entry with id "site"). */
const settings = defineCollection({
  loader: file('./src/data/settings.yaml'),
  schema: z.object({
    showName: z.string(),
    tagline: z.string(),
    description: z.string(),
    language: z.string(),
    timeZone: z.string(),
    channelImage: z.url(),
    /** Optional path (under /public) of a custom social-share image. Falls back to the channel cover. */
    socialImage: z.string().optional(),
  }),
});

/** Listening platforms, from src/data/subscribe.json. Array order is display order. */
const subscribe = defineCollection({
  loader: file('./src/data/subscribe.json', {
    parser: (text) =>
      (JSON.parse(text) as Array<Record<string, unknown>>).map((link, index) => ({
        ...link,
        order: index,
      })),
  }),
  schema: z.object({
    label: z.string(),
    url: z.url(),
    /** "feed" renders the URL as text with a Copy button. */
    kind: z.enum(['platform', 'feed']).default('platform'),
    order: z.number(),
  }),
});

export const collections = { transcripts, people, pages, settings, subscribe };
