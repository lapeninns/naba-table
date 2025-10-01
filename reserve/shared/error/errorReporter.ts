export interface ErrorReporter {
  capture: (error: unknown, context?: Record<string, unknown>) => void;
}

const formatContext = (context?: Record<string, unknown>) => {
  if (!context || Object.keys(context).length === 0) return undefined;
  return context;
};

export const defaultErrorReporter: ErrorReporter = {
  capture: (error, context) => {
    if (process.env.NODE_ENV !== 'production') {
      if (context) {
        console.error('[error]', formatContext(context), error);
      } else {
        console.error('[error]', error);
      }
    }
  },
};
