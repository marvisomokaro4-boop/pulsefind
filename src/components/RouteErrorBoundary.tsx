import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Route-level error boundary for catching errors in individual pages
 * This prevents a single page error from crashing the entire app
 */
export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Route error caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  handleGoBack = () => {
    window.history.back();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto px-4 py-12">
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Page Error</AlertTitle>
            <AlertDescription className="mt-2 space-y-4">
              <p>This page encountered an error and couldn't load properly.</p>
              {this.state.error && (
                <p className="text-sm font-mono bg-background/50 p-2 rounded">
                  {this.state.error.message}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Button onClick={this.handleReset} size="sm" className="gap-2">
                  <RefreshCw className="h-3 w-3" />
                  Try Again
                </Button>
                <Button onClick={this.handleGoBack} variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-3 w-3" />
                  Go Back
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
