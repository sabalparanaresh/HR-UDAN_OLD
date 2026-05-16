import { Database } from 'better-sqlite3';
import { BaseRepository } from '../base.repository';

export class ReportsRepository extends BaseRepository<any> {
  constructor(primaryDb: Database, statutoryDb: Database) {
    super(primaryDb, statutoryDb);
  }

  saveReportSnapshot(moduleType: 'K' | 'P', templateId: number, dataJson: string) {
    const db = this.getDb(moduleType);
    const id = Date.now().toString(); // simple ID gen
    const snapshotDate = new Date().toISOString();

    db.prepare(`
      INSERT INTO report_snapshots (id, template_id, snapshot_date, data_json, module_type)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, templateId, snapshotDate, dataJson, moduleType);

    return id;
  }

  getLatestSnapshot(moduleType: 'K' | 'P', templateId: number) {
    const db = this.getDb(moduleType);
    return db.prepare(`
      SELECT * FROM report_snapshots 
      WHERE template_id = ? AND module_type = ? 
      ORDER BY snapshot_date DESC LIMIT 1
    `).get(templateId, moduleType);
  }

  getReportSnapshots(moduleType: 'K' | 'P', templateId: number) {
    const db = this.getDb(moduleType);
    return db.prepare(`
      SELECT id, template_id, snapshot_date, module_type 
      FROM report_snapshots 
      WHERE template_id = ? AND module_type = ? 
      ORDER BY snapshot_date DESC
    `).all(templateId, moduleType);
  }
}
