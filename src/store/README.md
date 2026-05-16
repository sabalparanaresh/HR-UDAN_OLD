# Store Architecture Directory

## Role
This directory contains Zustand global state stores. State management here is limited to client-side caching of configurations, layouts, ephemeral filters, and report settings. Business domain states should remain inside component local state or fetched data services to ensure "offline-first" synchronicity with the backend (`Tauri` API calls).

## Stores
- `authStore.ts`: Authentication, user permissions, global "Audit Mode" circuit breaker state.
- `useDashboardStore.ts`: Dashboard layouts and persistent preferences per module and user.
- `useGlobalFilter.ts`: Global filter state.
- `useReportStore.ts`: Hierarchical report configuration, persistent column layouts, and background export queues separated into K vs. P scope.

## Rules
- Avoid fetching inside Zustand.
- Stores follow the pattern defined in `PATTERN.md` (Devtools, Error Handling, specific Actions).
- Provide selectors to UI components when possible.

