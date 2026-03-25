# Dashboard Rebrand — Migration Plan

## Phases

### Phase 1 — Skeleton (Layout + Routing + Empty Pages)

Create the scaffold without moving any logic yet.

1. Create `DashboardLayout.tsx` with sidebar + outlet
2. Create `DashboardSidebar.tsx` with role-filtered menu items
3. Create `DashboardHeader.tsx` shared header
4. Create `Dashboard.routes.tsx` with all route definitions
5. Create 8 stub pages (each renders `<DashboardHeader title="..." />` + placeholder text)
6. Register `/dashboard` in `routes/index.tsx`
7. Update side panel `openDashboard` to `navigate('/dashboard')` (keep modal working too)

**Verify:** All 8 routes render, sidebar highlights active page, role filtering works.

### Phase 2 — Easy Pages (UsersPage, AuditPage)

These are one-line wrappers around existing self-contained components.

1. `UsersPage` → import and render `CEOUserManagement`
2. `AuditPage` → import and render `AuditManagementPage` + feature guard

**Verify:** Both pages work identically to the modal tabs.

### Phase 3 — OverviewPage

Extract the overview section from each dashboard:

1. CEO: `CEOKpiStats` + grid with `CEOProjectsTable` + `CEOSignageOrdersWidget` + `CEOStrategicTools`
2. Employee: `ProfileStats` + quick links
3. Customer: `ProfileStats` + summaries

This requires extracting the data-fetching logic from CEODashboard into a hook. Start with the projects/tasks/tickets fetch calls.

**Verify:** Overview loads same data as modal overview tab.

### Phase 4 — Data Pages (Projects, Tasks, Tickets)

Extract each tab's content + relevant state into its page:

1. `ProjectsPage` — role-switch between CEO/Employee/Customer project views
2. `TasksPage` — role-switch between CEO/Employee task views
3. `TicketsPage` — role-switch between CEO/Employee/Customer ticket views

These pages reuse existing tab components directly. The main work is extracting state (modals, search, CRUD operations) from the monolith into each page.

**Verify:** Full CRUD works on each page across all roles.

### Phase 5 — Complex Pages (Orders, Analytics)

1. `OrdersPage` — extract the orders table, filter, approve/reject from CEODashboard + employee order view
2. `AnalyticsPage` — extract `handleExecuteWorkflow`, `activeReport` state, `CEOStrategicTools` + `CEOReportView`

These have the most inline state in CEODashboard.

**Verify:** Order approve/reject works, analytics workflows execute and display reports.

### Phase 6 — Polish & Redirect

1. Make the modal `openDashboard` redirect to `/dashboard` (remove Recoil modal open)
2. Test all 3 roles end-to-end
3. Add mobile responsive sidebar (hamburger collapse)
4. Clean up console.log statements in CEODashboard

---

## What NOT to Do

- Do NOT delete the old monolith files until the route-based pages are verified across all roles
- Do NOT rewrite sub-components (CEOProjectsTable, AuditManagementPage, etc.) — reuse them
- Do NOT change backend routes — this is a frontend-only restructure
- Do NOT touch the hiring feature — separate work in progress

---

## Risk Areas

| Risk | Mitigation |
|---|---|
| CEODashboard inline state is deeply coupled | Extract hooks incrementally — one page at a time |
| n8n workflow execution (`handleExecuteWorkflow`) uses local state | Keep it in AnalyticsPage; it doesn't need to be global |
| Data fetching in CEODashboard uses raw `fetch()` + `useEffect` | Migrate to extracted hooks but keep the same fetch logic (don't rewrite to React Query yet) |
| Employee/Customer use `useOperationalData` + `useTickets` hooks | These already work — pages just call them |
| Orders tab has inline approve/reject logic (~200 lines) | Move to OrdersPage as-is, refactor later |

---

## Rough Line Count Estimates

| New File | Est. Lines | Complexity |
|---|---|---|
| DashboardLayout.tsx | 60 | Low |
| DashboardSidebar.tsx | 120 | Medium |
| DashboardHeader.tsx | 25 | Low |
| Dashboard.routes.tsx | 35 | Low |
| OverviewPage.tsx | 80 | Medium |
| ProjectsPage.tsx | 40 | Low (wraps existing) |
| TasksPage.tsx | 40 | Low (wraps existing) |
| TicketsPage.tsx | 40 | Low (wraps existing) |
| OrdersPage.tsx | 200 | High (extracted from monolith) |
| AnalyticsPage.tsx | 100 | Medium (workflow state) |
| UsersPage.tsx | 15 | Trivial |
| AuditPage.tsx | 25 | Low |
| **Total new code** | **~780** | |

For comparison, the monolith is 2,762 lines. The restructure produces cleaner, smaller files while reusing existing sub-components.
