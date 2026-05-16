import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Check } from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';

export default function PayrollPostingModal({ invoiceId, onCancel }: { invoiceId: string, onCancel: () => void }) {
    const queryClient = useQueryClient();

    const { data: result, isLoading } = useQuery({
        queryKey: ['productionInvoicePosting', invoiceId],
        queryFn: async () => {
             const result = await invoke<any>('production_entry_crud', { operation: 'get', id: invoiceId });
             if (!result.success) throw new Error(result.error || 'Fetch failed');
             return result.data;
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
            onCancel();
        }
    });

    if (isLoading || !result?.data) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded shadow max-w-md w-full">Loading...</div>
            </div>
        );
    }

    const { invoice, details } = result.data;
    const postingDate = invoice.month_year + '-01';

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-lg max-w-2xl w-full flex flex-col max-h-[90vh]">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900 font-sans">Payroll Posting Preview</h3>
                    <button onClick={onCancel} className="p-1 hover:bg-gray-200 rounded">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <div className="bg-blue-50 text-blue-800 p-4 rounded border border-blue-200 mb-6 text-sm">
                        You are about to post <strong>{invoice.invoice_no}</strong> for <strong>{invoice.emp_name} ({invoice.emp_code})</strong>. 
                        This action will lock the invoice and create a payroll wage entry for the month of <strong>{invoice.month_year}</strong> (Posting Date: {postingDate}).
                    </div>
                    
                    <div className="mb-4">
                        <h4 className="font-bold text-gray-700 font-mono text-sm uppercase tracking-wider mb-2">Invoice Summary</h4>
                        <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded border">
                            <div>
                                <span className="block text-xs text-gray-500">Gross</span>
                                <span className="font-mono text-lg">{invoice.gross_amount.toFixed(2)}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-gray-500">Deduction</span>
                                <span className="font-mono text-lg text-red-600">{invoice.deduction_amount.toFixed(2)}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-gray-500">Net Payable</span>
                                <span className="font-mono text-lg text-green-700 font-bold">{invoice.net_amount.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-700 font-mono text-sm uppercase tracking-wider mb-2">Payroll Distribution</h4>
                        <table className="w-full text-sm text-left border rounded">
                            <thead className="bg-gray-50 font-mono">
                                <tr>
                                    <th className="px-3 py-2 border-b">Head</th>
                                    <th className="px-3 py-2 border-b">Type</th>
                                    <th className="px-3 py-2 border-b text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {details.map((d: any, i: number) => (
                                    <tr key={i} className="border-b last:border-b-0">
                                        <td className="px-3 py-2">{d.head_name}</td>
                                        <td className="px-3 py-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${d.type === 'EARNING' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {d.type}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono">{d.amount.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="p-4 border-t flex justify-end gap-3 bg-gray-50">
                    <button className="px-4 py-2 border rounded hover:bg-gray-100 text-sm font-medium" onClick={onCancel}>
                        Cancel
                    </button>
                    <button 
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium flex items-center disabled:opacity-50"
                        onClick={() => updateStatusMutation.mutate({ id: invoiceId, status: 'POSTED' })}
                        disabled={updateStatusMutation.isPending}
                    >
                        <Check className="w-4 h-4 mr-2" /> 
                        {updateStatusMutation.isPending ? 'Posting...' : 'Approve & Post to Payroll'}
                    </button>
                </div>
            </div>
        </div>
    );
}
