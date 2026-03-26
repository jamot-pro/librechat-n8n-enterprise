/* eslint-disable i18next/no-literal-string */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToastContext } from '@librechat/client';
import { useAuthContext, useLocalize } from '~/hooks';
import { useSetRecoilState } from 'recoil';
import { socialDraftState } from '~/store/socialDraft';
import postComposerState from '~/store/postComposer';
import type { SocialDraftRecord } from '~/components/SocialDraft/SocialDraftModal';
import { getDraftPreview } from '~/components/SocialDraft/SocialDraftModal';

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  x: 'X (Twitter)',
  instagram: 'Instagram',
  facebook: 'Facebook',
  farcaster: 'Farcaster',
};

type DraftTab = 'pending' | 'approved';

export default function SocialDraftPage() {
  const localize = useLocalize();
  const { token } = useAuthContext();
  const { showToast } = useToastContext();
  const setSocialDraftState = useSetRecoilState(socialDraftState);
  const setPostComposerState = useSetRecoilState(postComposerState);

  const [tab, setTab] = useState<DraftTab>('pending');
  const [pendingDrafts, setPendingDrafts] = useState<SocialDraftRecord[]>([]);
  const [approvedDrafts, setApprovedDrafts] = useState<SocialDraftRecord[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingApproved, setLoadingApproved] = useState(false);
  const [viewingDraftId, setViewingDraftId] = useState<string | null>(null);

  const fetchList = useCallback(
    async (status: DraftTab) => {
      if (!token) return;

      if (status === 'pending') setLoadingPending(true);
      if (status === 'approved') setLoadingApproved(true);

      try {
        const res = await fetch(`/api/social-drafts?status=${status}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        const data = await res.json();
        const list = data.success && Array.isArray(data.drafts) ? data.drafts : [];
        if (status === 'pending') setPendingDrafts(list);
        if (status === 'approved') setApprovedDrafts(list);
      } catch (e: any) {
        showToast({
          message: `Failed to load ${status} drafts: ${e?.message || e}`,
          status: 'error',
        });
      } finally {
        if (status === 'pending') setLoadingPending(false);
        if (status === 'approved') setLoadingApproved(false);
      }
    },
    [token, showToast],
  );

  useEffect(() => {
    void fetchList('pending');
    void fetchList('approved');
  }, [fetchList]);

  const activeDrafts = tab === 'pending' ? pendingDrafts : approvedDrafts;

  const viewingDraft = useMemo(() => {
    if (!viewingDraftId) return null;
    return activeDrafts.find((d) => d._id === viewingDraftId) ?? null;
  }, [activeDrafts, viewingDraftId]);

  const handleCreateDraft = () => {
    setViewingDraftId(null);
    setSocialDraftState({ isOpen: true });
  };

  const handleApproveOrReject = async (draft: SocialDraftRecord, approved: boolean) => {
    if (!token) return;

    try {
      const platforms = approved
        ? Object.keys(draft.drafts).filter((k) => draft.drafts[k]?.trim())
        : [];

      const res = await fetch(`/api/social-drafts/${draft._id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ approved, selectedPlatforms: platforms }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Approve/reject failed');
      }

      if (approved) {
        const firstDraft = Object.values(draft.drafts).find((t) => t?.trim());
        if (firstDraft) {
          setPostComposerState({ isOpen: true, initialContent: firstDraft });
        }
      }

      showToast({
        message: approved ? 'Draft approved.' : 'Draft rejected.',
        status: 'success',
      });

      await Promise.all([fetchList('pending'), fetchList('approved')]);
      setViewingDraftId(null);
    } catch (e: any) {
      showToast({ message: e?.message || 'Approve/reject failed', status: 'error' });
    }
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Social Draft</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            Review pending and approved social draft requests.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateDraft}
          className="rounded-lg bg-text-primary px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
        >
          Create Draft
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('pending')}
          className={[
            'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            tab === 'pending'
              ? 'bg-surface-active text-text-primary'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
          ].join(' ')}
        >
          Pending
        </button>
        <button
          type="button"
          onClick={() => setTab('approved')}
          className={[
            'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            tab === 'approved'
              ? 'bg-surface-active text-text-primary'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
          ].join(' ')}
        >
          {localize('com_nav_approved_social_drafts')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'pending' && loadingPending && (
          <p className="text-sm text-text-secondary">Loading…</p>
        )}
        {tab === 'approved' && loadingApproved && (
          <p className="text-sm text-text-secondary">Loading…</p>
        )}

        {!loadingPending && tab === 'pending' && pendingDrafts.length === 0 && (
          <p className="text-sm text-text-secondary">No pending drafts.</p>
        )}
        {!loadingApproved && tab === 'approved' && approvedDrafts.length === 0 && (
          <p className="text-sm text-text-secondary">No approved drafts.</p>
        )}

        {activeDrafts.length > 0 && (
          <div className="space-y-3">
            {activeDrafts.map((d) => {
              const platforms = Object.keys(d.drafts || {}).filter((k) => d.drafts?.[k]?.trim());
              return (
                <div
                  key={d._id}
                  className="rounded-lg border border-border-light bg-surface-primary p-4 dark:border-border-medium dark:bg-surface-secondary"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-[220px]">
                      <p className="text-sm font-semibold text-text-primary">
                        {getDraftPreview(d.drafts, 15)}
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {new Date(d.createdAt).toLocaleString()} · {platforms.join(', ') || '—'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setViewingDraftId((id) => (id === d._id ? null : d._id))
                        }
                        className="rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                      >
                        View
                      </button>

                      {tab === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleApproveOrReject(d, true)}
                            className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleApproveOrReject(d, false)}
                            className="rounded border border-border-medium px-2 py-1 text-xs font-medium text-text-primary hover:bg-surface-hover"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {viewingDraftId === d._id && viewingDraft && (
                    <div className="mt-3 rounded-lg border border-border-medium bg-surface-secondary p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-text-primary">Draft details</div>
                        <button
                          type="button"
                          onClick={() => setViewingDraftId(null)}
                          className="rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                          aria-label="Close draft details"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="mt-3 space-y-3">
                        {Object.entries(d.drafts).map(([platform, text]) => {
                          const trimmed = text?.trim();
                          if (!trimmed) return null;

                          return (
                            <div
                              key={platform}
                              className="rounded border border-border-light bg-surface-primary p-3 dark:border-border-medium dark:bg-surface-primary-alt"
                            >
                              <div className="mb-2 text-xs font-semibold text-text-primary">
                                {PLATFORM_LABELS[platform] ?? platform}
                              </div>
                              <p className="whitespace-pre-wrap text-sm text-text-secondary">
                                {trimmed}
                              </p>
                              <div className="mt-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(trimmed);
                                    showToast({
                                      message: 'Copied to clipboard',
                                      status: 'success',
                                    });
                                  }}
                                  className="rounded bg-surface-hover px-2 py-1 text-xs font-medium text-text-primary hover:opacity-90"
                                >
                                  Copy
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

