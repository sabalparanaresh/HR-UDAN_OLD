import { Database } from 'better-sqlite3';

export interface PieceRateHead {
    id: string;
    name: string;
    calculation_type: 'SLAB' | 'FIXED';
    applicability: 'UNIVERSAL' | 'EMPLOYEE_WISE';
    unit_of_measurement: string;
    fixed_rate: number | null;
    effective_date: string;
    status: number;
}

export interface PieceRateSlab {
    id: string;
    head_id: string;
    min_pieces: number;
    max_pieces: number | null;
    rate: number;
    effective_date: string;
}

export interface PieceRateEmployeeMapping {
    id: string;
    head_id: string;
    emp_id: number;
    fixed_rate: number | null;
    effective_date: string;
}

export class PieceRateRepository {
    private db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    getHeads(page: number, limit: number, search: string) {
        const offset = (page - 1) * limit;
        let query = 'SELECT * FROM piece_rate_heads ';
        const params: any[] = [];
        
        if (search) {
            query += 'WHERE name LIKE ? ';
            params.push(`%${search}%`);
        }
        
        query += 'ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        const data = this.db.prepare(query).all(...params);
        
        let countQuery = 'SELECT COUNT(*) as total FROM piece_rate_heads ';
        if (search) countQuery += 'WHERE name LIKE ?';
        
        const countRes = this.db.prepare(countQuery).get(...(search ? [`%${search}%`] : [])) as {total: number};
        
        return { data, total: countRes.total };
    }

    getHeadById(id: string) {
        return this.db.prepare('SELECT * FROM piece_rate_heads WHERE id = ?').get(id) as PieceRateHead;
    }

    createHead(head: PieceRateHead, user: string) {
        this.db.prepare(`
            INSERT INTO piece_rate_heads 
            (id, name, calculation_type, applicability, unit_of_measurement, fixed_rate, effective_date, status, created_by, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            head.id, head.name, head.calculation_type, head.applicability, head.unit_of_measurement,
            head.fixed_rate, head.effective_date, head.status, user, user
        );
    }

    updateHead(head: PieceRateHead, user: string) {
        this.db.prepare(`
            UPDATE piece_rate_heads 
            SET name = ?, calculation_type = ?, applicability = ?, unit_of_measurement = ?, fixed_rate = ?, effective_date = ?, status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            head.name, head.calculation_type, head.applicability, head.unit_of_measurement,
            head.fixed_rate, head.effective_date, head.status, user, head.id
        );
    }

    deleteHead(id: string, user: string) {
        try {
            this.db.prepare('UPDATE piece_rate_heads SET updated_by = ? WHERE id = ?').run(user, id);
        } catch(e) {}
        this.db.prepare('DELETE FROM piece_rate_heads WHERE id = ?').run(id);
    }

    // Slabs
    getSlabsByHead(headId: string) {
        return this.db.prepare('SELECT * FROM piece_rate_slabs WHERE head_id = ? ORDER BY min_pieces ASC').all();
    }

    createSlab(slab: PieceRateSlab, user: string) {
        this.db.prepare(`
            INSERT INTO piece_rate_slabs 
            (id, head_id, min_pieces, max_pieces, rate, effective_date, created_by, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            slab.id, slab.head_id, slab.min_pieces, slab.max_pieces, slab.rate, slab.effective_date, user, user
        );
    }

    deleteSlabsByHead(headId: string) {
        this.db.prepare('DELETE FROM piece_rate_slabs WHERE head_id = ?').run(headId);
    }

    // Mappings
    getMappingsByHead(headId: string) {
        return this.db.prepare(`
            SELECT m.*, e.emp_code, e.name as emp_name 
            FROM piece_rate_employee_mapping m
            JOIN employees e ON m.emp_id = e.id
            WHERE m.head_id = ? 
            ORDER BY e.emp_code ASC
        `).all(headId);
    }

    createMapping(mapping: PieceRateEmployeeMapping, user: string) {
        this.db.prepare(`
            INSERT INTO piece_rate_employee_mapping 
            (id, head_id, emp_id, fixed_rate, effective_date, created_by, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            mapping.id, mapping.head_id, mapping.emp_id, mapping.fixed_rate, mapping.effective_date, user, user
        );
    }

    deleteMappingsByHead(headId: string) {
        this.db.prepare('DELETE FROM piece_rate_employee_mapping WHERE head_id = ?').run(headId);
    }
}
