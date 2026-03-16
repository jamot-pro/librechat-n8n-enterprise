const { tool } = require('@langchain/core/tools');
const { z } = require('zod');

function getSocialTools(userId, profileType) {
  const listDrafts = tool(
    async ({ status }) => {
      try {
        const SocialDraft = require('~/server/models/SocialDraft');
        const query = {};
        if (status) query.status = status;
        // Employees only see their own drafts; CEO sees all
        if (profileType !== 'ceo') query.userId = userId;

        const drafts = await SocialDraft.find(query).sort({ createdAt: -1 }).limit(10).lean();

        if (!drafts.length) return 'No social media drafts found.';

        const lines = drafts.map((d) => {
          const platforms = Object.entries(d.drafts || {})
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(', ');
          const preview = (d.drafts?.linkedin || d.drafts?.x || d.rawIdea || '').slice(0, 80);
          return `• [${d._id}] status: ${d.status} | platforms: ${platforms || 'none'}\n  "${preview}${preview.length >= 80 ? '…' : ''}"`;
        });
        return `Found ${drafts.length} draft(s):\n${lines.join('\n')}`;
      } catch (err) {
        return `Failed to list drafts: ${err.message}`;
      }
    },
    {
      name: 'list_social_drafts',
      description:
        'List social media post drafts. CEO sees all drafts, employees see their own. ' +
        'Use when asked "show me pending social drafts" or "what posts are waiting for approval?".',
      schema: z.object({
        status: z
          .enum(['pending', 'approved', 'rejected'])
          .optional()
          .describe('Filter by status'),
      }),
    },
  );

  const getDraftDetails = tool(
    async ({ draftId }) => {
      try {
        const SocialDraft = require('~/server/models/SocialDraft');
        const query = { _id: draftId };
        if (profileType !== 'ceo') query.userId = userId;

        const draft = await SocialDraft.findOne(query).lean();
        if (!draft) return `Draft ${draftId} not found.`;

        const lines = [`Status: ${draft.status}`, `Idea: ${draft.rawIdea || 'N/A'}`, ''];
        if (draft.drafts?.linkedin) lines.push(`LinkedIn:\n${draft.drafts.linkedin}`);
        if (draft.drafts?.x) lines.push(`X/Twitter:\n${draft.drafts.x}`);
        if (draft.drafts?.instagram) lines.push(`Instagram:\n${draft.drafts.instagram}`);
        if (draft.drafts?.facebook) lines.push(`Facebook:\n${draft.drafts.facebook}`);
        return lines.join('\n');
      } catch (err) {
        return `Failed to get draft: ${err.message}`;
      }
    },
    {
      name: 'get_social_draft',
      description: 'Get the full content of a social media draft by ID.',
      schema: z.object({
        draftId: z.string().describe('The draft ID'),
      }),
    },
  );

  const approveDraft = tool(
    async ({ draftId, selectedPlatforms }) => {
      try {
        const axios = require('axios');
        const SocialDraft = require('~/server/models/SocialDraft');
        const draft = await SocialDraft.findById(draftId);
        if (!draft) return `Draft ${draftId} not found.`;
        if (draft.status !== 'pending') return `Draft is already ${draft.status}.`;

        if (draft.resumeUrl) {
          const resumeUrl = new URL(draft.resumeUrl);
          resumeUrl.searchParams.set('draftId', draft._id.toString());
          resumeUrl.searchParams.set('approved', 'true');
          resumeUrl.searchParams.set(
            'selectedPlatforms',
            JSON.stringify(selectedPlatforms || []),
          );
          await axios.get(resumeUrl.toString(), { timeout: 15000 });
        }

        draft.status = 'approved';
        draft.selectedPlatforms = selectedPlatforms || [];
        await draft.save();
        return `Draft ${draftId} approved and queued for publishing on: ${(selectedPlatforms || []).join(', ') || 'all platforms'}.`;
      } catch (err) {
        return `Failed to approve draft: ${err.message}`;
      }
    },
    {
      name: 'approve_social_draft',
      description:
        'Approve a pending social media draft and trigger publishing. CEO only. ' +
        'Use when asked to "approve draft X" or "publish the LinkedIn post".',
      schema: z.object({
        draftId: z.string().describe('The draft ID to approve'),
        selectedPlatforms: z
          .array(z.enum(['linkedin', 'x', 'instagram', 'facebook', 'farcaster']))
          .optional()
          .describe('Platforms to publish to (defaults to all available)'),
      }),
    },
  );

  const rejectDraft = tool(
    async ({ draftId }) => {
      try {
        const axios = require('axios');
        const SocialDraft = require('~/server/models/SocialDraft');
        const draft = await SocialDraft.findById(draftId);
        if (!draft) return `Draft ${draftId} not found.`;
        if (draft.status !== 'pending') return `Draft is already ${draft.status}.`;

        if (draft.resumeUrl) {
          const resumeUrl = new URL(draft.resumeUrl);
          resumeUrl.searchParams.set('draftId', draft._id.toString());
          resumeUrl.searchParams.set('approved', 'false');
          await axios.get(resumeUrl.toString(), { timeout: 15000 }).catch(() => {});
        }

        draft.status = 'rejected';
        await draft.save();
        return `Draft ${draftId} rejected.`;
      } catch (err) {
        return `Failed to reject draft: ${err.message}`;
      }
    },
    {
      name: 'reject_social_draft',
      description: 'Reject a pending social media draft. CEO only.',
      schema: z.object({
        draftId: z.string().describe('The draft ID to reject'),
      }),
    },
  );

  const tools = [listDrafts, getDraftDetails];
  if (profileType === 'ceo') {
    tools.push(approveDraft, rejectDraft);
  }
  return tools;
}

module.exports = { getSocialTools };
