import React, { ErrorInfo } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { ErrorScreen } from './ui/ErrorScreen';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <ErrorScreen 
          title="Something went wrong"
          message="An unexpected error occurred. We've been notified and are looking into it."
          onRetry={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}
