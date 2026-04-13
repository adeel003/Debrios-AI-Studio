import React from 'react';
import { Download, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

interface ExportButtonProps {
  data: any[];
  filename: string;
  label?: string;
}

export function ExportButton({ data, filename, label = 'Export CSV' }: ExportButtonProps) {
  const [exporting, setExporting] = React.useState(false);

  const handleExport = () => {
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }

    setExporting(true);
    try {
      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Export successful');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
    >
      {exporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {label}
    </button>
  );
}
