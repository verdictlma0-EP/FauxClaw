// Simple in‑memory metrics. Restarting the server resets them, really cool

export const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalLatency: 0,
  avgLatency: 0,
  providerStats: {
    kiro: { attempts: 0, successes: 0, failures: 0, avgLatency: 0 },
    openrouter: { attempts: 0, successes: 0, failures: 0, avgLatency: 0 },
    iflow: { attempts: 0, successes: 0, failures: 0, avgLatency: 0 }
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

export function showMetrics() {
  const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
  console.log('\n FAUXCLAW METRICS');
  console.log(`Requests: ${metrics.totalRequests} (ok: ${metrics.successfulRequests}, fail: ${metrics.failedRequests})`);
  console.log(`Avg latency: ${metrics.avgLatency.toFixed(0)}ms`);
  console.log(`Uptime: ${uptime}s`);
  console.log('\nProvider breakdown:');
  for (const [name, s] of Object.entries(metrics.providerStats)) {
    console.log(`  ${name}: attempts=${s.attempts} ✅=${s.successes} ❌=${s.failures} avg=${s.avgLatency.toFixed(0)}ms`);
  }
}
