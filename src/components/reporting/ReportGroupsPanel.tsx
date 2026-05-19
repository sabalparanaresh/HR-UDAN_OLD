import React, { useState } from 'react';
import { useReportingStore } from '../../store/reportingStore';
import { Search, Folder } from 'lucide-react';

import { getReportsByDataSource } from '../../reporting';

export function ReportGroupsPanel() {
  const { activeDataSource, activeReportGroup, setActiveReportGroup } = useReportingStore();
  const [searchTerm, setSearchTerm] = useState('');

  if (!activeDataSource) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/50 border-r min-w-[300px]">
        <p className="text-slate-400 text-sm">Select a data source to view groups</p>
      </div>
    );
  }

  // Get reports from the registry dynamically
  const reports = getReportsByDataSource(activeDataSource);
  
  // Aggregate into groups
  const groupMap = new Map<string, number>();
  reports.forEach(r => {
    groupMap.set(r.group, (groupMap.get(r.group) || 0) + 1);
  });

  const dynamicGroups = Array.from(groupMap.entries()).map(([name, count]) => ({
    id: name,
    name: name,
    count: count
  }));

  const groups = dynamicGroups.length > 0 ? dynamicGroups : [{ id: 'general', name: 'General Reports', count: 0 }];
  
  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col border-r bg-white min-w-[300px]">
      <div className="p-4 border-b">
        <h2 className="font-bold text-slate-800 mb-4">Report Groups</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search groups..."
            className="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4 content-start">
        {filteredGroups.map((group) => {
          const isActive = activeReportGroup === group.id;
          return (
            <div
              key={group.id}
              onClick={() => setActiveReportGroup(group.id)}
              className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                isActive ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10' : 'border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-md ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                  <Folder size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">{group.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{group.count} Reports</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
