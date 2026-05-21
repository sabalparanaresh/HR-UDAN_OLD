import React, { useState, Suspense, lazy } from 'react';
import { Settings, Clock, ShieldAlert, Users, Calendar } from 'lucide-react';
import { useModule } from '../../contexts/ModuleContext';
import { User as UserType } from '../../types';

const DeviceSetupTab = lazy(() => import('./canteen/DeviceSetupTab'));
const MealPeriodSettingsTab = lazy(() => import('./canteen/MealPeriodSettingsTab'));
const RuleConfigurationTab = lazy(() => import('./canteen/RuleConfigurationTab'));
const EmployeeOverridesTab = lazy(() => import('./canteen/EmployeeOverridesTab'));
const RulePreviewTab = lazy(() => import('./canteen/RulePreviewTab'));

const CanteenSettings: React.FC<{ currentUser: UserType | null }> = ({ currentUser }) => {
  const { currentMode } = useModule();
  const [activeTab, setActiveTab] = useState('device');

  const tabs = [
    { id: 'device', label: 'Device Setup', icon: Settings },
    { id: 'periods', label: 'Meal Periods', icon: Clock },
    { id: 'rules', label: 'Rule Engine', icon: ShieldAlert },
    { id: 'overrides', label: 'Overrides', icon: Users },
    { id: 'preview', label: 'Preview/Simulate', icon: Calendar },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary-navy textile-header">Canteen Rules</h1>
          <p className="text-text-muted font-mono text-xs uppercase tracking-widest mt-1">Rule Engine // Devices // Overrides</p>
        </div>
      </div>

      <div className="flex space-x-1 border-b border-app-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 font-bold uppercase tracking-tight text-sm transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-b-2 border-primary-navy text-primary-navy bg-primary-navy/5'
                : 'text-text-muted hover:text-primary-navy hover:bg-slate-50'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[500px]">
        <Suspense fallback={
          <div className="flex items-center justify-center py-20 text-text-muted animate-pulse">
            Loading tab contents...
          </div>
        }>
          {activeTab === 'device' && <DeviceSetupTab />}
          {activeTab === 'periods' && <MealPeriodSettingsTab />}
          {activeTab === 'rules' && <RuleConfigurationTab />}
          {activeTab === 'overrides' && <EmployeeOverridesTab />}
          {activeTab === 'preview' && <RulePreviewTab />}
        </Suspense>
      </div>
    </div>
  );
};

export default CanteenSettings;
