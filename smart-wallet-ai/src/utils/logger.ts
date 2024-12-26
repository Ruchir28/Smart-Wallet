import * as fs from 'fs';
import * as path from 'path';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

export interface LogData {
  tool: string;
  action: string;
  input?: any;
  output?: any;
  error?: any;
}

const writeLog = (filename: string, data: LogData) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...data
  };

  const logPath = path.join(logsDir, filename);
  fs.appendFileSync(
    logPath,
    JSON.stringify(logEntry) + '\n',
    'utf8'
  );

  // Also log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${logEntry.timestamp}] ${logEntry.tool} - ${logEntry.action}:`, 
      JSON.stringify(data, null, 2)
    );
  }
};

export const logToolAction = (data: LogData) => {
  writeLog('tools.log', data);
};

export const logToolError = (data: LogData) => {
  writeLog('error.log', data);
  // Also log errors to console regardless of environment
  console.error(`[${new Date().toISOString()}] Error in ${data.tool}:`, data.error);
};

export default {
  logToolAction,
  logToolError
}; 