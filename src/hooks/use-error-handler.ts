import { useState, useEffect } from 'react';

/**
 * Hook to programmatically trigger error boundary from functional components
 * Useful for catching async errors that don't automatically trigger error boundaries
 * 
 * Usage:
 * const throwError = useErrorHandler();
 * try {
 *   await someAsyncOperation();
 * } catch (error) {
 *   throwError(error);
 * }
 */
export const useErrorHandler = () => {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return (error: Error | unknown) => {
    setError(error instanceof Error ? error : new Error(String(error)));
  };
};
