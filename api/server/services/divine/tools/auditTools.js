const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const auditAdminService = require('~/server/services/AuditAdminService');
const TaskService = require('~/server/services/TaskService');

function getAuditTools(userId) {
  const listAudits = tool(
    async ({ status, userSearch, limit }) => {
      try {
        const result = await auditAdminService.listAudits({
          status,
          search: userSearch,
          limit: limit || 10,
        });
        const audits = result.audits || result.sessions || result.data || result;
        if (!Array.isArray(audits) || audits.length === 0) {
          return 'No audits found matching those filters.';
        }
        const lines = audits.map((a) => {
          const id = a._id || a.id || a.sessionId;
          const user = a.userEmail || a.userName || a.userId || 'Unknown';
          const st = a.status || 'unknown';
          const approved = a.approved ? ' [APPROVED]' : '';
          return `• [${id}] ${user} — status: ${st}${approved}`;
        });
        return `Found ${audits.length} audit(s):\n${lines.join('\n')}`;
      } catch (err) {
        return `Failed to list audits: ${err.message || JSON.stringify(err)}`;
      }
    },
    {
      name: 'list_audits',
      description:
        'List audit sessions. Filter by status or search by user name/email. CEO only. ' +
        'Use when asked "show me pending audits" or "audits for John".',
      schema: z.object({
        status: z.string().optional().describe('Filter by status (e.g. completed, pending)'),
        userSearch: z.string().optional().describe('Search by user name or email'),
        limit: z.number().optional().describe('Max results to return (default 10)'),
      }),
    },
  );

  const getAuditDetails = tool(
    async ({ sessionId }) => {
      try {
        const result = await auditAdminService.getAuditDetails(sessionId);
        if (!result) return `Audit session ${sessionId} not found.`;
        return JSON.stringify(result, null, 2);
      } catch (err) {
        return `Failed to get audit details: ${err.message || JSON.stringify(err)}`;
      }
    },
    {
      name: 'get_audit_details',
      description: 'Get full details of a specific audit session by ID.',
      schema: z.object({
        sessionId: z.string().describe('The audit session ID'),
      }),
    },
  );

  const approveAudit = tool(
    async ({ sessionId, message }) => {
      try {
        await auditAdminService.approveReport(sessionId, userId, message || '');
        return `Audit session ${sessionId} approved successfully.`;
      } catch (err) {
        return `Failed to approve audit: ${err.message || JSON.stringify(err)}`;
      }
    },
    {
      name: 'approve_audit',
      description:
        'Approve an audit report. This sends the approval email to the user. CEO only. ' +
        'Use when asked "approve audit X" or "sign off on session Y".',
      schema: z.object({
        sessionId: z.string().describe('The audit session ID to approve'),
        message: z.string().optional().describe('Optional message to include with the approval'),
      }),
    },
  );

  const createAuditTask = tool(
    async ({ sessionId, assignToName, notes, dueDate }) => {
      try {
        const task = await TaskService.createTask({
          title: `Review Audit Report — Session ${sessionId}`,
          description: notes || 'Review and process the linked audit report.',
          assignedToName: assignToName,
          priority: 'high',
          dueDate: dueDate ? new Date(dueDate) : null,
          source: 'audit',
          sourceRef: sessionId,
          createdById: userId,
        });
        const assignMsg = task.assignedToName ? ` and assigned to ${task.assignedToName}` : '';
        return `Review task created${assignMsg} for audit session ${sessionId}.`;
      } catch (err) {
        return `Failed to create audit task: ${err.message}`;
      }
    },
    {
      name: 'create_task_for_audit',
      description:
        'Create a follow-up task linked to a specific audit session. ' +
        'Use when asked to "assign a review of audit X to Andrea".',
      schema: z.object({
        sessionId: z.string().describe('The audit session ID this task relates to'),
        assignToName: z.string().describe('Name of the person to assign the review task to'),
        notes: z.string().optional().describe('Additional notes for the reviewer'),
        dueDate: z.string().optional().describe('Due date as YYYY-MM-DD'),
      }),
    },
  );

  return [listAudits, getAuditDetails, approveAudit, createAuditTask];
}

module.exports = { getAuditTools };
