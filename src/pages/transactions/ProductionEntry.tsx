import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, CheckCircle, Save, X, ClipboardList } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { invoke } from '@tauri-apps/api/tauri';
import PayrollPostingModal from './PayrollPostingModal';

function ProductionEntryList({ onAddNew, onEdit, canWrite }: { onAddNew: () => void, onEdit: (id: string) => void, canWrite: boolean }) {

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const queryClient = useQueryClient();

    const { data: result, isLoading } = useQuery({
        queryKey: ['productionInvoices', page, search],
        queryFn: async () => {
            const result = await invoke<any>('production_entry_crud', { operation: 'list', page: String(page), limit: '50', search });
            if (!result.success) throw new Error(result.error || 'Fetch failed');
            return result;
        }
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: string }) => {
            const result = await invoke<any>('production_entry_crud', { operation: 'update_status', id, data: { status } });
            if (!result.success) throw new Error(result.error || 'Failed to update status');
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['productionInvoices'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const result = await invoke<any>('production_entry_crud', { operation: 'delete', id });
            if (!result.success) throw new Error(result.error || 'Failed to delete');
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['productionInvoices'] });
        }
    });

    return (
        <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-6 border-b flex flex-row items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold font-sans text-gray-900 tracking-tight">Production Invoices</h2>
                    <p className="text-sm text-gray-500 font-sans">Manage piece-rate production entries</p>
                </div>
                {canWrite && (
                    <button onClick={onAddNew} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center">
                        <Plus className="w-4 h-4 mr-2" /> New Entry
                    </button>
                )}
            </div>

            <div className="p-6">
                <div className="flex gap-4 mb-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            placeholder="Search by Invoice No, Employee, Month..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full border rounded pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto border rounded-md">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 font-mono">
                            <tr>
                                <th className="px-4 py-3">Invoice No</th>
                                <th className="px-4 py-3">Month</th>
                                <th className="px-4 py-3">Employee</th>
                                <th className="px-4 py-3">Gross</th>
                                <th className="px-4 py-3">Deduction</th>
                                <th className="px-4 py-3">Net</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={8} className="text-center py-4 text-gray-500 font-mono">Loading...</td></tr>
                            ) : result?.data?.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-4 text-gray-500 font-mono">No invoices found</td></tr>
                            ) : (
                                result?.data?.map((inv: any) => (
                                    <tr key={inv.id} className="border-t">
                                        <td className="px-4 py-3 font-medium">{inv.invoice_no}</td>
                                        <td className="px-4 py-3">{inv.month_year}</td>
                                        <td className="px-4 py-3">{inv.emp_name} ({inv.emp_code})</td>
                                        <td className="px-4 py-3">{inv.gross_amount?.toFixed(2)}</td>
                                        <td className="px-4 py-3">{inv.deduction_amount?.toFixed(2)}</td>
                                        <td className="px-4 py-3 font-semibold">{inv.net_amount?.toFixed(2)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-xs rounded-full border ${
                                                inv.status === 'POSTED' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                                inv.status === 'APPROVED' ? 'bg-green-100 text-green-800 border-green-200' :
                                                inv.status === 'PENDING' || inv.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                                'bg-gray-100 text-gray-800 border-gray-200'
                                            }`}>
                                                {inv.status === 'SUBMITTED' ? 'PENDING' : inv.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right flex justify-end gap-2">
                                            {inv.status === 'DRAFT' && canWrite && (
                                                <>
                                                    <button className="p-2 text-gray-600 hover:bg-gray-100 rounded" onClick={() => onEdit(inv.id)} title="Edit">
                                                        <Edit2 className="w-4 h-4 text-blue-600" />
                                                    </button>
                                                    <button className="p-2 text-gray-600 hover:bg-gray-100 rounded" onClick={() => updateStatusMutation.mutate({ id: inv.id, status: 'PENDING' })} title="Submit for Approval">
                                                        <CheckCircle className="w-4 h-4 text-orange-600" />
                                                    </button>
                                                    <button className="p-2 text-gray-600 hover:bg-gray-100 rounded" onClick={() => deleteMutation.mutate(inv.id)} title="Delete">
                                                        <Trash2 className="w-4 h-4 text-red-600" />
                                                    </button>
                                                </>
                                            )}
                                            {(inv.status === 'PENDING' || inv.status === 'SUBMITTED') && canWrite && (
                                              <>
                                                <button className="px-3 py-1 border rounded text-sm bg-green-50 hover:bg-green-100 text-green-700 border-green-200" onClick={() => updateStatusMutation.mutate({ id: inv.id, status: 'APPROVED' })}>
                                                    Approve
                                                </button>
                                                <button className="p-2 text-gray-600 hover:bg-gray-100 rounded" onClick={() => onEdit(inv.id)} title="View Detail">
                                                    <Search className="w-4 h-4 text-gray-600" />
                                                </button>
                                              </>
                                            )}
                                            {inv.status === 'APPROVED' && canWrite && (
                                                <>
                                                    <button className="px-3 py-1 border rounded text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200" onClick={() => onEdit(inv.id + '|APPROVAL_MODAL')}>
                                                        Review & Post
                                                    </button>
                                                </>
                                            )}
                                            {inv.status === 'POSTED' && (
                                                <button className="px-3 py-1 border rounded text-sm hover:bg-gray-50" onClick={() => onEdit(inv.id)}>
                                                    View
                                                </button>
                                            )}
                                        </td>

                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between items-center mt-4">
                    <span className="text-sm text-gray-500 font-mono">
                        Showing {result?.data?.length || 0} of {result?.total || 0} records
                    </span>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                        <button className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50" onClick={() => setPage(p => p + 1)} disabled={!result || page * 50 >= result.total}>Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ProductionEntryForm({ invoiceId, onCancel, canWrite }: { invoiceId: string | null, onCancel: () => void, canWrite: boolean }) {
    const queryClient = useQueryClient();
    const [empId, setEmpId] = useState<string>('');
    const [monthYear, setMonthYear] = useState<string>('');
    const [status, setStatus] = useState<string>('DRAFT');
    const [details, setDetails] = useState<any[]>([]);

    const isReadOnly = status !== 'DRAFT' || !canWrite;


    const { data: employees } = useQuery({
        queryKey: ['employeesList'],
        queryFn: async () => {
            const res = await invoke<any>('get_master_data', { moduleType: 'K' });
            return res.employees || [];
        }
    });

    const { data: existingData, isLoading: isLoadingExisting } = useQuery({
        queryKey: ['productionInvoice', invoiceId],
        queryFn: async () => {
            if (!invoiceId) return null;
            const result = await invoke<any>('production_entry_crud', { operation: 'get', id: invoiceId });
            if (!result.success) throw new Error(result.error || 'Fetch failed');
            return result.data;
        },
        enabled: !!invoiceId
    });

    useEffect(() => {
        if (existingData?.data) {
            setEmpId(existingData.data.invoice.emp_id.toString());
            setMonthYear(existingData.data.invoice.month_year);
            setStatus(existingData.data.invoice.status);
            setDetails(existingData.data.details || []);
        }
    }, [existingData]);

    const { data: configData } = useQuery({
        queryKey: ['productionConfig', empId],
        queryFn: async () => {
            if (!empId) return null;
            const result = await invoke<any>('production_entry_crud', { operation: 'config_details', emp_id: String(empId) });
            if (!result.success) throw new Error(result.error || 'Fetch failed');
            return result;
        },
        enabled: !!empId
    });

    const addDetailLine = (type: string) => {
        if (!configData?.data) return;
        setDetails([...details, { head_id: '', head_name: '', type, quantity: 1, rate: 0, amount: 0 }]);
    };

    const removeDetailLine = (index: number) => {
        const d = [...details];
        d.splice(index, 1);
        setDetails(d);
    };

    const updateDetailLine = async (index: number, key: string, value: any) => {
        const d = [...details];
        d[index][key] = value;

        if (key === 'head_id') {
            const options = d[index].type === 'EARNING' ? configData?.data.earnings : configData?.data.deductions;
            const hd = options?.find((h: any) => h.head_id === value);
            if (hd) {
                d[index].head_name = hd.head_name;
                // Pre-fill rate if fixed rate
                if (hd.calculation_type === 'FIXED') {
                    d[index].rate = hd.fixed_rate;
                    d[index].amount = hd.fixed_rate * d[index].quantity;
                }
            }
        }

        if (d[index].type === 'EARNING' && monthYear) {
            if (key === 'head_id' || key === 'quantity') {
                const effectiveDate = monthYear + '-01';
                try {
                    const rData = await invoke<any>('production_entry_crud', { operation: 'calculate_rate', head_id: d[index].head_id, quantity: d[index].quantity, date: effectiveDate });
                    if (rData.success) {
                        d[index].rate = rData.data.rate;
                        d[index].amount = rData.data.amount;
                    }
                } catch (e) {}
            }
        } else if (d[index].type === 'DEDUCTION') {
            if (key === 'amount') {
                d[index].amount = Number(value) || 0;
            }
        }

        setDetails(d);
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            const operation = invoiceId ? 'update' : 'create';
            const result = await invoke<any>('production_entry_crud', { 
                operation, 
                id: invoiceId, 
                data: { emp_id: Number(empId), month_year: monthYear, details } 
            });
            if (!result.success) throw new Error(result.error || 'Failed to save');
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['productionInvoices'] });
            onCancel();
        }
    });

    const gross = details.filter(d => d.type === 'EARNING').reduce((acc, d) => acc + (d.amount || 0), 0);
    const deduction = details.filter(d => d.type === 'DEDUCTION').reduce((acc, d) => acc + (d.amount || 0), 0);
    const net = gross - deduction;

    if (invoiceId && isLoadingExisting) return <div>Loading...</div>;

    return (
        <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold font-sans text-gray-900 tracking-tight">
                            {invoiceId ? 'Edit Production Entry' : 'New Production Entry'}
                        </h2>
                        {status !== 'DRAFT' && <span className="text-sm font-semibold text-red-600 bg-red-100 px-2 py-1 rounded mt-2 inline-block">Read Only ({status})</span>}
                    </div>
                </div>
            </div>
            <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="text-sm font-medium text-gray-700 font-sans block mb-1">Wage Month</label>
                        <input 
                            type="month" 
                            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1"
                            value={monthYear} 
                            onChange={e => setMonthYear(e.target.value)} 
                            disabled={isReadOnly}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 font-sans block mb-1">Employee</label>
                        <select 
                            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1"
                            value={empId} 
                            onChange={e => setEmpId(e.target.value)} 
                            disabled={isReadOnly}
                        >
                            <option value="" disabled>Select Employee</option>
                            {employees?.map((emp: any) => (
                                <option key={emp.id} value={emp.id.toString()}>
                                    {emp.name} ({emp.emp_code})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-gray-900 font-sans">Earnings (Production)</h3>
                        {!isReadOnly && <button className="px-3 py-1 border rounded text-sm hover:bg-gray-50" onClick={() => addDetailLine('EARNING')}>+ Add Line</button>}
                    </div>
                    <table className="w-full text-sm text-left border rounded-md mb-2">
                        <thead className="bg-gray-50 text-xs text-gray-500 font-mono">
                            <tr>
                                <th className="px-3 py-2 w-1/3">Piece Rate Head</th>
                                <th className="px-3 py-2 w-1/6">Quantity</th>
                                <th className="px-3 py-2 w-1/6">Rate</th>
                                <th className="px-3 py-2 w-1/6">Amount</th>
                                {!isReadOnly && <th className="px-3 py-2 w-16"></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {details.filter(d => d.type === 'EARNING').map((d, i) => {
                                const realIndex = details.indexOf(d);
                                return (
                                    <tr key={i} className="border-t">
                                        <td className="px-3 py-2">
                                            <select 
                                                className="w-full border rounded px-2 py-1 text-sm bg-white"
                                                value={d.head_id} 
                                                onChange={e => updateDetailLine(realIndex, 'head_id', e.target.value)} 
                                                disabled={isReadOnly}
                                            >
                                                <option value="" disabled>Select Head</option>
                                                {configData?.data?.earnings?.map((h: any) => (
                                                    <option key={h.head_id} value={h.head_id}>{h.head_name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-3 py-2">
                                            <input 
                                                type="number" 
                                                className="w-full border rounded px-2 py-1 text-sm"
                                                value={d.quantity} 
                                                onChange={e => updateDetailLine(realIndex, 'quantity', Number(e.target.value))} 
                                                disabled={isReadOnly} 
                                            />
                                        </td>
                                        <td className="px-3 py-2 font-mono">{d.rate.toFixed(2)}</td>
                                        <td className="px-3 py-2 font-mono font-semibold">{d.amount.toFixed(2)}</td>
                                        {!isReadOnly && (
                                            <td className="px-3 py-2 text-right">
                                                <button className="p-1 text-gray-600 hover:bg-gray-100 rounded" onClick={() => removeDetailLine(realIndex)}>
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-gray-900 font-sans">Deductions</h3>
                        {!isReadOnly && <button className="px-3 py-1 border rounded text-sm hover:bg-gray-50" onClick={() => addDetailLine('DEDUCTION')}>+ Add Deduction</button>}
                    </div>
                    <table className="w-full text-sm text-left border rounded-md">
                        <thead className="bg-gray-50 text-xs text-gray-500 font-mono">
                            <tr>
                                <th className="px-3 py-2 w-1/2">Deduction Head</th>
                                <th className="px-3 py-2 w-1/4">Amount</th>
                                {!isReadOnly && <th className="px-3 py-2 w-1/4"></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {details.filter(d => d.type === 'DEDUCTION').map((d, i) => {
                                const realIndex = details.indexOf(d);
                                return (
                                    <tr key={i} className="border-t">
                                        <td className="px-3 py-2">
                                            <select 
                                                className="w-full border rounded px-2 py-1 text-sm bg-white"
                                                value={d.head_id} 
                                                onChange={e => updateDetailLine(realIndex, 'head_id', e.target.value)} 
                                                disabled={isReadOnly}
                                            >
                                                <option value="" disabled>Select Deduction</option>
                                                {configData?.data?.deductions?.map((h: any) => (
                                                    <option key={h.head_id} value={h.head_id}>{h.head_name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-3 py-2">
                                            <input 
                                                type="number" 
                                                className="w-full border rounded px-2 py-1 text-sm"
                                                value={d.amount} 
                                                onChange={e => updateDetailLine(realIndex, 'amount', e.target.value)} 
                                                disabled={isReadOnly} 
                                            />
                                        </td>
                                        {!isReadOnly && (
                                            <td className="px-3 py-2 text-right">
                                                <button className="p-1 text-gray-600 hover:bg-gray-100 rounded" onClick={() => removeDetailLine(realIndex)}>
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end mb-6">
                    <div className="w-64 bg-gray-50 p-4 rounded-md border font-sans">
                        <div className="flex justify-between mb-2"><span className="text-gray-600">Gross:</span> <span className="font-mono">{gross.toFixed(2)}</span></div>
                        <div className="flex justify-between mb-2"><span className="text-gray-600">Deduction:</span> <span className="font-mono text-red-600">{deduction.toFixed(2)}</span></div>
                        <div className="flex justify-between font-bold pt-2 border-t"><span className="text-gray-900">Net Payable:</span> <span className="font-mono text-green-700">{net.toFixed(2)}</span></div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 border-t pt-4">
                    <button className="px-4 py-2 border rounded text-sm hover:bg-gray-50 flex items-center" onClick={onCancel}>
                        <X className="w-4 h-4 mr-2" /> Cancel
                    </button>
                    {!isReadOnly && (
                        <button 
                            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center disabled:opacity-50" 
                            onClick={() => saveMutation.mutate()} 
                            disabled={!empId || !monthYear || saveMutation.isPending}
                        >
                            <Save className="w-4 h-4 mr-2" /> {invoiceId ? 'Update' : 'Save'} Entry
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ProductionEntry() {
    const { permissionMap } = useAuthStore();
    const [view, setView] = useState<'LIST' | 'FORM' | 'APPROVAL_MODAL'>('LIST');
    const [editId, setEditId] = useState<string | null>(null);

    if (!permissionMap?.Transactions) {
        return (
            <div className="p-6">
                <div className="bg-red-50 text-red-800 p-4 rounded border border-red-200">
                    <h3 className="font-bold">Access Denied</h3>
                    <p>You do not have permission to view Transactions.</p>
                </div>
            </div>
        );
    }

    const canWrite = !!permissionMap.Transactions;

    return (
        <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
            <h1 className="text-3xl font-black text-primary-navy flex items-center gap-3">
                <ClipboardList className="w-8 h-8" /> Production & Piece-Rate Entry
            </h1>
            
            {view === 'LIST' ? (
                <ProductionEntryList 
                    canWrite={canWrite}
                    onAddNew={() => { setEditId(null); setView('FORM'); }} 
                    onEdit={(val) => { 
                        if (val.includes('|APPROVAL_MODAL')) {
                            setEditId(val.split('|')[0]);
                            setView('APPROVAL_MODAL');
                        } else {
                            setEditId(val); 
                            setView('FORM'); 
                        }
                    }} 
                />
            ) : view === 'APPROVAL_MODAL' && editId ? (
                <>
                    <ProductionEntryList 
                        canWrite={canWrite}
                        onAddNew={() => { setEditId(null); setView('FORM'); }} 
                        onEdit={(val) => { 
                            if (val.includes('|APPROVAL_MODAL')) {
                                setEditId(val.split('|')[0]);
                                setView('APPROVAL_MODAL');
                            } else {
                                setEditId(val); 
                                setView('FORM'); 
                            }
                        }} 
                    />
                    <PayrollPostingModal 
                        invoiceId={editId}
                        onCancel={() => { setEditId(null); setView('LIST'); }}
                    />
                </>
            ) : (
                <ProductionEntryForm 
                    invoiceId={editId} 
                    canWrite={canWrite}
                    onCancel={() => { setEditId(null); setView('LIST'); }} 
                />
            )}
        </div>
    );
}

