import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  title?: string;
  fallbackMessage?: string;
  className?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[WidgetErrorBoundary] Crash in widget "${this.props.title || 'Unknown'}":`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      const widgetTitle = this.props.title || 'Section';
      const message = this.props.fallbackMessage || `Unable to display ${widgetTitle.toLowerCase()} due to a display error.`;

      return (
        <Card className={`border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden ${this.props.className || ''}`}>
          {this.props.title && (
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between border-b border-border/30">
              <CardTitle className="text-xs font-semibold text-muted-foreground">
                {widgetTitle}
              </CardTitle>
            </CardHeader>
          )}
          <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center text-center space-y-2.5 min-h-[140px]">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">{message}</p>
              {this.state.error && (
                <p className="text-[10px] font-mono text-muted-foreground line-clamp-2 max-w-xs">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              className="h-7 px-2.5 text-[11px] border-border hover:bg-secondary gap-1 mt-1"
            >
              <RotateCcw className="w-3 h-3" />
              Retry Widget
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
