// Simple colored logger
// Levels are debug, info, warn, and then error

const levelNames = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = process.env.FXC_LOG || 'info';

const colors = {
  debug: '\x1b[36m',   // cyan
  info:  '\x1b[32m',   // green
  warn:  '\x1b[33m',   // yellow
  error: '\x1b[31m',   // red
  reset: '\x1b[0m'
};

function timestamp() {
  return new Date().toISOString().slice(11, 23);
}

function log(level, ...args) {
  if (levelNames[level] >= levelNames[currentLevel]) {
    const color = colors[level] || colors.reset;
    const prefix = { debug: '🔍', info: '→', warn: '⚠️', error: '❌' }[level];
    console.error(`${color}${timestamp()} ${prefix}${colors.reset}`, ...args);
  }
}

export const logger = {
  debug: (...args) => log('debug', ...args),
  info:  (...args) => log('info', ...args),
  warn:  (...args) => log('warn', ...args),
  error: (...args) => log('error', ...args)
};
