import { ShieldOff } from 'lucide-react';

export function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-4">
      <div className="h-14 w-14 bg-red-50 rounded-full flex items-center justify-center mb-4">
        <ShieldOff className="h-7 w-7 text-red-400" />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Access Denied</h2>
      <p className="text-sm text-gray-500 max-w-xs">
        You don't have permission to view this page. Contact your administrator if you think this is a mistake.
      </p>
    </div>
  );
}
