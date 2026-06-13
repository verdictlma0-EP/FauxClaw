import { loadConfig, CONFIG_FILE } from './config.js';
import { getAvailableProviders } from './providers/index.js';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function runDoctor() {
  console.log('\n FAUXCLAW DOCTOR - System Diagnosis\n');
  
  let issues = 0;
  let fixes = 0;
  
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (major >= 18) {
    console.log(` Node.js version: ${nodeVersion} (OK)`);
  } else {
    console.log(` Node.js version: ${nodeVersion} (Need 18+, current: ${major})`);
    issues++;
    console.log(`   Fix: Install Node.js 18+ from https://nodejs.org`);
    fixes++;
  }
  
  if (fs.existsSync(CONFIG_FILE)) {
    const stats = fs.statSync(CONFIG_FILE);
    console.log(` Config file: ${CONFIG_FILE} (${(stats.size / 1024).toFixed(1)} KB)`);
    
    if (os.platform() !== 'win32') {
      const mode = stats.mode.toString(8);
      if (mode.slice(-3) === '600') {
        console.log(` Config permissions: ${mode.slice(-3)} (secure)`);
      } else {
        console.log(` Config permissions: ${mode.slice(-3)} (should be 600)`);
        issues++;
      }
    }
  } else {
    console.log(` Config file not found: ${CONFIG_FILE}`);
    issues++;
    console.log(`   Fix: Run 'fxc setup' to create config`);
    fixes++;
  }
  
  const config = loadConfig();
  const providers = getAvailableProviders(config);
  
  if (providers.length > 0) {
    console.log(`\n Configured providers: ${providers.join(', ')}`);
    
    for (const provider of providers) {
      process.stdout.write(`   Testing ${provider}... `);
      try {
        if (provider === 'kiro') {
          const { kiroGetToken } = await import('./providers/kiro.js');
          const token = await kiroGetToken(config);
          if (token) console.log(' OK');
          else throw new Error('No token');
        } else if (provider === 'ollama') {
          const baseUrl = config.ollama?.baseUrl || 'http://localhost:11434';
          const response = await fetch(`${baseUrl}/api/tags`);
          if (response.ok) console.log(' OK');
          else throw new Error('Not responding');
        } else {
          const hasKey = config[provider]?.apiKey || config[provider]?.token;
          if (hasKey) console.log(' OK');
          else throw new Error('No credentials');
        }
      } catch (err) {
        console.log(` FAILED - ${err.message}`);
        issues++;
      }
    }
  } else {
    console.log(` No providers configured`);
    issues++;
    console.log(`   Fix: Run 'fxc setup'`);
    fixes++;
  }
  
  const port = parseInt(process.env.FXC_PORT || '8083');
  try {
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    if (stdout) {
      console.log(` Port ${port} is in use`);
      issues++;
      console.log(`   Fix: Set FXC_PORT to different port`);
      fixes++;
    } else {
      console.log(` Port ${port} is available`);
    }
  } catch {
    console.log(` Port ${port} is available`);
  }
  
  if (config.ollama) {
    console.log(`\n Checking Ollama...`);
    const baseUrl = config.ollama.baseUrl || 'http://localhost:11434';
    try {
      const res = await fetch(`${baseUrl}/api/tags`);
      const data = await res.json();
      if (data.models && data.models.length > 0) {
        console.log(` Ollama running with models: ${data.models.map(m => m.name).join(', ')}`);
      } else {
        console.log(` Ollama running but no models found. Run: ollama pull llama3.1`);
        issues++;
      }
    } catch {
      console.log(` Ollama not reachable at ${baseUrl}`);
      issues++;
      console.log(`   Fix: Install Ollama from https://ollama.com and run 'ollama serve'`);
      fixes++;
    }
  }
  
  console.log(`\n Summary: ${issues} issues found, ${fixes} fixes suggested\n`);
  
  if (issues === 0) {
    console.log(' Your system is ready! Run \'fxc start\' or \'fxc chat\' to begin.\n');
  }
}
