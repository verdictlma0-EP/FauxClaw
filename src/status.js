import { loadConfig } from './config.js';
import { getAvailableProviders } from './providers/index.js';
import { showStatusReport } from './utils/branding.js';

export async function showStatus() {
  const config = loadConfig();
  const providers = getAvailableProviders(config);

  // Build provider status objects
  const statusMap = {
    kiro: { name: 'Kiro', key: 'refreshToken' },
    openrouter: { name: 'OpenRouter', key: 'apiKey' },
    iflow: { name: 'iFlow', key: 'token' },
    nvidia: { name: 'NVIDIA NIM', key: 'apiKey' },
    groq: { name: 'Groq', key: 'apiKey' },
    gemini: { name: 'Gemini', key: 'apiKey' },
    deepseek: { name: 'DeepSeek', key: 'apiKey' },
    mistral: { name: 'Mistral', key: 'apiKey' },
    ollama: { name: 'Ollama', key: 'baseUrl' }
  };

  const providerStatus = {};
  for (const [id, info] of Object.entries(statusMap)) {
    const creds = config[id];
    const hasCreds = creds && creds[info.key];
    providerStatus[id] = {
      name: info.name,
      configured: !!hasCreds,
      active: hasCreds // we consider it "active" if credentials exist; full health check done by doctor
    };
  }

  // Query live metrics from the running server
  let stats = { totalRequests: 0, successRate: '0%', avgLatency: '0ms' };
  try {
    const res = await fetch(`http://127.0.0.1:${process.env.FXC_PORT || 8083}/metrics`);
    if (res.ok) {
      const data = await res.json();
      stats.totalRequests = data.totalRequests || 0;
      const successRate = data.totalRequests ? ((data.successfulRequests / data.totalRequests) * 100).toFixed(1) : 0;
      stats.successRate = successRate + '%';
      stats.avgLatency = (data.avgLatency || 0).toFixed(0) + 'ms';
    }
  } catch {}

  console.log(showStatusReport(providerStatus, providers, stats));
}
