import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary] Uncaught component crash:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleHardReload = () => {
    try {
      sessionStorage.clear();
    } catch {
      // Ignore
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 sm:p-8 text-center shadow-xl space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Something went wrong</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                An unexpected runtime error occurred. We have isolated the issue to prevent data corruption.
              </p>
              {this.state.error && (
                <div className="mt-3 p-3 bg-secondary/50 rounded-xl text-left border border-border/60 overflow-hidden">
                  <p className="text-[11px] font-mono text-destructive break-all line-clamp-3">
                    {this.state.error.message || String(this.state.error)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <Button
                variant="default"
                size="sm"
                onClick={this.handleReset}
                className="w-full sm:w-auto gap-1.5 text-xs h-9"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Try Again
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleHardReload}
                className="w-full sm:w-auto gap-1.5 text-xs h-9 border-border hover:bg-secondary"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Page
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { window.location.href = '/'; }}
                className="w-full sm:w-auto gap-1.5 text-xs h-9 text-muted-foreground hover:text-foreground"
              >
                <Home className="w-3.5 h-3.5" />
                Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
