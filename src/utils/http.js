// Minimal HTTP helpers for Node.js
// Just built‑in https, nothing else

import https from 'https';
import { URL } from 'url';

export function nodeHttps(url, { method = 'POST', headers = {}, body, timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method,
      headers,
      timeout
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

    const req = https.request(options, (res) => {
      res.ok = res.statusCode >= 200 && res.statusCode < 300;
      res.statusCode = res.statusCode;
      resolve(res);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (body) req.write(body);
    req.end();
  });
}

export function fetchJSON(url, { method = 'POST', body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const bodyStr = body ? JSON.stringify(body) : undefined;
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(json.error || json.message || `HTTP ${res.statusCode}`));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error('Invalid JSON from upstream'));
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}
