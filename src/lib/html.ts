import sanitizeHtml from 'sanitize-html';

const EXCERPT_LENGTH = 160;

/** Paragraphs that are credits or music attributions rather than a story blurb. */
const CREDIT_PATTERN =
  /^(written|sound design|music|produced|edited|directed|narrat|additional voices|voices|recording|starring|cast|credits|licensed|"[^"]+"\s)/i;

/** Decode the handful of entities sanitize-html leaves in plain-text output. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');
}

/** Strip all markup and collapse whitespace. */
export function toPlainText(html: string): string {
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

/** Sanitise feed HTML for rendering on episode pages: keep links, drop empty paragraphs. */
export function sanitizeShowNotes(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'a', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote'],
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: 'noopener noreferrer' },
      }),
    },
    // Remove paragraphs that contain only whitespace.
    exclusiveFilter: (frame) => frame.tag === 'p' && !frame.text.trim() && !frame.mediaChildren.length,
  }).trim();
}

/**
 * A ~160-character plain-text excerpt taken from the first non-empty paragraph only.
 * Returns '' when that paragraph is a credit line (e.g. "Written by ...").
 */
export function excerptFromHtml(html: string, maxLength = EXCERPT_LENGTH): string {
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => m[1] ?? '');
  const candidates = paragraphs.length ? paragraphs : [html];
  const first = candidates.map(toPlainText).find((text) => text.length > 0) ?? '';
  if (!first || CREDIT_PATTERN.test(first)) return '';
  return truncate(first, maxLength);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = (lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–—-]+$/, '');
  return `${trimmed}…`;
}
