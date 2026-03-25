# Dashboard Rebrand — File Structure

## New Files to Create

```
client/src/
├── routes/
│   └── Dashboard.routes.tsx           # Route definitions for /dashboard/*
│
├── layouts/
│   └── DashboardLayout.tsx            # Sidebar + Outlet wrapper
│
├── pages/Dashboard/
│   ├── OverviewPage.tsx               # KPI stats, summary widgets
│   ├── ProjectsPage.tsx               # Projects table + CRUD
│   ├── TasksPage.tsx                  # Tasks management
│   ├── TicketsPage.tsx                # Tickets / support
│   ├── OrdersPage.tsx                 # Signage orders
│   ├── AnalyticsPage.tsx              # Reports (CEO only)
│   ├── UsersPage.tsx                  # User management (CEO only)
│   └── AuditPage.tsx                  # Audit management (CEO only)
│
├── components/Dashboard/
│   ├── DashboardSidebar.tsx           # Sidebar nav with role-filtered items
│   └── DashboardHeader.tsx            # Page header (breadcrumb, title, actions)
```

## Existing Files to Reuse (NOT rewrite)

These sub-components already work. Pages will import and compose them.

```
components/Profile/CEO/
├── CEOKpiStats.tsx                    → used in OverviewPage
├── CEOProjectsTable.tsx               → used in ProjectsPage
├── CEOStrategicTools.tsx              → used in AnalyticsPage
├── CEOReportView.tsx                  → used in AnalyticsPage
├── CEOUserManagement.tsx              → used in UsersPage
├── CEOSignageOrdersWidget.tsx         → used in OverviewPage + OrdersPage
└── CEOQuickActions.tsx                → used in OverviewPage

components/Profile/Employee/
├── EmployeeProjectsTab.tsx            → used in ProjectsPage (employee view)
├── EmployeeTasksTab.tsx               → used in TasksPage (employee view)
├── EmployeeSupportTab.tsx             → used in TicketsPage (employee view)
└── ...

components/Profile/Customer/
├── CustomerProjectsTab.tsx            → used in ProjectsPage (customer view)
├── CustomerTicketsTab.tsx             → used in TicketsPage (customer view)
└── ...

components/Profile/Modals/             → shared modals, used from pages
├── TaskModal.tsx
├── ProjectModal.tsx
├── TicketNewModal.tsx
├── TicketChatModal.tsx
├── TicketEditModal.tsx
├── DeleteConfirmModal.tsx
├── ResolveConfirmModal.tsx
└── ConfirmActionModal.tsx

components/Audit/
├── AuditManagementPage.tsx            → used directly in AuditPage
└── ...
```

## Files to Modify

| File | Change |
|---|---|
| `client/src/routes/index.tsx` | Add `/dashboard` route tree |
| `client/src/components/SidePanel/SidePanel.tsx` | Change `openDashboard` to `navigate('/dashboard')` |
| `client/src/hooks/Nav/useSideNavLinks.ts` | Dashboard click → navigate instead of modal open |
| `client/src/routes/Root.tsx` | Keep `ProfileDashboardModal` for now (backward compat) |

## Files NOT Touched (yet)

The existing monolith files stay untouched during migration:
- `CEODashboard.tsx` — still used by modal
- `EmployeeDashboard.tsx` — still used by modal
- `CustomerDashboard.tsx` — still used by modal
- `ProfileDashboard.tsx` — still used by modal
- `ProfileDashboardModal.tsx` — stays as shortcut

These get deprecated after the route-based dashboard is verified working.
