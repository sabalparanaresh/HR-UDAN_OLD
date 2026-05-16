import React, { useState } from 'react';
import { Settings, Calculator, X, Plus } from 'lucide-react';
import { CalculatedColumn } from '../../store/useReportStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  availableCols: string[];
  onSave: (calc: CalculatedColumn) => void;
}

const FORMULA_VARIABLES = [
  'IF', 'CHOOSE', 'MAX', 'MIN'
];

const FORMULA_OPERATORS = ['+', '-', '*', '/', '(', ')', ',', '>', '<', '==', '!='];

export function FormulaBuilderModal({ isOpen, onClose, availableCols, onSave }: Props) {
  const [name, setName] = useState('');
  const [field, setField] = useState('');
  const [formula, setFormula] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name || !field || !formula) return;
    onSave({ field, name, formula });
    setName('');
    setField('');
    setFormula('');
    onClose();
  };

  const addToFormula = (val: string) => {
    setFormula(prev => prev + (prev && !prev.endsWith(' ') && !val.startsWith(' ') ? ' ' : '') + val);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[70vh]">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Calculator size={16} /> Formula Builder
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Field Key (Internal) *</label>
              <input
                type="text"
                value={field}
                onChange={e => setField(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="e.g., net_bonus"
                className="w-full text-sm border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500 shadow-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Display Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Net Bonus Amount"
                className="w-full text-sm border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex justify-between">
              <span>Expression *</span>
              <button onClick={() => setFormula('')} className="text-blue-600 hover:text-blue-800 uppercase tracking-wider text-[9px]">Clear</button>
            </label>
            <textarea
              value={formula}
              onChange={e => setFormula(e.target.value)}
              rows={4}
              placeholder="e.g., gross_wage_amt + IF(actual_attendance > 20, 500, 0)"
              className="w-full text-sm border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500 shadow-sm font-mono resize-none p-3 bg-slate-50"
            />
          </div>

          <div className="space-y-3">
            <div>
               <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 border-b pb-1">Available Fields (Click to Insert)</h4>
               <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded border border-slate-200">
                 {availableCols.map(col => (
                   <button 
                     key={col} 
                     onClick={() => addToFormula(col)}
                     className="px-2 py-1 text-[10px] bg-white border border-slate-300 rounded hover:bg-blue-50 hover:border-blue-300 font-mono transition-colors text-slate-700"
                   >
                     {col}
                   </button>
                 ))}
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 border-b pb-1">Operators</h4>
                <div className="flex flex-wrap gap-1">
                  {FORMULA_OPERATORS.map(op => (
                    <button 
                      key={op} 
                      onClick={() => addToFormula(op)}
                      className="w-8 h-8 flex items-center justify-center text-[12px] bg-white border border-slate-300 rounded hover:bg-slate-100 font-mono font-bold"
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 border-b pb-1">Functions</h4>
                <div className="flex flex-wrap gap-2">
                  {FORMULA_VARIABLES.map(fn => (
                    <button 
                      key={fn} 
                      onClick={() => addToFormula(fn + '(')}
                      className="px-2 py-1 text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 rounded hover:bg-indigo-100 font-mono font-bold"
                    >
                      {fn}()
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
          <button 
            onClick={handleSave} 
            disabled={!name || !field || !formula}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus size={14} /> Add Column
          </button>
        </div>
      </div>
    </div>
  );
}
