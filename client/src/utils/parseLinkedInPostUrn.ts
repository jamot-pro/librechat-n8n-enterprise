/**
 * Extract a LinkedIn post/thread URN for Social Actions (comments) APIs.
 * (Keep in sync with api/server/utils/parseLinkedInPostUrn.js)
 */
export function parseLinkedInPostUrn(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;

  for (let i = 0; i < 8; i++) {
    try {
      const next = decodeURIComponent(s.replace(/\+/g, ' '));
      if (next === s) break;
      s = next;
    } catch {
      break;
    }
  }

  const commentThread = s.match(
    /urn:li:comment:\s*\(\s*(urn:li:(?:activity|ugcPost|share):[^,)]+)/i,
  );
  if (commentThread) return commentThread[1];

  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      const fromQuery =
        u.searchParams.get('commentUrn') ||
        u.searchParams.get('replyUrn') ||
        u.searchParams.get('dashCommentUrn');
      if (fromQuery) {
        const inner = parseLinkedInPostUrn(fromQuery);
        if (inner) return inner;
      }
    }
  } catch {
    /* ignore */
  }

  if (s.includes('commentUrn=') || s.includes('replyUrn=')) {
    const q = s.match(/(?:^|[?&])(?:commentUrn|replyUrn|dashCommentUrn)=([^&]+)/i);
    if (q) {
      const inner = parseLinkedInPostUrn(q[1]);
      if (inner) return inner;
    }
  }

  const urnMatches = s.match(/urn:li:(?:activity|ugcPost|share):[0-9A-Za-z_-]+/gi);
  if (urnMatches && urnMatches.length) {
    const activity = urnMatches.find((u) => /^urn:li:activity:/i.test(u));
    if (activity) return activity;
    const ugc = urnMatches.find((u) => /^urn:li:ugcPost:/i.test(u));
    if (ugc) return ugc;
    return urnMatches[0];
  }

  const dash = s.match(/(?:^|[-_/])activity-(\d{6,})/i);
  if (dash) return `urn:li:activity:${dash[1]}`;

  return null;
}
