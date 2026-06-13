import http from 'http';
import { URL } from 'url';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { routeRequest, getAvailableProviders } from './providers/index.js';
import { validateApiKey, rateLimit } from './utils/security.js';
import { logger } from './utils/logger.js';
import { metrics, updateRequestMetrics } from './utils/metrics.js';
import { sessionStore } from './session.js';
import { showStartup } from './utils/branding.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
let dashboardHtml = '';
try {
  dashboardHtml = readFileSync(join(__dirname, 'dashboard.html'), 'utf8');
} catch (err) {
  logger.warn('Dashboard HTML not found, dashboard endpoint disabled');
}

const PORT = parseInt(process.env.FXC_PORT || '8083');
const HOST = process.env.FXC_HOST || '127.0.0.1';
const MAX_CONCURRENT = parseInt(process.env.FXC_MAX_CONCURRENT || '50');

let activeRequests = 0;

export async function startServer(config) {
  console.log(showStartup(PORT, HOST, getAvailableProviders(config)));

  const server = http.createServer(async (req, res) => {
    // Basic overload protection
    if (activeRequests >= MAX_CONCURRENT) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Fauxclaw is busy scratching', retry_after: 5 }));
      return;
    }
    activeRequests++;
    const startTime = Date.now();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
      await handleRequest(req, res, config, clientIp, startTime);
    } catch (err) {
      logger.error('Request handler blew up:', err.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Fauxclaw fumbled', details: err.message }));
      }
    } finally {
      activeRequests--;
      updateRequestMetrics(Date.now() - startTime, res.statusCode);
    }
  });

  server.listen(PORT, HOST, () => {
    logger.info(`Fauxclaw scratching on http://${HOST}:${PORT}`);
    if (process.env.FXC_API_KEY) logger.info('API key auth is ON');
    if (process.env.FXC_RATE_LIMIT) logger.info(`Rate limit: ${process.env.FXC_RATE_LIMIT}/min`);
    if (dashboardHtml) logger.info(`Dashboard: http://${HOST}:${PORT}/dashboard`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is taken. Set FXC_PORT to something else.`);
    } else {
      console.error(`Server error: ${err.message}`);
    }
    process.exit(1);
  });
}

async function handleRequest(req, res, config, clientIp, startTime) {
  const url = new URL(req.url, `http://${HOST}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version, x-api-key, x-proxy-key, x-session-id');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Security
  if (!validateApiKey(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized', message: 'Invalid or missing API key' }));
    return;
  }
  if (!rateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
    res.end(JSON.stringify({ error: 'Rate limit exceeded. Slow down.' }));
    return;
  }

  // Health check
  if (url.pathname === '/' || url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'fauxclaw is scratching',
      version: '2.1.0',
      providers: getAvailableProviders(config),
      uptime: process.uptime(),
      active: activeRequests
    }));
    return;
  }

  // Web Dashboard
  if (url.pathname === '/dashboard' && dashboardHtml) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(dashboardHtml);
    return;
  }

  // Metrics endpoint
  if (process.env.FXC_METRICS !== 'false' && url.pathname === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metrics));
    return;
  }

  // /v1/models - Claude Code calls this on startup
  if (url.pathname === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      object: 'list',
      data: [
        { id: 'claude-sonnet-4-5-20250929', object: 'model', owned_by: 'fauxclaw-kiro' },
        { id: 'claude-haiku-4-5-20251001', object: 'model', owned_by: 'fauxclaw-kiro' },
        { id: 'claude-opus-4', object: 'model', owned_by: 'fauxclaw-openrouter' },
        { id: 'gpt-4o', object: 'model', owned_by: 'fauxclaw-openrouter' },
        { id: 'deepseek-r1', object: 'model', owned_by: 'fauxclaw-iflow' },
        { id: 'nvidia/nemotron-3-super-120b-a12b', object: 'model', owned_by: 'fauxclaw-nvidia' },
        { id: 'groq/llama-3.3-70b-versatile', object: 'model', owned_by: 'fauxclaw-groq' },
        { id: 'gemini/gemini-2.0-flash', object: 'model', owned_by: 'fauxclaw-gemini' },
        { id: 'deepseek/deepseek-chat', object: 'model', owned_by: 'fauxclaw-deepseek' },
        { id: 'mistral/mistral-small-latest', object: 'model', owned_by: 'fauxclaw-mistral' },
        { id: 'ollama/llama3.1', object: 'model', owned_by: 'fauxclaw-ollama' }
      ]
    }));
    return;
  }

  // Token counting - fake it
  if (url.pathname === '/v1/messages/count_tokens') {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ input_tokens: 1000 }));
    return;
  }

  // Main endpoint: /v1/messages
  if (url.pathname === '/v1/messages' && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON.' }));
      return;
    }

    const model = payload.model || 'claude-sonnet-4-5-20250929';
    const stream = payload.stream !== false;
    const sessionId = req.headers['x-session-id'] || null;

    logger.info(`${model} | msgs:${payload.messages?.length} | stream:${stream}`);

    try {
      const { response, requestId, format } = await routeRequest(config, payload, model, sessionId);

      if (!response.ok && response.statusCode) {
        const errText = await readStream(response);
        logger.error(`Upstream ${response.statusCode}: ${errText.slice(0, 200)}`);
        res.writeHead(response.statusCode, { 'Content-Type': 'application/json' });
        res.end(errText);
        return;
      }

      if (stream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });

        if (format === 'binary') {
          const { streamKiroResponse } = await import('./providers/kiro.js');
          for await (const sse of streamKiroResponse(response, requestId)) {
            res.write(sse);
          }
          res.end();
        } else if (format === 'ollama') {
          const { streamOllamaResponse } = await import('./providers/ollama.js');
          for await (const sse of streamOllamaResponse(response)) {
            res.write(sse);
          }
          res.end();
        } else if (format === 'openai_sse') {
          const { convertOpenAIToAnthropicSSE } = await import('./utils/streaming.js');
          let buffer = '';
          const MAX_BUFFER_SIZE = 5 * 1024 * 1024;
          let lastChunkTime = Date.now();
          const TIMEOUT_MS = 30000;
          
          for await (const chunk of response) {
            if (Date.now() - lastChunkTime > TIMEOUT_MS) {
              logger.warn('Stream timeout, breaking');
              break;
            }
            lastChunkTime = Date.now();
            
            buffer += chunk.toString();
            
            if (buffer.length > MAX_BUFFER_SIZE) {
              logger.warn('Buffer exceeded 5MB, truncating');
              buffer = buffer.slice(-MAX_BUFFER_SIZE);
            }
            
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                if (line.includes('[DONE]')) {
                  break;
                }
                const converted = convertOpenAIToAnthropicSSE(line.slice(6));
                if (converted) {
                  res.write(`event: content_block_delta\ndata: ${JSON.stringify(converted)}\n\n`);
                }
              }
            }
          }
          res.end();
        } else {
          let buffer = '';
          const MAX_BUFFER_SIZE = 5 * 1024 * 1024;
          let lastChunkTime = Date.now();
          const TIMEOUT_MS = 30000;
          
          for await (const chunk of response) {
            if (Date.now() - lastChunkTime > TIMEOUT_MS) {
              logger.warn('Stream timeout, breaking');
              break;
            }
            lastChunkTime = Date.now();
            
            buffer += chunk.toString();
            
            if (buffer.length > MAX_BUFFER_SIZE) {
              logger.warn('Buffer exceeded 5MB, truncating');
              buffer = buffer.slice(-MAX_BUFFER_SIZE);
            }
            
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              res.write(line + '\n');
            }
          }
          
          if (buffer) {
            res.write(buffer);
          }
          res.end();
        }
      } else {
        const data = await readStream(response);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      }
    } catch (err) {
      logger.error('Routing error:', err.message);
      res.writeHead(502);
      res.end(JSON.stringify({
        error: 'Fauxclaw proxy error',
        message: err.message
      }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found. Fauxclaw only speaks /v1/messages');
}

async function readStream(stream) {
  let data = '';
  for await (const chunk of stream) data += chunk;
  return data;
}
