import Database from 'better-sqlite3';
import { ProductionEntryRepository } from './repository';

export class ProductionEntryService {
    private repo: ProductionEntryRepository;
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
        this.repo = new ProductionEntryRepository(db);
    }

    getList(page: number, limit: number, search?: string) {
        return this.repo.getList(page, limit, search);
    }

    getById(id: string) {
        return this.repo.getById(id);
    }

    create(data: any, user: string) {
        return this.repo.create(data, user);
    }

    update(id: string, data: any, user: string) {
        this.repo.update(id, data, user);
    }

    updateStatus(id: string, status: string, user: string) {
        this.repo.updateStatus(id, status, user);
    }

    delete(id: string, user: string) {
        this.repo.delete(id, user);
    }

    getHeadsForEmployee(emp_id: number) {
        // Universal piece rate heads
        const universalHeads = this.db.prepare(`
            SELECT id, name, calculation_type, unit_of_measurement, fixed_rate
            FROM piece_rate_heads
            WHERE applicability = 'UNIVERSAL' AND status = 1
        `).all() as any[];

        // Employee specific piece rate heads
        const mappedHeads = this.db.prepare(`
            SELECT h.id, h.name, h.calculation_type, h.unit_of_measurement, m.fixed_rate
            FROM piece_rate_employee_mapping m
            JOIN piece_rate_heads h ON m.head_id = h.id
            WHERE m.emp_id = ? AND h.status = 1
        `).all(emp_id) as any[];

        const earnings = [...universalHeads, ...mappedHeads].map(h => ({
            head_id: h.id,
            head_name: h.name,
            type: 'EARNING',
            calculation_type: h.calculation_type,
            unit_of_measurement: h.unit_of_measurement,
            fixed_rate: h.fixed_rate
        }));

        // Fetch deduction salary heads (which are not piece-rate specific, but standard)
        const deductionHeads = this.db.prepare(`
            SELECT id, name 
            FROM salary_heads 
            WHERE type = 'DEDUCTION' AND status = 1
        `).all() as any[];

        return {
            earnings,
            deductions: deductionHeads.map(h => ({
                head_id: h.id,
                head_name: h.name,
                type: 'DEDUCTION',
                calculation_type: 'MANUAL',
                fixed_rate: 0
            }))
        };
    }

    calculateRate(head_id: string, quantity: number, date: string) {
        const head = this.db.prepare(`
            SELECT calculation_type, fixed_rate, effective_date 
            FROM piece_rate_heads 
            WHERE id = ?
        `).get(head_id) as any;

        if (!head) return { rate: 0, amount: 0 };

        if (head.calculation_type === 'FIXED') {
            return { rate: head.fixed_rate || 0, amount: (head.fixed_rate || 0) * quantity };
        }

        if (head.calculation_type === 'SLAB') {
            // Find active slabs for the given date
            // Assuming we take the most recent effective_date that is <= date
            const latestSlabDateRow = this.db.prepare(`
                SELECT effective_date 
                FROM piece_rate_slabs 
                WHERE head_id = ? AND effective_date <= ? 
                ORDER BY effective_date DESC LIMIT 1
            `).get(head_id, date) as any;

            if (!latestSlabDateRow) return { rate: 0, amount: 0 }; // No slabs found

            const activeSlabs = this.db.prepare(`
                SELECT min_pieces, max_pieces, rate 
                FROM piece_rate_slabs 
                WHERE head_id = ? AND effective_date = ?
            `).all(head_id, latestSlabDateRow.effective_date) as any[];

            // Find matching tier
            const matchingSlab = activeSlabs.find(s => 
                quantity >= s.min_pieces && 
                (s.max_pieces === null || quantity <= s.max_pieces)
            );

            if (matchingSlab) {
                return { rate: matchingSlab.rate, amount: matchingSlab.rate * quantity };
            }
            return { rate: 0, amount: 0 };
        }

        return { rate: 0, amount: 0 };
    }
}
