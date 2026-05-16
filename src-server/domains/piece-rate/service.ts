import { Database } from 'better-sqlite3';
import { PieceRateRepository, PieceRateHead, PieceRateSlab, PieceRateEmployeeMapping } from './repository';
import { randomUUID } from 'crypto';

export class PieceRateService {
    private repo: PieceRateRepository;

    constructor(private db: Database) {
        this.repo = new PieceRateRepository(db);
    }

    getHeads(page: number = 1, limit: number = 20, search: string = '') {
        const result = this.repo.getHeads(page, limit, search) as {data: any[], total: number};
        return {
            total: result.total,
            data: result.data.map(h => ({
                ...h,
                slabs: h.calculation_type === 'SLAB' ? this.repo.getSlabsByHead(h.id) : [],
                mappings: h.applicability === 'EMPLOYEE_WISE' ? this.repo.getMappingsByHead(h.id) : []
            }))
        };
    }

    saveHeadWithDetails(data: any, username: string) {
        const transaction = this.db.transaction((payload) => {
            let headId = payload.id;
            const isNew = !headId;

            if (isNew) {
                headId = randomUUID();
                this.repo.createHead({
                    id: headId,
                    name: payload.name,
                    calculation_type: payload.calculation_type,
                    applicability: payload.applicability,
                    unit_of_measurement: payload.unit_of_measurement,
                    fixed_rate: payload.fixed_rate || null,
                    effective_date: payload.effective_date,
                    status: payload.status !== undefined ? payload.status : 1
                }, username);
            } else {
                this.repo.updateHead({
                    id: headId,
                    ...payload
                }, username);
            }

            if (payload.calculation_type === 'SLAB') {
                this.repo.deleteSlabsByHead(headId);
                if (payload.slabs && Array.isArray(payload.slabs)) {
                    for (const slab of payload.slabs) {
                        this.repo.createSlab({
                            id: randomUUID(),
                            head_id: headId,
                            min_pieces: slab.min_pieces,
                            max_pieces: slab.max_pieces || null,
                            rate: slab.rate,
                            effective_date: slab.effective_date || payload.effective_date
                        }, username);
                    }
                }
            }

            if (payload.applicability === 'EMPLOYEE_WISE') {
                this.repo.deleteMappingsByHead(headId);
                if (payload.mappings && Array.isArray(payload.mappings)) {
                    for (const mapping of payload.mappings) {
                        this.repo.createMapping({
                            id: randomUUID(),
                            head_id: headId,
                            emp_id: mapping.emp_id,
                            fixed_rate: mapping.fixed_rate || null,
                            effective_date: mapping.effective_date || payload.effective_date
                        }, username);
                    }
                }
            }

            return headId;
        });

        return transaction(data);
    }

    deleteHead(id: string, user: string) {
        const transaction = this.db.transaction(() => {
            this.repo.deleteHead(id, user);
        });
        transaction();
    }
}
