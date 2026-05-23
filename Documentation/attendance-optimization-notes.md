# Attendance Storage Normalization Notes

## Migration to Normalized Architecture

The system originally stored attendance punches as a serialized JSON string array (`punches TEXT`) inside `attendance_logs`. While convenient for prototypes, it violates First Normal Form (1NF) and does not scale nicely for enterprise systems generating >500k punches monthly. 

### Why Normalize?
1. **JSON Parsing Overhead**: Real-time aggregation of thousands of records required the app-level engine to deserialize JSON.
2. **Size Bloat**: Redundant JSON keys bloat the DB file size significantly compared to binary row structures. SQLite handles string fields well but searching within strings is unindexed.
3. **Write Path Bottlenecks**: Modifying a specific punch required replacing the entire JSON array string, increasing WAL log sizes.

### Changes Implemented
1. **New Schema (`attendance_punches`)**:
   - Stores single `(IN/OUT)` punches mapping to `attendance_log_id`.
   - Adds indexed lookup by `attendance_log_id`.

2. **Temporary Backward Compatibility (`punches TEXT`)**:
   - We continue to update `punches` strings during bulk load until all frontend modules adapt to reading from `attendance_punches` via the new APIs (`get_attendance_punches`).

3. **Data Migration**:
   - During boot, `db/migrations.ts` chunks through existing data (LIMIT 1000) inside transactions and migrates existing JSON strings into the new optimal table structure `attendance_punches`.

4. **Integration**:
   - The bulk worker (`bulkAttendanceWorker.ts`) natively writes to `attendance_logs.punches` AND `attendance_punches` simultaneously.

### Performance Notes
- `FOREIGN KEY (attendance_log_id) REFERENCES attendance_logs(id) ON DELETE CASCADE` automatically handles punch cleanup.
- Always use the provided `attendanceRepository` classes for future read aggregations with the `JOIN` syntax (e.g. `getPunchesWithLogDetail()`). This prevents manual data stitching in V8 isolating the heavy lifting to SQLite's highly optimized engine.
