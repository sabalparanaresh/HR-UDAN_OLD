import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  className
}) => {
  if (totalRecords === 0) return null;

  const startRecord = Number.isNaN(currentPage) || Number.isNaN(pageSize) ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Number.isNaN(currentPage) || Number.isNaN(pageSize) || Number.isNaN(totalRecords) ? 0 : Math.min(currentPage * pageSize, totalRecords);

  const safeCurrentPage = Number.isNaN(currentPage) ? 1 : currentPage;
  const safeTotalPages = Number.isNaN(totalPages) ? 1 : totalPages;
  const safeTotalRecords = Number.isNaN(totalRecords) ? 0 : totalRecords;


  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-slate-50 border-t border-app-border gap-4", className)}>
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6">
        <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
          Showing <span className="text-primary-navy font-black">{startRecord}</span> to <span className="text-primary-navy font-black">{endRecord}</span> of <span className="text-primary-navy font-black">{safeTotalRecords}</span> records
        </p>
        <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider border-l border-app-border pl-6 hidden sm:block">
          Page <span className="text-primary-navy font-black">{safeCurrentPage}</span> of <span className="text-primary-navy font-black">{safeTotalPages || 1}</span>
        </p>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage === 1}
          className="p-1.5 rounded-md border border-app-border bg-white text-primary-navy hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
          title="First Page"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          className="p-1.5 rounded-md border border-app-border bg-white text-primary-navy hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
          title="Previous Page"
        >
          <ChevronLeft size={16} />
        </button>
        
        <div className="flex items-center gap-1 px-2">
          {Array.from({ length: Math.min(5, safeTotalPages) }, (_, i) => {
            let pageNum: number;
            if (safeTotalPages <= 5) {
              pageNum = i + 1;
            } else if (safeCurrentPage <= 3) {
              pageNum = i + 1;
            } else if (safeCurrentPage >= safeTotalPages - 2) {
              pageNum = safeTotalPages - 4 + i;
            } else {
              pageNum = safeCurrentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-md text-[11px] font-bold transition-all border shadow-sm",
                  safeCurrentPage === pageNum 
                    ? "bg-primary-navy text-white border-primary-navy" 
                    : "bg-white text-primary-navy border-app-border hover:bg-slate-50"
                )}
              >
                {Number.isNaN(pageNum) ? '-' : pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage === safeTotalPages || safeTotalPages === 0}
          className="p-1.5 rounded-md border border-app-border bg-white text-primary-navy hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
          title="Next Page"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => onPageChange(safeTotalPages)}
          disabled={safeCurrentPage === safeTotalPages || safeTotalPages === 0}
          className="p-1.5 rounded-md border border-app-border bg-white text-primary-navy hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
          title="Last Page"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};
