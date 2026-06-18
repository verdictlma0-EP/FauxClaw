export const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalLatency: 0,
  avgLatency: 0,
  providerStats: {
    kiro: { attempts: 0, successes: 0, failures: 0, avgLatency: 0 },
    openrouter: { attempts: 0, successes: 0, failures: 0, avgLatency: 0 },
    iflow: { attempts: 0, successes: 0, failures: 0, avgLatency: 0 },
    nvidia: { attempts: 0, successes: 0, failures: 0, avgLatency: 0 },
    groq: { attempts: 0, successes: 0, failures: 0, avgLatency: 0 },
    gemini: { attempts: 0, successes: 0, failures: 0, avgLatency: 0 },
    deepseek: { attempts: 0, successes: 0, failures: 0, avgLatency: 0 },
    mistral: { attempts: 0, successes: 0, failures: 0, avgLatency: 0 },
    ollama: { attempts: 0, successes: 0, failures: 0, avgLatency: 0 }
  },
  startTime: Date.now()
};

export function updateRequestMetrics(latency, statusCode) {
  metrics.totalRequests++;
  if (statusCode >= 200 && statusCode < 400) {
    metrics.successfulRequests++;
  } else {
    metrics.failedRequests++;
  }
  metrics.totalLatency += latency;
  metrics.avgLatency = metrics.totalLatency / metrics.totalRequests;
}

export function updateProviderMetrics(provider, success, latency) {
  const s = metrics.providerStats[provider];
  if (!s) return;
  s.attempts++;
  if (success) {
    s.successes++;
    const total = s.avgLatency * (s.successes - 1) + latency;
    s.avgLatency = total / s.successes;
  } else {
    s.failures++;
  }
}

export async function showMetrics() {
  // Query the running server's /metrics endpoint
  const port = process.env.FXC_PORT || '8083';
  try {
    const res = await fetch(`http://127.0.0.1:${port}/metrics`);
    if (!res.ok) throw new Error('Server not responding');
    const data = await res.json();
    console.log('\n📊 FAUXCLAW METRICS');
    console.log(`Requests: ${data.totalRequests} (ok: ${data.successfulRequests}, fail: ${data.failedRequests})`);
    console.log(`Avg latency: ${data.avgLatency.toFixed(0)}ms`);
    const uptime = Math.floor((Date.now() - (data.startTime || Date.now())) / 1000);
    console.log(`Uptime: ${uptime}s`);
    console.log('\nProvider breakdown:');
    for (const [name, s] of Object.entries(data.providerStats || {})) {
      console.log(`  ${name}: attempts=${s.attempts} ✅=${s.successes} ❌=${s.failures} avg=${s.avgLatency.toFixed(0)}ms`);
    }
  } catch (err) {
    console.log('\n❌ Cannot fetch metrics. Is the server running?');
    console.log(`   Start with: fxc start\n`);
  }
}
