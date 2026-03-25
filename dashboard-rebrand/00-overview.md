# Dashboard Rebrand — Overview

## Problem

The dashboard is a 2,700-line monolith (CEO: 1,912, Employee: 552, Customer: 298) rendered inside a full-screen Recoil modal. Every feature is a tab — no URLs, no browser navigation, no code splitting, all state loaded at once.

## Goal

Replace the tab-based modal dashboard with a dedicated `/dashboard` route using a persistent sidebar layout, route-based pages, and role-filtered navigation. One layout component, three roles, clean URLs.

## Key Decisions

| Decision | Choice |
|---|---|
| Navigation style | Left sidebar |
| Routing | `/dashboard/*` with nested `<Outlet />` |
| Existing modal | Keep as shortcut (downgrade later) |
| Page structure | Each tab → its own route page file |
| Role handling | Single `DashboardLayout`, menu items filtered by `profile.profileType` |
| Reuse | Existing sub-components (CEOProjectsTable, AuditManagementPage, etc.) stay — pages compose them |

## Route Map

```
/dashboard                → Overview (KPI + summary widgets)
/dashboard/projects       → Projects management
/dashboard/tasks          → Tasks management
/dashboard/tickets        → Tickets / support
/dashboard/orders         → Signage orders
/dashboard/analytics      → Reports & analytics
/dashboard/users          → User management (CEO only)
/dashboard/audit          → Audit management (CEO only, feature-gated)
```

## Role Visibility

| Page | CEO | Employee | Customer |
|---|---|---|---|
| Overview | Full KPI stats | Department stats | Own project stats |
| Projects | All + CRUD | All + limited CRUD | Own projects (read) |
| Tasks | All + assign | Own + team | — |
| Tickets | All | Own + team support | Own + create new |
| Orders | All + approve/reject | Own assigned orders | — |
| Analytics | Full reports | — | — |
| Users | Full management | — | — |
| Audit | Full (feature-gated) | — | — |

## File Plan

See `01-file-structure.md` for the complete file tree.
See `02-layout.md` for the DashboardLayout component spec.
See `03-pages.md` for each page's spec and how it maps to existing code.
See `04-migration.md` for the step-by-step migration plan.
