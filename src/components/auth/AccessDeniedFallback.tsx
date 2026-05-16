import React from 'react';

export function AccessDeniedFallback({ message = "You lack the required permission to view this page." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center p-12 h-64">
      <div className="text-center space-y-4">
        <h3 className="text-2xl font-bold text-red-600">Access Denied</h3>
        <p className="text-gray-500">{message}</p>
      </div>
    </div>
  );
}
