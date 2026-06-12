// Config lives in ~/.fauxclaw/config.json rent free
// I lwk woulda used dotenv but someone who knows who they are decided to claim i could not use anything other than dotenv, so setup writes directly to json here ;P

import fs from 'fs';
import path from 'path';
import os from 'os';

export const CONFIG_DIR = path.join(os.homedir(), '.fauxclaw');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Config load error:', err.message);
  }
  return {};
}

export function saveConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    // 0600 obviously because it contains tokens
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
    return true;
  } catch (err) {
    console.error('Failed to save config:', err.message);
    return false;
  }
}
