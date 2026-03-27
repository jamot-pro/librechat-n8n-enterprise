import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToastContext } from '@librechat/client';
import { useAuthContext, useLocalize } from '~/hooks';

/** Extract LinkedIn post URN from pasted URL or raw URN. */
export function parseLinkedInPostUrn(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const decoded = decodeURIComponent(s);
    if (decoded !== s) return parseLinkedInPostUrn(decoded);
  } catch {
    /* ignore */
  }
  const urnMatch = s.match(/urn:li:(?:activity|ugcPost|share):[0-9A-Za-z_-]+/);
  if (urnMatch) return urnMatch[0];
  const activityDash = s.match(/activity-(\d{10,20})/);
  if (activityDash) return `urn:li:activity:${activityDash[1]}`;
  return null;
}

interface CommentRow {
  id?: string;
  urn: string;
  text: string;
  author?: string;
  createdAt?: string;
  likeCount?: number;
}

export default function LinkedInEngagementSection() {
  const localize = useLocalize();
  const { token } = useAuthContext();
  const { showToast } = useToastContext();

  const [postingConnected, setPostingConnected] = useState(false);
  const [commentsConnected, setCommentsConnected] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  const [postInput, setPostInput] = useState('');
  const [resolvedUrn, setResolvedUrn] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [replyingToUrn, setReplyingToUrn] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [postingReply, setPostingReply] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!token) {
      setStatusLoading(false);
      return;
    }
    setStatusLoading(true);
    try {
      const postingRes = await fetch('/api/linkedin/status', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const postingData = postingRes.ok ? await postingRes.json() : { connected: false };
      setPostingConnected(!!postingData.connected);

      if (postingData.connected) {
        const cRes = await fetch('/api/linkedin/comments/status', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        if (cRes.ok) {
          const cData = await cRes.json();
          setCommentsConnected(!!cData.connected);
        } else {
          setCommentsConnected(false);
        }
      } else {
        setCommentsConnected(false);
      }
    } catch {
      setPostingConnected(false);
      setCommentsConnected(false);
    } finally {
      setStatusLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleConnectComments = () => {
    if (!token) return;
    window.location.href = `/api/linkedin/comments/connect?token=${encodeURIComponent(token)}`;
  };

  const loadComments = async (urnOverride?: string) => {
    const urn = urnOverride ?? parseLinkedInPostUrn(postInput);
    if (!urn) {
      showToast({
        message: localize('com_social_draft_linkedin_invalid_urn'),
        status: 'error',
      });
      return;
    }
    if (!token) return;
    setResolvedUrn(urn);
    setLoadingComments(true);
    setComments([]);
    try {
      const url = `/api/linkedin/comments/${encodeURIComponent(urn)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to load comments');
      }
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast({ message: msg, status: 'error' });
      setResolvedUrn(null);
    } finally {
      setLoadingComments(false);
    }
  };

  const submitTopComment = async () => {
    if (!resolvedUrn || !newComment.trim() || !token) return;
    setPostingComment(true);
    try {
      const res = await fetch('/api/linkedin/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ postUrn: resolvedUrn, comment: newComment.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.message || data.error || 'Failed to post comment');
      }
      showToast({
        message: localize('com_social_draft_linkedin_comment_posted'),
        status: 'success',
      });
      setNewComment('');
      await loadComments(resolvedUrn || undefined);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast({ message: msg, status: 'error' });
    } finally {
      setPostingComment(false);
    }
  };

  const submitReply = async () => {
    if (!replyingToUrn || !replyText.trim() || !token) return;
    setPostingReply(true);
    try {
      const url = `/api/linkedin/comments/${encodeURIComponent(replyingToUrn)}/reply`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ reply: replyText.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.message || data.error || 'Failed to post reply');
      }
      showToast({
        message: localize('com_social_draft_linkedin_reply_posted'),
        status: 'success',
      });
      setReplyText('');
      setReplyingToUrn(null);
      await loadComments(resolvedUrn || undefined);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast({ message: msg, status: 'error' });
    } finally {
      setPostingReply(false);
    }
  };

  if (statusLoading) {
    return (
      <section className="mb-8 rounded-lg border border-border-light bg-surface-primary p-4 dark:border-border-medium dark:bg-surface-secondary">
        <p className="text-sm text-text-secondary">{localize('com_ui_loading')}</p>
      </section>
    );
  }

  return (
    <section className="mb-8 rounded-lg border border-border-light bg-surface-primary p-4 dark:border-border-medium dark:bg-surface-secondary">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            {localize('com_social_draft_linkedin_engagement_title')}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            {localize('com_social_draft_linkedin_engagement_desc')}
          </p>
        </div>
        <Link
          to="/?settings=true&tab=social"
          className="shrink-0 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {localize('com_social_draft_linkedin_open_settings')}
        </Link>
      </div>

      {!postingConnected && (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">
          {localize('com_social_draft_linkedin_connect_posting_first')}
        </p>
      )}

      {postingConnected && !commentsConnected && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="text-sm text-text-secondary">
            {localize('com_social_draft_linkedin_connect_comments_hint')}
          </p>
          <button
            type="button"
            onClick={handleConnectComments}
            className="rounded-lg bg-[#0A66C2] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            {localize('com_social_draft_linkedin_connect_comments')}
          </button>
        </div>
      )}

      {commentsConnected && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                {localize('com_social_draft_linkedin_post_label')}
              </label>
              <input
                type="text"
                value={postInput}
                onChange={(e) => setPostInput(e.target.value)}
                placeholder={localize('com_social_draft_linkedin_post_placeholder')}
                className="w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <button
              type="button"
              onClick={() => void loadComments()}
              disabled={loadingComments || !postInput.trim()}
              className="rounded-lg bg-text-primary px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              {loadingComments
                ? localize('com_ui_loading')
                : localize('com_social_draft_linkedin_load_comments')}
            </button>
          </div>

          {resolvedUrn && (
            <p className="mt-2 text-xs text-text-secondary">
              URN: <span className="font-mono break-all">{resolvedUrn}</span>
            </p>
          )}

          {resolvedUrn && commentsConnected && (
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-medium text-text-secondary">
                {localize('com_social_draft_linkedin_new_comment')}
              </label>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              <button
                type="button"
                onClick={() => void submitTopComment()}
                disabled={postingComment || !newComment.trim()}
                className="rounded-lg border border-border-medium px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50"
              >
                {postingComment
                  ? localize('com_ui_loading')
                  : localize('com_social_draft_linkedin_post_comment')}
              </button>
            </div>
          )}

          {resolvedUrn && !loadingComments && comments.length === 0 && (
            <p className="mt-4 text-sm text-text-secondary">
              {localize('com_social_draft_linkedin_no_comments')}
            </p>
          )}

          {comments.length > 0 && (
            <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto">
              {comments.map((c) => (
                <li
                  key={c.urn || c.id}
                  className="rounded-lg border border-border-light bg-surface-secondary p-3 dark:border-border-medium"
                >
                  <p className="whitespace-pre-wrap text-sm text-text-primary">{c.text}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {typeof c.author === 'string' ? c.author : ''}
                    {c.createdAt ? ` · ${new Date(c.createdAt).toLocaleString()}` : ''}
                  </p>
                  <div className="mt-2">
                    {replyingToUrn === c.urn ? (
                      <div className="space-y-2">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          rows={2}
                          className="w-full rounded border border-border-medium bg-surface-primary px-2 py-1.5 text-sm"
                          placeholder={localize('com_social_draft_linkedin_reply_placeholder')}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void submitReply()}
                            disabled={postingReply || !replyText.trim()}
                            className="rounded bg-text-primary px-2 py-1 text-xs font-medium text-background disabled:opacity-50"
                          >
                            {postingReply
                              ? localize('com_ui_loading')
                              : localize('com_social_draft_linkedin_send_reply')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingToUrn(null);
                              setReplyText('');
                            }}
                            className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover"
                          >
                            {localize('com_ui_cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToUrn(c.urn);
                          setReplyText('');
                        }}
                        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {localize('com_social_draft_linkedin_reply')}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
