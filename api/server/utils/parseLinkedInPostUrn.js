/**
 * Extract a LinkedIn post/thread URN for Social Actions (comments) APIs.
 * Supports: raw URNs, feed/update URLs, /posts/ URLs, query params, and
 * comment permalinks urn:li:comment:(urn:li:activity:...,id) → parent thread URN.
 *
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
function parseLinkedInPostUrn(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;

  // Repeated decode (handles double-encoded URNs in URLs)
  for (let i = 0; i < 8; i++) {
    try {
      const next = decodeURIComponent(s.replace(/\+/g, ' '));
      if (next === s) break;
      s = next;
    } catch {
      break;
    }
  }

  // Comment permalink: parent thread is the first argument inside urn:li:comment:(...)
  const commentThread = s.match(
    /urn:li:comment:\s*\(\s*(urn:li:(?:activity|ugcPost|share):[^,)]+)/i,
  );
  if (commentThread) return commentThread[1];

  // Absolute URL: pull commentUrn / replyUrn and recurse
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
    /* ignore invalid URL */
  }

  // Loose query string paste (no scheme)
  if (s.includes('commentUrn=') || s.includes('replyUrn=')) {
    const q = s.match(/(?:^|[?&])(?:commentUrn|replyUrn|dashCommentUrn)=([^&]+)/i);
    if (q) {
      const inner = parseLinkedInPostUrn(q[1]);
      if (inner) return inner;
    }
  }

  // Any embedded URN (prefer activity, then ugcPost, then share)
  const urnMatches = s.match(/urn:li:(?:activity|ugcPost|share):[0-9A-Za-z_-]+/gi);
  if (urnMatches && urnMatches.length) {
    const activity = urnMatches.find((u) => /^urn:li:activity:/i.test(u));
    if (activity) return activity;
    const ugc = urnMatches.find((u) => /^urn:li:ugcPost:/i.test(u));
    if (ugc) return ugc;
    return urnMatches[0];
  }

  // /posts/...activity-12345678901234567890...
  const dash = s.match(/(?:^|[-_/])activity-(\d{6,})/i);
  if (dash) return `urn:li:activity:${dash[1]}`;

  return null;
}

module.exports = { parseLinkedInPostUrn };
