import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingStateProps {
  message?: string;
  className?: string;
  fullScreen?: boolean;
}

export function LoadingState({ message = 'Loading...', className, fullScreen = false }: LoadingStateProps) {
  const content = (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
      <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
      <p className="text-sm font-medium text-gray-600 animate-pulse">{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white bg-opacity-90 flex items-center justify-center backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
}
