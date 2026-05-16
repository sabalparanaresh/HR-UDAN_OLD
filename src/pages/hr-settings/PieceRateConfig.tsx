import * as XLSX from 'xlsx';
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useAuthStore } from '../../store/authStore';
import { RBACGuard } from '../../components/rbac';
import { Plus, Save, Trash2, Edit2, Download, Upload, Loader2, X } from 'lucide-react';

interface Slab {
    min_pieces: number;
    max_pieces: number | null;
    rate: number;
}

interface Mapping {
    emp_id: number;
    emp_code?: string;
    emp_name?: string;
    fixed_rate: number | null;
}

interface PieceRateHead {
    id?: string;
    name: string;
    calculation_type: 'SLAB' | 'FIXED';
    applicability: 'UNIVERSAL' | 'EMPLOYEE_WISE';
    unit_of_measurement: string;
    fixed_rate: number | null;
    effective_date: string;
    status: number;
    slabs?: Slab[];
    mappings?: Mapping[];
}

export default function PieceRateConfig() {
    const { user } = useAuthStore();
    const [heads, setHeads] = useState<PieceRateHead[]>([]);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [search, setSearch] = useState('');
    const [totalHeads, setTotalHeads] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    
    const defaultHead: PieceRateHead = {
        name: '',
        calculation_type: 'FIXED',
        applicability: 'UNIVERSAL',
        unit_of_measurement: 'Pieces',
        fixed_rate: 0,
        effective_date: new Date().toISOString().split('T')[0],
        status: 1,
        slabs: [],
        mappings: []
    };
    
    const [currentHead, setCurrentHead] = useState<PieceRateHead>(defaultHead);

    const fetchHeads = async () => {
        setIsLoading(true);
        try {
            const result = await invoke<any>('piece_rate_crud', { operation: 'list', page, limit, search });
            if (result.success) { setHeads(result.data); setTotalHeads(result.total); }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHeads();
    }, [page, limit, search]);

    
    const handleExport = () => {
        const data = heads.map(h => ({
            'Config Name': h.name,
            'Type': h.calculation_type,
            'Applicability': h.applicability,
            'UOM': h.unit_of_measurement,
            'Base Rate': h.fixed_rate || '',
            'Effective Date': h.effective_date
        }));
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Piece_Rates");
        XLSX.writeFile(wb, "Piece_Rate_Configs.xlsx");
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(sheet) as any[];
            
            // Map data
            const mapped = data.map(row => ({
                name: row['Config Name'] || '',
                calculation_type: row['Type']?.toUpperCase() === 'SLAB' ? 'SLAB' : 'FIXED',
                applicability: row['Applicability']?.toUpperCase() === 'EMPLOYEE_WISE' ? 'EMPLOYEE_WISE' : 'UNIVERSAL',
                unit_of_measurement: row['UOM'] || 'Pieces',
                fixed_rate: row['Base Rate'] ? parseFloat(row['Base Rate']) : null,
                effective_date: row['Effective Date'] || new Date().toISOString().split('T')[0],
                status: 1
            }));

            const result = await invoke<any>('piece_rate_crud', {
                operation: 'upload',
                data: mapped
            });
            if (result.success) {
                alert('Upload successful');
                fetchHeads();
            }
        } catch (err) {
            console.error(err);
            alert('Upload failed');
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleSave = async () => {
        if (!currentHead.name || (!currentHead.fixed_rate && currentHead.calculation_type === 'FIXED')) return;
        setIsSaving(true);
        try {
            const result = await invoke<any>('piece_rate_crud', {
                operation: currentHead.id ? 'update' : 'create',
                data: currentHead
            });
            if (result.success) {
                setModalOpen(false);
                fetchHeads();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this piece rate config?')) return;
        try {
            await invoke('piece_rate_crud', { operation: 'delete', id });
            fetchHeads();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-primary-navy">Piece Rate Configuration</h2>
                    <p className="text-text-muted text-sm">Manage item-wise rates, slabs, and employee mappings.</p>
                </div>
                <div className="flex gap-2">
                    <RBACGuard permission="CompanySettings.edit">
                        <input type="file" id="bulk-upload" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                        <label htmlFor="bulk-upload" className="app-btn app-btn-secondary flex items-center gap-2 cursor-pointer">
                            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16}/>} 
                            Upload Excel
                        </label>
                    </RBACGuard>
                    <button onClick={handleExport} className="app-btn app-btn-secondary flex items-center gap-2"><Download size={16}/> Export</button>
                    <RBACGuard permission="CompanySettings.edit">
                        <button onClick={() => { setCurrentHead(defaultHead); setModalOpen(true); }} className="app-btn app-btn-primary flex items-center gap-2">
                            <Plus size={16} /> Add Config
                        </button>
                    </RBACGuard>
                </div>
            </div>

            <div className="bg-white border text-sm border-app-border rounded-md shadow-sm overflow-hidden flex flex-col">
                <div className="p-3 border-b flex justify-between items-center bg-slate-50">
                    <input 
                        type="text" 
                        placeholder="Search configurations..." 
                        className="border rounded px-3 py-1.5 w-64 text-sm"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                {isLoading ? (
                    <div className="p-8 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2"/> Loading configurations...</div>
                ) : (
                    <>
                    <table className="w-full text-left">
                        <thead className="bg-slate-100 border-b border-app-border">
                            <tr>
                                <th className="p-3 font-bold text-primary-navy">Config Name</th>
                                <th className="p-3 font-bold text-primary-navy">Type</th>
                                <th className="p-3 font-bold text-primary-navy">Applicability</th>
                                <th className="p-3 font-bold text-primary-navy">Rate/Slabs</th>
                                <th className="p-3 font-bold text-primary-navy">Status</th>
                                <th className="p-3 font-bold text-primary-navy text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {heads.length === 0 ? (
                                <tr><td colSpan={6} className="p-4 text-center text-text-muted">No configurations found.</td></tr>
                            ) : heads.map(h => (
                                <tr key={h.id} className="border-b border-app-border hover:bg-slate-50">
                                    <td className="p-3 font-semibold">{h.name}</td>
                                    <td className="p-3">{h.calculation_type}</td>
                                    <td className="p-3">{h.applicability}</td>
                                    <td className="p-3">{h.calculation_type === 'FIXED' ? `₹\${h.fixed_rate}/\${h.unit_of_measurement}` : `\${h.slabs?.length || 0} Slabs`}</td>
                                    <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold \${h.status === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{h.status === 1 ? 'ACTIVE' : 'INACTIVE'}</span></td>
                                    <td className="p-3 flex justify-end gap-2">
                                        <RBACGuard permission="CompanySettings.edit">
                                            <button onClick={() => { setCurrentHead(h); setModalOpen(true); }} className="text-primary-navy hover:text-indigo-600"><Edit2 size={16}/></button>
                                        </RBACGuard>
                                        <RBACGuard permission="CompanySettings.delete">
                                            <button onClick={() => handleDelete(h.id!)} className="text-rose-600 hover:text-rose-800"><Trash2 size={16}/></button>
                                        </RBACGuard>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="p-3 border-t bg-slate-50 flex justify-between items-center text-xs text-slate-500">
                        <div>Showing {Math.min((page - 1) * limit + 1, totalHeads)} to {Math.min(page * limit, totalHeads)} of {totalHeads} entries</div>
                        <div className="flex gap-1">
                            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-2 py-1 border rounded bg-white hover:bg-slate-100 disabled:opacity-50">Prev</button>
                            <button disabled={page * limit >= totalHeads} onClick={() => setPage(page + 1)} className="px-2 py-1 border rounded bg-white hover:bg-slate-100 disabled:opacity-50">Next</button>
                        </div>
                    </div>
                    </>
                )}
            </div>

            {modalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="font-bold text-lg text-primary-navy">{currentHead.id ? 'Edit Config' : 'New Piece Rate Config'}</h3>
                            <button onClick={() => setModalOpen(false)}><X className="text-slate-500 hover:text-slate-800"/></button>
                        </div>
                        
                        <div className="p-4 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Configuration Name</label>
                                    <input type="text" className="w-full border rounded p-2" value={currentHead.name} onChange={e => setCurrentHead({...currentHead, name: e.target.value})} placeholder="e.g. Stitching A" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Calculation Type</label>
                                    <select className="w-full border rounded p-2" value={currentHead.calculation_type} onChange={e => setCurrentHead({...currentHead, calculation_type: e.target.value as any})}>
                                        <option value="FIXED">Fixed Rate</option>
                                        <option value="SLAB">Slab Wise</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Applicability</label>
                                    <select className="w-full border rounded p-2" value={currentHead.applicability} onChange={e => setCurrentHead({...currentHead, applicability: e.target.value as any})}>
                                        <option value="UNIVERSAL">Universal</option>
                                        <option value="EMPLOYEE_WISE">Employee Wise</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Unit of Measurement</label>
                                    <input type="text" className="w-full border rounded p-2" value={currentHead.unit_of_measurement} onChange={e => setCurrentHead({...currentHead, unit_of_measurement: e.target.value})} />
                                </div>
                                
                                {currentHead.calculation_type === 'FIXED' && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Base Rate (₹)</label>
                                        <input type="number" className="w-full border rounded p-2" value={currentHead.fixed_rate || ''} onChange={e => setCurrentHead({...currentHead, fixed_rate: parseFloat(e.target.value)})} />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Effective Date</label>
                                    <input type="date" className="w-full border rounded p-2" value={currentHead.effective_date} onChange={e => setCurrentHead({...currentHead, effective_date: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                                    <select className="w-full border rounded p-2" value={currentHead.status} onChange={e => setCurrentHead({...currentHead, status: parseInt(e.target.value)})}>
                                        <option value={1}>Active</option>
                                        <option value={0}>Inactive</option>
                                    </select>
                                </div>
                            </div>

                            {currentHead.calculation_type === 'SLAB' && (
                                <div className="border border-slate-200 p-4 rounded bg-slate-50 mt-4">
                                    <div className="flex justify-between mb-2">
                                        <h4 className="font-bold text-primary-navy">Slab Rules</h4>
                                        <button onClick={() => setCurrentHead({...currentHead, slabs: [...(currentHead.slabs || []), {min_pieces: 0, max_pieces: null, rate: 0}]})} className="text-xs font-bold text-indigo-600 flex items-center"><Plus size={14}/> Add Slab</button>
                                    </div>
                                    <table className="w-full text-xs text-left mb-2">
                                        <thead><tr className="border-b"><th className="pb-1">Min Pieces</th><th className="pb-1">Max Pieces</th><th className="pb-1">Rate (₹)</th><th className="pb-1 w-8"></th></tr></thead>
                                        <tbody>
                                            {currentHead.slabs?.map((slab, i) => (
                                                <tr key={i}>
                                                    <td className="p-1"><input type="number" className="w-full border p-1" value={slab.min_pieces} onChange={e => { const r = [...currentHead.slabs!]; r[i].min_pieces = parseInt(e.target.value); setCurrentHead({...currentHead, slabs: r});}} /></td>
                                                    <td className="p-1"><input type="number" className="w-full border p-1" value={slab.max_pieces || ''} placeholder="Infinity" onChange={e => { const r = [...currentHead.slabs!]; r[i].max_pieces = e.target.value ? parseInt(e.target.value) : null; setCurrentHead({...currentHead, slabs: r});}} /></td>
                                                    <td className="p-1"><input type="number" className="w-full border p-1" value={slab.rate} onChange={e => { const r = [...currentHead.slabs!]; r[i].rate = parseFloat(e.target.value); setCurrentHead({...currentHead, slabs: r});}} /></td>
                                                    <td className="p-1 text-center"><button onClick={() => setCurrentHead({...currentHead, slabs: currentHead.slabs?.filter((_, idx) => idx !== i)})} className="text-rose-500"><Trash2 size={14}/></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {currentHead.applicability === 'EMPLOYEE_WISE' && (
                                <div className="border border-slate-200 p-4 rounded bg-slate-50 mt-4">
                                     <div className="flex justify-between mb-2">
                                        <h4 className="font-bold text-primary-navy">Employee Mappings</h4>
                                        <button onClick={() => setCurrentHead({...currentHead, mappings: [...(currentHead.mappings || []), {emp_id: 0, fixed_rate: null}]})} className="text-xs font-bold text-indigo-600 flex items-center"><Plus size={14}/> Add Employee</button>
                                    </div>
                                    <table className="w-full text-xs text-left mb-2">
                                        <thead><tr className="border-b"><th className="pb-1">Emp ID (Code)</th><th className="pb-1">Custom Base Rate (Optional)</th><th className="pb-1 w-8"></th></tr></thead>
                                        <tbody>
                                            {currentHead.mappings?.map((m, i) => (
                                                <tr key={i}>
                                                    <td className="p-1 flex items-center gap-2">
                                                        <input type="number" className="w-32 border p-1" placeholder="Emp ID..." value={m.emp_id || ''} onChange={e => { const r = [...currentHead.mappings!]; r[i].emp_id = parseInt(e.target.value); setCurrentHead({...currentHead, mappings: r});}} />
                                                        <span className="text-slate-500">{m.emp_code} - {m.emp_name}</span>
                                                    </td>
                                                    <td className="p-1"><input type="number" className="w-full border p-1" placeholder="Use default if empty" value={m.fixed_rate || ''} onChange={e => { const r = [...currentHead.mappings!]; r[i].fixed_rate = e.target.value ? parseFloat(e.target.value) : null; setCurrentHead({...currentHead, mappings: r});}} /></td>
                                                    <td className="p-1 text-center"><button onClick={() => setCurrentHead({...currentHead, mappings: currentHead.mappings?.filter((_, idx) => idx !== i)})} className="text-rose-500"><Trash2 size={14}/></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded">Cancel</button>
                            <button onClick={handleSave} disabled={isSaving} className="app-btn app-btn-primary flex items-center gap-2">
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
