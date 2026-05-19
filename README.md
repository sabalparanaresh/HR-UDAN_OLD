# HR-UDAN

Enterprise HRMS application for the Indian textile industry, built with a dual-module architecture (Module K for Actuals, Module P for Statutory compliance).

## Web Server Application Deployment Process

HR-UDAN is a full-stack web application built using React + Vite on the front-end, and Node/Express on the backend.

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### Step 1: Install Dependencies
Navigate to the root directory and install the necessary dependencies:
```bash
npm install
```

### Step 2: Build the Application
Run the build script to compile the React application and the backend for production:
```bash
npm run build
```
This command bundles the frontend code into the `dist/` directory and transpiles the backend server into `dist-server/`.

### Step 3: Run the Application
Start the backend server which also serves the built frontend:
```bash
npm start
```

---

## Architecture Context

HR-UDAN operates on two distinct databases for enterprise stability:
- `primary.db` (Module K) - Operational / Actuals
- `statutory.db` (Module P) - Compliance / Statutory

The application uses SQLite WAL mode for performance and a custom SyncBridge for K->P data synchronization. Ensure the host system has sufficient write permissions in the directory where the application is installed or executed.
