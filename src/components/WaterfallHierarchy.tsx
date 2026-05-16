import React, { useMemo } from 'react';
import { Layers, Info, AlertTriangle, UserCircle, CheckCircle2, Calculator } from 'lucide-react';
import { motion } from 'motion/react';

interface WaterfallLog {
  child_id: number;
  pool_before: number;
  deduction: number;
  pool_after: number;
  month: string;
}

interface WaterfallHierarchyProps {
  parentEmployee: {
    id: number;
    emp_code: string;
    name: string;
    wage_amount: number;
  };
  children: {
    id: number;
    emp_code: string;
    name: string;
    wage_amount: number;
    salary_process_sequence: number;
  }[];
  logs: WaterfallLog[];
  totalPool: number;
  residual: number;
}

const WaterfallHierarchy: React.FC<WaterfallHierarchyProps> = ({ 
  parentEmployee, 
  children, 
  logs, 
  totalPool,
  residual 
}) => {
  const sortedChildren = useMemo(() => {
    return [...children].sort((a, b) => (a.salary_process_sequence || 0) - (b.salary_process_sequence || 0));
  }, [children]);

  const totalChildWageRate = useMemo(() => {
    return children.reduce((sum, c) => sum + (c.wage_amount || 0), 0);
  }, [children]);

  const residualWageRate = parentEmployee.wage_amount - totalChildWageRate;

  return (
    <div className="space-y-6">
      {/* Rate Summary Card */}
      <div className="bg-white border border-app-border rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary-navy/10 p-2 rounded-lg">
            <Calculator className="text-primary-navy" size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-primary-navy uppercase">Wage Rate Distribution Logic</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded border border-app-border">
                {parentEmployee.wage_amount} (Parent)
              </span>
              <span className="text-text-muted font-bold">-</span>
              <span className="text-sm font-mono bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                {totalChildWageRate} (Total Child Rate)
              </span>
              <span className="text-text-muted font-bold">=</span>
              <span className="text-sm font-mono bg-green-50 px-2 py-0.5 rounded border border-green-200 font-bold text-green-700">
                {residualWageRate} (Residue)
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-primary-navy/5 rounded-xl border border-primary-navy/10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-navy rounded-full flex items-center justify-center text-white shadow-lg">
            <Layers size={24} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-primary-navy uppercase tracking-wider">Operational Waterfall Source</h4>
            <p className="text-lg font-black text-primary-navy">{parentEmployee.emp_code} - {parentEmployee.name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-text-muted uppercase font-bold">Parent Base Rate</p>
          <p className="text-2xl font-black text-primary-navy">₹{parentEmployee.wage_amount.toLocaleString()}</p>
        </div>
      </div>

      <div className="relative pl-6 space-y-4">
        {/* Waterfall Path Line */}
        <div className="absolute left-[30px] top-0 bottom-0 w-1 bg-gradient-to-b from-primary-navy/20 via-primary-navy/40 to-primary-navy/10 rounded-full" />

        {sortedChildren.map((child, index) => {
          const log = logs.find(l => l.child_id === child.id);
          const isShortfall = log ? log.deduction < (child.wage_amount * 30) : false; // Dummy check

          return (
            <motion.div 
              key={child.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative flex items-center gap-4"
            >
              <div className="z-10 w-8 h-8 rounded-full bg-white border-4 border-primary-navy/30 flex items-center justify-center text-primary-navy shadow-sm">
                <span className="text-[10px] font-bold">{child.salary_process_sequence}</span>
              </div>
              
              <div className="flex-1 bg-white border border-app-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary-navy transform scale-y-0 group-hover:scale-y-100 transition-transform duration-300" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserCircle className="text-primary-navy/50" size={20} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-primary-navy">{child.emp_code} - {child.name}</p>
                        <span className="text-[9px] bg-primary-navy/5 text-primary-navy px-1.5 py-0.5 rounded font-bold border border-primary-navy/10">
                          SEQ: {child.salary_process_sequence}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted">Wage Rate: ₹{child.wage_amount.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[10px] text-text-muted uppercase font-bold">Wage Rate</p>
                      <p className="text-lg font-black text-primary-navy">
                        ₹{child.wage_amount.toLocaleString()}
                      </p>
                    </div>
                    {isShortfall && (
                      <div className="text-red-500 animate-pulse">
                        <AlertTriangle size={18} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Residual Node */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: sortedChildren.length * 0.1 }}
          className="relative pt-4 flex items-center gap-4"
        >
          <div className="z-10 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg">
            <CheckCircle2 size={16} />
          </div>
          <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-green-800 uppercase tracking-tighter">Residual Net Earner (Parent)</p>
                <p className="text-sm font-black text-green-900">{parentEmployee.name}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-green-700 uppercase font-bold">Residual Wage Rate</p>
                <p className="text-2xl font-black text-green-600">₹{residualWageRate.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex gap-3">
        <Info className="text-orange-500 shrink-0" size={20} />
        <p className="text-xs text-orange-700 leading-relaxed">
          <strong>Wage Rate Audit:</strong> This view visualizes the rate-based breakdown of the primary operational wage. 
          The parent employee (Net Earner) is assigned the remaining wage rate after all assigned children satisfy their specific wage rates in processing order.
        </p>
      </div>
    </div>
  );
};

export default WaterfallHierarchy;
