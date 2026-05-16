# Store & State Management Architecture

## Overview
HR-UDAN uses **Zustand** for global state management and React Contexts for tightly-coupled module environments. The architecture separates purely UI state, persistent configuration, and domain state into well-defined segments.

## Active Stores

1. **`authStore.ts`**
   - Manages the currently authenticated `User`, `permissionMap`, and the scoped `moduleScope`.
   - Responsibilities: User session caching.
   
2. **`useDashboardStore.ts`**
   - Handles the customized layout placement of widgets across K and P modules for distinct user IDs.
   - Persistence: `hr-udan-dashboard-layouts`
   
3. **`useReportStore.ts`**
   - Defines complex hierarchical reports logic, templates, calculated columns, and export queue management. 
   - Uses separated module state trees (`K` and `P`).

4. **`useGlobalFilter.ts`**
   - Provides an ephemeral context filter (Wage Month/Year or Date Range) applicable across transaction forms and standard listing screens.

5. **`ModuleContext.tsx`** (Context)
   - Governs the `K` vs `P` mode toggle (`Alt+Shift+K` Audit mode) explicitly connected to Tauri IPC checks for connectivity.
   - Serves as the primary circuit breaker for offline mode rules.

## Design Patterns

- **No API Calls inside Zustand**: Zustand is strictly for synchronously setting and holding data or defining UI interaction variables. Side effects are handled by the `<Service>` layer.
- **Robust Types**: Stores use strict interfaces defined in `src/types/`.
- **Error Boundaries Integration**: Stores provide error states to UI boundaries.
- **Store Template**: Use `devtools` (and `persist` when needed) wrapping `create()`.
- **Selectors**: Always provide custom selectors or use `useShallow` to prevent unnecessary re-renders.

### Store Creation Template

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface MyState {
  data: string;
  error: string | null;
  setData: (val: string) => void;
  setError: (err: string | null) => void;
}

export const useMyStore = create<MyState>()(
  devtools(
    persist(
      (set) => ({
        data: 'initial',
        error: null,
        setData: (val) => set({ data: val, error: null }, false, 'setData'),
        setError: (err) => set({ error: err }, false, 'setError')
      }),
      { name: 'my-store-persist' }
    ),
    { name: 'MyStore' }
  )
);
```
