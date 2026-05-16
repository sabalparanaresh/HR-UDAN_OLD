import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { 
  Package, 
  Wallet, 
  Search, 
  Plus, 
  ArrowLeftRight, 
  CheckCircle2, 
  AlertCircle, 
  History,
  Trash2,
  Undo2,
  Calendar,
  User,
  Hash,
  IndianRupee
} from 'lucide-react';
import { toast } from 'sonner';
import { Employee } from '../../types';
import EmployeeSearchSelect from '../../components/form/EmployeeSearchSelect';

interface Asset {
  id: number;
  emp_id: number;
  emp_name: string;
  emp_code: string;
  item_description: string;
  serial_number: string;
  issue_date: string;
  value: number;
  expected_return_date: string;
  status: 'Issued' | 'Returned' | 'Pending Deduction';
  returned_date?: string;
}

interface Deposit {
  id: number;
  emp_id: number;
  emp_name: string;
  emp_code: string;
  description: string;
  amount: number;
  payment_date: string;
  status: 'Paid' | 'Refunded' | 'Adjusted';
}

export default function AssetDepositTracker() {
  const [activeTab, setActiveTab] = useState<'assets' | 'deposits'>('assets');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'asset' | 'deposit'>('asset');
  
  // Form States
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [formData, setFormData] = useState<any>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const { assets, deposits } = await invoke<any>('get_asset_deposit_data');
      setAssets(assets);
      setDeposits(deposits);
      
      const master = await invoke<any>('get_master_data', { moduleType: 'K' });
      setEmployees(master.employees || []);
    } catch (error) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalType === 'asset') {
        await invoke('save_asset', { ...formData, emp_id: parseInt(selectedEmpId) });
        toast.success("Asset record saved");
      } else {
        await invoke('save_deposit', { ...formData, emp_id: parseInt(selectedEmpId) });
        toast.success("Deposit record saved");
      }
      setIsModalOpen(false);
      setFormData({});
      setSelectedEmpId('');
      fetchData();
    } catch (error) {
      toast.error("Failed to save record");
    }
  };

  const handleReturnAsset = async (asset: Asset) => {
    if (!confirm(`Mark "${asset.item_description}" as returned?`)) return;
    try {
      await invoke('return_asset', { id: asset.id, status: 'Returned' });
      toast.success("Asset marked as returned");
      fetchData();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleLostAsset = async (asset: Asset) => {
    if (!confirm(`Mark "${asset.item_description}" as lost/damaged? This will trigger a pending deduction.`)) return;
    try {
      await invoke('return_asset', { id: asset.id, status: 'Pending Deduction' });
      toast.success("Asset marked for deduction");
      fetchData();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const filteredAssets = assets.filter(a => 
    (a.emp_name || "").toLowerCase().includes((searchQuery || "").toLowerCase()) ||
    (a.emp_code || "").toLowerCase().includes((searchQuery || "").toLowerCase()) ||
    (a.item_description || "").toLowerCase().includes((searchQuery || "").toLowerCase())
  );

  const filteredDeposits = deposits.filter(d => 
    (d.emp_name || "").toLowerCase().includes((searchQuery || "").toLowerCase()) ||
    (d.emp_code || "").toLowerCase().includes((searchQuery || "").toLowerCase()) ||
    (d.description || "").toLowerCase().includes((searchQuery || "").toLowerCase())
  );

  const totalOutstandingDeposits = deposits
    .filter(d => d.status === 'Paid')
    .reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-app-border shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-primary-navy tracking-tight">Assets & Deposits Tracker</h2>
          <p className="text-text-muted text-sm font-medium">Manage employee hardware issuance and financial deposits</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input 
              type="text"
              placeholder="Search employee or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-50 border border-app-border rounded-lg text-sm focus:ring-2 focus:ring-primary-navy/20 outline-none w-64"
            />
          </div>
          <button 
            onClick={() => {
              setModalType(activeTab === 'assets' ? 'asset' : 'deposit');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-navy text-white rounded-lg font-bold text-sm hover:bg-primary-navy/90 transition-all shadow-lg shadow-primary-navy/20"
          >
            <Plus size={18} />
            New {activeTab === 'assets' ? 'Asset' : 'Deposit'}
          </button>
        </div>
      </div>

      {/* Tabs & Stats */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <div className="flex p-1 bg-slate-100 rounded-xl w-fit mb-6">
            <button 
              onClick={() => setActiveTab('assets')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'assets' ? 'bg-white text-primary-navy shadow-sm' : 'text-text-muted hover:text-primary-navy'}`}
            >
              <Package size={18} />
              Physical Assets
            </button>
            <button 
              onClick={() => setActiveTab('deposits')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'deposits' ? 'bg-white text-primary-navy shadow-sm' : 'text-text-muted hover:text-primary-navy'}`}
            >
              <Wallet size={18} />
              Financial Deposits
            </button>
          </div>

          {activeTab === 'assets' ? (
            <div className="bg-white rounded-xl border border-app-border shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-app-border">
                    <th className="p-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Employee</th>
                    <th className="p-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Item Details</th>
                    <th className="p-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Issue Date</th>
                    <th className="p-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Value</th>
                    <th className="p-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Status</th>
                    <th className="p-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {filteredAssets.map(asset => (
                    <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-primary-navy">{asset.emp_name}</div>
                        <div className="text-[10px] font-mono text-text-muted">{asset.emp_code}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-primary-navy">{asset.item_description}</div>
                        <div className="text-[10px] font-mono text-text-muted">SN: {asset.serial_number}</div>
                      </td>
                      <td className="p-4 text-center text-sm font-medium text-text-muted">
                        {asset.issue_date}
                      </td>
                      <td className="p-4 text-center font-mono font-bold text-primary-navy">
                        ₹{asset.value.toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${
                            asset.status === 'Issued' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            asset.status === 'Returned' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            'bg-red-50 text-red-600 border-red-100'
                          }`}>
                            {asset.status}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          {asset.status === 'Issued' && (
                            <>
                              <button 
                                onClick={() => handleReturnAsset(asset)}
                                className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all"
                                title="Mark Returned"
                              >
                                <Undo2 size={16} />
                              </button>
                              <button 
                                onClick={() => handleLostAsset(asset)}
                                className="p-2 bg-red-50 text-primary-red rounded-lg hover:bg-red-100 transition-all"
                                title="Mark Lost/Damaged"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                          {asset.status === 'Returned' && (
                            <CheckCircle2 size={18} className="text-emerald-500" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-app-border shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-app-border">
                    <th className="p-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Employee</th>
                    <th className="p-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Description</th>
                    <th className="p-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Payment Date</th>
                    <th className="p-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-right">Amount</th>
                    <th className="p-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {filteredDeposits.map(deposit => (
                    <tr key={deposit.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-primary-navy">{deposit.emp_name}</div>
                        <div className="text-[10px] font-mono text-text-muted">{deposit.emp_code}</div>
                      </td>
                      <td className="p-4 font-medium text-primary-navy">
                        {deposit.description}
                      </td>
                      <td className="p-4 text-center text-sm font-medium text-text-muted">
                        {deposit.payment_date}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-primary-navy">
                        ₹{deposit.amount.toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${
                            deposit.status === 'Paid' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            deposit.status === 'Refunded' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            'bg-slate-50 text-slate-600 border-slate-100'
                          }`}>
                            {deposit.status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar Stats */}
        <div className="w-full md:w-80 space-y-6">
          <div className="bg-primary-navy p-6 rounded-2xl text-white shadow-xl shadow-primary-navy/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <IndianRupee size={20} />
              </div>
              <h3 className="font-bold">Outstanding Deposits</h3>
            </div>
            <div className="text-3xl font-black mb-1">₹{totalOutstandingDeposits.toLocaleString()}</div>
            <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Total Refundable Amount</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-app-border shadow-sm">
            <h3 className="font-bold text-primary-navy mb-4 flex items-center gap-2">
              <History size={18} className="text-text-muted" />
              Quick Summary
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-text-muted">Active Assets</span>
                <span className="font-bold text-primary-navy">{assets.filter(a => a.status === 'Issued').length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-text-muted">Pending Returns</span>
                <span className="font-bold text-amber-600">{assets.filter(a => a.status === 'Issued').length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-text-muted">Lost/Damaged</span>
                <span className="font-bold text-primary-red">{assets.filter(a => a.status === 'Pending Deduction').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-primary-navy/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-app-border flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-black text-primary-navy uppercase tracking-tight">
                New {modalType === 'asset' ? 'Asset Issuance' : 'Deposit Payment'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-primary-navy">
                <ArrowLeftRight size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <EmployeeSearchSelect 
                  label="Select Employee"
                  required
                  employees={employees}
                  selectedIds={selectedEmpId ? [parseInt(selectedEmpId)] : []}
                  onChange={(ids) => setSelectedEmpId(ids[0]?.toString() || '')}
                  placeholder="Choose an employee..."
                />
              </div>

              {modalType === 'asset' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                      <Package size={12} /> Item Description
                    </label>
                    <input 
                      required
                      type="text"
                      placeholder="e.g. Laptop, Mobile, Toolset"
                      value={formData.item_description || ''}
                      onChange={(e) => setFormData({...formData, item_description: e.target.value})}
                      className="w-full p-2.5 bg-slate-50 border border-app-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-navy/10"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                        <Hash size={12} /> Serial Number
                      </label>
                      <input 
                        type="text"
                        value={formData.serial_number || ''}
                        onChange={(e) => setFormData({...formData, serial_number: e.target.value})}
                        className="w-full p-2.5 bg-slate-50 border border-app-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-navy/10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                        <IndianRupee size={12} /> Approx Value
                      </label>
                      <input 
                        required
                        type="number"
                        value={formData.value || ''}
                        onChange={(e) => setFormData({...formData, value: parseFloat(e.target.value)})}
                        className="w-full p-2.5 bg-slate-50 border border-app-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-navy/10"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                        <Calendar size={12} /> Issue Date
                      </label>
                      <input 
                        required
                        type="date"
                        value={formData.issue_date || ''}
                        onChange={(e) => setFormData({...formData, issue_date: e.target.value})}
                        className="w-full p-2.5 bg-slate-50 border border-app-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-navy/10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                        <Calendar size={12} /> Expected Return
                      </label>
                      <input 
                        type="date"
                        value={formData.expected_return_date || ''}
                        onChange={(e) => setFormData({...formData, expected_return_date: e.target.value})}
                        className="w-full p-2.5 bg-slate-50 border border-app-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-navy/10"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                      <Wallet size={12} /> Deposit Description
                    </label>
                    <input 
                      required
                      type="text"
                      placeholder="e.g. HRA Deposit, Security Deposit"
                      value={formData.description || ''}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full p-2.5 bg-slate-50 border border-app-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-navy/10"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                        <IndianRupee size={12} /> Amount
                      </label>
                      <input 
                        required
                        type="number"
                        value={formData.amount || ''}
                        onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
                        className="w-full p-2.5 bg-slate-50 border border-app-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-navy/10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                        <Calendar size={12} /> Payment Date
                      </label>
                      <input 
                        required
                        type="date"
                        value={formData.payment_date || ''}
                        onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                        className="w-full p-2.5 bg-slate-50 border border-app-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-navy/10"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-primary-navy rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-primary-navy text-white rounded-xl font-bold text-sm hover:bg-primary-navy/90 transition-all shadow-lg shadow-primary-navy/20"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
