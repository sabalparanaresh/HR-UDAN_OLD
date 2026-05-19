# Enterprise SQLite Optimization Layer

## Overview
This module introduces an enterprise-grade optimization layer for better-sqlite3 in Node.js applications, specifically tailored for HRMS systems processing large volumes of data (50k+ employees, 500k+ monthly rows).

## Features

### 1. Enterprise Pragmas (`applyEnterprisePragmas`)
Automatically configures the db connection with performance-focused pragmas:
- `journal_mode=WAL`: Write-Ahead Logging allows simultaneous readers and writers.
- `synchronous=NORMAL`: Fast and safe synchronization with WAL mode.
- `mmap_size=1GB`: Uses Memory-Mapped I/O for reading data pages, significantly avoiding system call overhead.
- `cache_size=-200000`: ~200MB memory page cache to reduce disk I/O.
- `temp_store=MEMORY`: Keeps temp tables directly in RAM.
- `busy_timeout=15000`: Allows internal spin-waiting up to 15s before failing with `SQLITE_BUSY`.

### 2. Slow Query Profiler (`enableSlowQueryLog`)
Monkey-patches `.run()`, `.get()`, and `.all()` to measure query execution times automatically globally. Logs any query exceeding a defined threshold.
- Enables easy identification of missing indexes or full table scans.

### 3. Concurrency Resiliency (`withRetry` & `executeTransaction`)
Includes deterministic retry wrappers tailored for synchronous execution. Since `better-sqlite3` execution is blocking, `.withRetry` implements exponential backoff using spin-locking when catching `SQLITE_BUSY` or `SQLITE_LOCKED` exceptions.
- Provides transaction durability during concurrent mass data exports/imports.

### 4. Index Health Checker (`analyzeIndexHealth`)
Iterates tables to return usage insights and verify index coverage vs total row counts.

## Usage Guide
\`\`\`typescript
import Database from 'better-sqlite3';
import { SQLiteOptimizer } from './optimizer.js';

const db = new Database('data.db', { timeout: 15000 });

// 1. Core Optimizations
SQLiteOptimizer.applyEnterprisePragmas(db);
SQLiteOptimizer.enableSlowQueryLog(db, 200); // threshold 200ms

// 2. Transaction Handling 
SQLiteOptimizer.executeTransaction(db, () => {
    // ... logic
    stmt.run();
});

// 3. Statement Retry 
SQLiteOptimizer.withRetry(() => {
    stmt.run();
});
\`\`\`
