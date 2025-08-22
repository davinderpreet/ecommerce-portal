export const createLogger = () => {
  const log = {
    info: (message: string, meta?: any) => {
      console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '');
    },
    error: (message: string, error?: any) => {
      console.error(`[ERROR] ${message}`, error);
    },
    warn: (message: string, meta?: any) => {
      console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  };
  return log;
};

// Export default logger instance
export default createLogger();
