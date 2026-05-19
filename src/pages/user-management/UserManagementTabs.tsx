import React, { useState, Suspense } from 'react';
import { ShieldCheck, Users as UsersIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const UserList = React.lazy(() => import('./UserList'));
const RolesPermissions = React.lazy(() => import('./RolesPermissions'));

export default function UserManagementGateway() {
  const [activeTab, setActiveTab] = useState('users');

  const tabs = [
    { id: 'users', label: 'Users', icon: <UsersIcon size={16} /> },
    { id: 'roles', label: 'Roles & Permissions', icon: <ShieldCheck size={16} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors duration-200 ${
                  activeTab === tab.id 
                  ? 'border-indigo-600 text-indigo-700 font-semibold flex-1 md:flex-none justify-center' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
        ))}
      </div>
      <div>
        <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400" /></div>}>
          <div className={activeTab === 'users' ? 'block' : 'hidden'}>
            <UserList />
          </div>
          <div className={activeTab === 'roles' ? 'block' : 'hidden'}>
            <RolesPermissions />
          </div>
        </Suspense>
      </div>
    </div>
  );
}
