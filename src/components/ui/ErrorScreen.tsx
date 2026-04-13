import React from 'react';
import { AlertCircle, RefreshCw, Home, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface ErrorScreenProps {
  title?: string;
  message?: string;
  error?: any;
  onRetry?: () => void;
}

export function ErrorScreen({ 
  title = "Something went wrong", 
  message = "We encountered an unexpected error. Please try again or contact support if the problem persists.",
  error,
  onRetry 
}: ErrorScreenProps) {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 p-4 rounded-full">
            <AlertCircle className="h-12 w-12 text-red-600" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600 mb-8">{message}</p>

        {error && (
          <div className="bg-gray-50 rounded-lg p-4 mb-8 text-left overflow-auto max-h-32 border border-gray-200">
            <p className="text-xs font-mono text-gray-500 break-all">
              {typeof error === 'string' ? error : error.message || JSON.stringify(error)}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              <RefreshCw size={18} />
              Try Again
            </button>
          )}
          
          <button
            onClick={() => window.location.href = '/'}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
          >
            <Home size={18} />
            Back to Home
          </button>

          <button
            onClick={() => signOut()}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 text-red-600 font-medium hover:bg-red-50 rounded-xl transition-colors mt-2"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
      
      <p className="mt-8 text-sm text-gray-400">
        Debrios Logistics Platform &bull; Production v1.0.0
      </p>
    </div>
  );
}
