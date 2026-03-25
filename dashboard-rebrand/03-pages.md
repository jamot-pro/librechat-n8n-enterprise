# Dashboard Rebrand — Page Specs

Each page is a thin wrapper that composes existing sub-components. Pages pull `profile` from outlet context and render the right view for the user's role.

---

## Pattern

Every page follows this pattern:

```tsx
export default function SomePage() {
  const { profile } = useDashboardContext();

  // Role-specific rendering
  if (profile.profileType === 'ceo') return <CEOView />;
  if (profile.profileType === 'employee') return <EmployeeView />;
  if (profile.profileType === 'customer') return <CustomerView />;
  return null;
}
```

For pages visible to only one role (Analytics, Users, Audit), the layout sidebar already prevents navigation — but the page still guards with a role check.

---

## 1. OverviewPage

**Route:** `/dashboard` (index)

**CEO view:**
- `CEOKpiStats` — KPI cards (existing)
- Grid: `CEOProjectsTable` (left 2/3) + `CEOSignageOrdersWidget` + `CEOStrategicTools` (right 1/3)
- This is the current "overview" tab content from CEODashboard.tsx lines ~962–990

**Employee view:**
- `ProfileStats` — summary stats (existing)
- Quick links to tasks, projects, support

**Customer view:**
- `ProfileStats` — own stats
- Recent projects + recent tickets summary

**Extracts from CEODashboard.tsx:**
- Lines 62–100: state declarations (projects, tasks, tickets, orders, loading)
- Lines ~100–850: data fetching hooks/effects — these move into the page or a custom hook
- Lines ~962–990: overview JSX

**Key refactor:** The massive data-fetching logic in CEODashboard needs to become a hook:
```
useOperationalData(userId, role) — already exists for Employee/Customer
```
CEO currently fetches inline. Extract to `useCEOData(profile)` hook or reuse `useOperationalData`.

---

## 2. ProjectsPage

**Route:** `/dashboard/projects`

**CEO view:**
- `DashboardHeader` with title "Projects" + "New Project" button
- `CEOProjectsTable` (existing) — full CRUD
- Create/edit project modals (existing `ProjectModal`)

**Employee view:**
- `DashboardHeader` with title "Projects"
- `EmployeeProjectsTab` (existing) — read + limited edit

**Customer view:**
- `DashboardHeader` with title "My Projects"
- `CustomerProjectsTab` (existing) — read only

**Source:** CEODashboard lines ~990–1004 (projects tab), EmployeeDashboard EmployeeProjectsTab, CustomerDashboard CustomerProjectsTab

---

## 3. TasksPage

**Route:** `/dashboard/tasks`

**CEO view:**
- `DashboardHeader` with "Tasks" + "New Task" button
- Task table with status, priority, assignee, due date
- Quick status change
- Create/edit via `TaskModal`

**Employee view:**
- `DashboardHeader` with "My Tasks"
- `EmployeeTasksTab` (existing) — own + team tasks

**Customer:** not visible (sidebar hides it)

**Source:** CEODashboard lines ~1005–1110 (tasks tab), EmployeeDashboard EmployeeTasksTab

---

## 4. TicketsPage

**Route:** `/dashboard/tickets`

**CEO view:**
- `DashboardHeader` with "Tickets"
- Ticket table with subject, status, priority, requester
- Chat modal for ticket threads

**Employee view:**
- `EmployeeSupportTab` (existing) — own + team tickets

**Customer view:**
- `CustomerTicketsTab` (existing) — own tickets + create new
- `TicketNewModal`, `TicketChatModal`, `TicketEditModal` (existing)

**Source:** CEODashboard lines ~1112–1216 (tickets tab)

---

## 5. OrdersPage

**Route:** `/dashboard/orders`

**CEO view:**
- `DashboardHeader` with "Signage Orders"
- Full orders table with customer filter
- Approve/reject actions with `ConfirmActionModal`
- Status badge + payment status

**Employee view:**
- Own assigned orders only
- Status update capabilities (existing from EmployeeDashboard)

**Customer:** not visible

**Source:** CEODashboard lines ~1217–1410 (orders tab). This is the biggest tab — ~200 lines of order table + filtering + actions. Extract as-is into OrdersPage.

---

## 6. AnalyticsPage

**Route:** `/dashboard/analytics` — CEO only

- `DashboardHeader` with "Analytics & Reports"
- `CEOStrategicTools` (existing) — workflow execution buttons
- `CEOReportView` (existing) — rendered report display
- Workflow execution state (`executingId`, `activeReport`)

**Source:** CEODashboard analytics tab + `handleExecuteWorkflow` logic

---

## 7. UsersPage

**Route:** `/dashboard/users` — CEO only

- `DashboardHeader` with "User Management"
- `CEOUserManagement` (existing) — full component, self-contained

**Source:** CEODashboard lines ~1410–1412 (one line: `<CEOUserManagement />`). This is the easiest page.

---

## 8. AuditPage

**Route:** `/dashboard/audit` — CEO only, feature-gated

- `DashboardHeader` with "Audit Management"
- `AuditManagementPage` (existing) — fully self-contained with its own tabs

**Source:** CEODashboard lines ~1414–1418. Another easy one — the component is already independent.

**Feature guard:** Page checks `useFeatureFlag(FEATURES.AUDIT)` and shows "feature not available" if disabled. Sidebar already hides the link, but defense-in-depth.

---

## State Extraction Strategy

The biggest refactor challenge is CEODashboard's inline state. Here's the plan:

**What stays in pages:**
- UI state (modals open/close, editing item, active tab within a page)
- Form state

**What becomes hooks:**
- `useCEOProjects(token)` → projects CRUD + fetch
- `useCEOTasks(token)` → tasks CRUD + fetch
- `useCEOTickets(token)` → tickets CRUD + fetch
- `useCEOOrders(token)` → orders fetch + approve/reject
- `useCEOAnalytics(token, profile)` → workflow execution + reports

Or simpler: extend `useOperationalData(userId, role)` to cover CEO (it already works for employee/customer).

The existing `useOperationalData` + `useTickets` hooks (used by Employee/Customer) may already cover most of the logic. CEO just has broader scope.
