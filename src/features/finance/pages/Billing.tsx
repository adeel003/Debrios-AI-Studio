import React, { useEffect, useState } from 'react';
import { feeService } from '../../../services/fee.service';
import { useAuth } from '../../../contexts/AuthContext';
import { Database } from '../../../types/database';
import { CreditCard, TrendingUp, AlertCircle } from 'lucide-react';
import { formatCurrency, cn } from '../../../lib/utils';
import { format } from 'date-fns';
import { handleError } from '../../../lib/error-handler';

type PlatformFee = Database['public']['Tables']['platform_fees']['Row'];

export function Billing() {
  const { profile, appReady } = useAuth();
  const [fees, setFees] = useState<PlatformFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFees = async () => {
      if (!appReady || !profile?.tenant_id) return;

      try {
        setLoading(true);
        const data = await feeService.getTenantFees(profile.tenant_id);
        setFees(data);
      } catch (err: any) {
        handleError(err, 'Fees:fetchFees');
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchFees();
  }, [profile?.tenant_id, appReady]);

  const totalFees = fees.reduce((acc, f) => acc + f.fee_amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Fees</h1>
          <p className="text-gray-500">Overview of transaction fees and revenue share.</p>
        </div>
        <div className="bg-blue-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center">
          <TrendingUp className="h-5 w-5 mr-3" />
          <div>
            <p className="text-xs text-blue-100 uppercase font-bold tracking-wider">Total Fees Collected</p>
            <p className="text-xl font-bold">{formatCurrency(totalFees)}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Load Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fee Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fee Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {fees.map((fee) => (
                <tr key={fee.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(fee.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(fee.load_value, fee.currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(fee.fee_rate * 100).toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                    {formatCurrency(fee.fee_amount, fee.currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
                      fee.status === 'settled' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    )}>
                      {fee.status}
                    </span>
                  </td>
                </tr>
              ))}
              {fees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    No platform fees recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
