import React from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';

export function ConfigError() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-amber-100 p-3 rounded-full">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Configuration Required
        </h1>
        
        <p className="text-gray-600 mb-8 leading-relaxed">
          Debrios is almost ready. To connect to your backend, you need to provide your Supabase credentials in the environment variables.
        </p>

        <div className="space-y-4 bg-gray-50 p-4 rounded-lg text-left mb-8">
          <div className="flex items-start space-x-3">
            <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">1</div>
            <div>
              <p className="text-sm font-medium text-gray-900">Get your API keys</p>
              <p className="text-xs text-gray-500">Go to Supabase Dashboard &gt; Settings &gt; API</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">2</div>
            <div>
              <p className="text-sm font-medium text-gray-900">Set environment variables</p>
              <p className="text-xs text-gray-500">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your secrets.</p>
            </div>
          </div>
        </div>

        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          Open Supabase Dashboard
          <ExternalLink className="ml-2 h-4 w-4" />
        </a>
        
        <p className="mt-6 text-xs text-gray-400 italic">
          After adding the secrets, please restart the development server or refresh the page.
        </p>
      </div>
    </div>
  );
}
