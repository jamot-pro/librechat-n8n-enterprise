# Phase 3 — Extended Tools: Audit, Orders, Social (Complete)

## Goal
Full tool coverage across all platform features so the Divine agent can manage audits, signage orders, and social media drafts — not just tasks.

## Status: ✅ DONE

---

## Tools Added

### Audit Tools (CEO only)
**`api/server/services/divine/tools/auditTools.js`**

Wraps the existing `AuditAdminService` singleton (which proxies to the external audit platform via `AUDIT_ADMIN_API_URL`).

| Tool | Method Called | Description |
|------|--------------|-------------|
| `list_audits` | `auditAdminService.listAudits({ status, search, limit })` | List audit sessions, filterable by status or user search |
| `get_audit_details` | `auditAdminService.getAuditDetails(sessionId)` | Full detail for one session |
| `approve_audit` | `auditAdminService.approveReport(sessionId, userId, message)` | Approve a report — sends email to the audited user |
| `create_task_for_audit` | `TaskService.createTask(...)` | Creates a "Review Audit Report" task linked to a session ID via `sourceRef` |

**Environment variables required:**
```bash
AUDIT_ADMIN_API_URL=https://your-audit-platform.com/api
ADMIN_API_SECRET=your-secret
```

---

### Order Tools (CEO + Employee)
**`api/server/services/divine/tools/orderTools.js`**

Calls `SIGNAGE_ORDERS_API_BASE` (the PDF Builder backend) directly via `axios`, mirroring the same proxy logic as `api/server/routes/signageOrders.js`.

| Tool | Role | Description |
|------|------|-------------|
| `list_signage_orders` | CEO + Employee | CEO sees all orders; employees see only their assigned orders (`assignedTo=me`) |
| `update_order_status` | CEO + Employee | PATCH status on any order (CEO) or own order (employee) |
| `assign_signage_order` | CEO only | Resolves user by name, PATCHes `assignedTo` field |

**Environment variables required:**
```bash
SIGNAGE_ORDERS_API_BASE=http://localhost:4000/api
```

---

### Social Tools (CEO + Employee)
**`api/server/services/divine/tools/socialTools.js`**

Works directly with the `SocialDraft` Mongoose model. Drafts are created externally by n8n (via webhook). The divine agent can view and act on them.

`SocialDraft` schema fields used:
- `drafts: { linkedin, x, instagram, facebook, farcaster }` — per-platform post content
- `status: 'pending' | 'approved' | 'rejected'`
- `resumeUrl` — n8n webhook URL to resume the paused workflow
- `selectedPlatforms` — which platforms were approved for publishing
- `rawIdea` — the original idea prompt from n8n

| Tool | Role | Description |
|------|------|-------------|
| `list_social_drafts` | CEO + Employee | CEO sees all; employees see own. Filters by status. |
| `get_social_draft` | CEO + Employee | Full content including all platform text |
| `approve_social_draft` | CEO only | Calls `resumeUrl` with `approved=true` + selected platforms, then marks draft `approved` |
| `reject_social_draft` | CEO only | Calls `resumeUrl` with `approved=false`, marks draft `rejected` |

**Note:** `create_social_draft` is intentionally not implemented — draft creation is owned by the n8n workflow (it POSTs to `/api/social-drafts` with the resumeUrl). The divine agent acts as a reviewer/approver, not a creator.

---

## Tool Loader Updated
**`api/server/services/divine/tools/index.js`**

```
CEO      → task + user + audit + order (all) + social (approve/reject)
Employee → task + user + order (own) + social (view only)
Customer → task (limited) + user (get_my_profile only)
```

---

## System Prompt Updated
**`api/server/services/divine/prompts.js`**

- Base prompt now lists all tool domains (tasks, orders, drafts)
- CEO variant explicitly enumerates audit, order, and social tool names
- Employee variant scopes to their own orders and draft visibility

---

## Done Criteria
CEO asks "show me all pending audits and create a review task for each one" and the agent does it. ✅
