// Kiro (AWS CodeWhisperer) provider.
// Reverse-engineered from 9router and free-claude-code.

import crypto from 'crypto';
import { nodeHttps, fetchJSON } from '../utils/http.js';
import { logger } from '../utils/logger.js';
import { extractText, detectLanguage } from '../utils/helpers.js';
import { loadConfig, saveConfig } from '../config.js';

const KIRO = {
  chatUrl: 'https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse',
  oidcBase: 'https://oidc.us-east-1.amazonaws.com',
  startUrl: 'https://view.awsapps.com/start',
  clientName: 'kiro-oauth-client',
  clientType: 'public',
  scopes: ['codewhisperer:completions', 'codewhisperer:analysis', 'codewhisperer:conversations'],
  grantTypes: ['urn:ietf:params:oauth:grant-type:device_code', 'refresh_token'],
  issuerUrl: 'https://identitycenter.amazonaws.com/ssoins-722374e8c3c8e6c6',
  modelMap: {
    'claude-sonnet-4-5': 'CLAUDE_SONNET_4_5',
    'claude-haiku-4-5': 'CLAUDE_HAIKU_4_5',
    'claude-sonnet-4-6': 'CLAUDE_SONNET_4_5',
    'claude-opus-4': 'CLAUDE_SONNET_4_5'
  }
};

export async function kiroRegisterClient() {
  return fetchJSON(`${KIRO.oidcBase}/client/register`, {
    method: 'POST',
    body: {
      clientName: KIRO.clientName,
      clientType: KIRO.clientType,
      scopes: KIRO.scopes,
      grantTypes: KIRO.grantTypes,
      issuerUrl: KIRO.issuerUrl
    }
  });
}

export async function kiroStartDeviceAuth(clientId, clientSecret) {
  return fetchJSON(`${KIRO.oidcBase}/device_authorization`, {
    method: 'POST',
    body: { clientId, clientSecret, startUrl: KIRO.startUrl, scopes: KIRO.scopes }
  });
}

export async function kiroPollToken(clientId, clientSecret, deviceCode, interval, maxAttempts = 120) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(interval * 1000);
    try {
      const res = await fetchJSON(`${KIRO.oidcBase}/token`, {
        method: 'POST',
        body: {
          clientId,
          clientSecret,
          deviceCode,
          grantType: 'urn:ietf:params:oauth:grant-type:device_code'
        }
      });
      if (res.accessToken) return res;
    } catch (err) {
      if (!err.message.includes('authorization_pending') && !err.message.includes('slow_down')) throw err;
      if (err.message.includes('slow_down')) await sleep(interval * 1000);
    }
  }
  throw new Error('Device authentication timed out after ' + maxAttempts + ' attempts');
}

export async function kiroRefreshToken(config) {
  const { clientId, clientSecret, refreshToken } = config.kiro || {};
  if (!refreshToken) return null;
  try {
    const res = await fetchJSON(`${KIRO.oidcBase}/token`, {
      method: 'POST',
      body: { clientId, clientSecret, refreshToken, grantType: 'refresh_token' }
    });
    if (res.accessToken) {
      config.kiro.accessToken = res.accessToken;
      if (res.refreshToken) config.kiro.refreshToken = res.refreshToken;
      config.kiro.expiresAt = Date.now() + (res.expiresIn || 3600) * 1000;
      saveConfig(config);
      logger.info('Kiro token auto-refreshed');
      return res.accessToken;
    }
  } catch (err) {
    logger.error('Kiro refresh failed:', err.message);
    delete config.kiro.accessToken;
    saveConfig(config);
  }
  return null;
}

export async function kiroGetToken(config) {
  const k = config.kiro;
  if (!k?.refreshToken) return null;
  if (k.expiresAt && Date.now() > k.expiresAt - 300000) {
    return await kiroRefreshToken(config);
  }
  return k.accessToken;
}

export async function kiroChat(accessToken, body, model, sessionId = null) {
  const kiroModel = KIRO.modelMap[model] || 'CLAUDE_SONNET_4_5';
  const messages = body.messages || [];
  const system = body.system;

  // Build conversation history
  const history = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const m = messages[i];
    if (m.role === 'user') {
      history.push({ userInputMessage: { content: extractText(m.content) } });
    } else if (m.role === 'assistant') {
      history.push({ assistantResponseMessage: { content: extractText(m.content) } });
    }
  }

  let userMsg = extractText(messages[messages.length - 1]?.content || '');
  if (system) userMsg = `[System: ${system}]\n\n${userMsg}`;

  const kiroBody = {
    conversationState: {
      conversationId: sessionId || crypto.randomUUID(),
      history,
      currentMessage: {
        userInputMessage: {
          content: userMsg,
          userInputMessageContext: {
            editorState: { document: { programmingLanguage: { languageName: detectLanguage(body) } } }
          }
        }
      }
    },
    profileArn: null,
    source: 'CHAT',
    dryRun: false
  };

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.amazon.eventstream',
    'Authorization': `Bearer ${accessToken}`,
    'X-Amz-Target': 'AmazonCodeWhispererStreamingService.GenerateAssistantResponse',
    'User-Agent': 'fauxclaw/2.2.0',
    'Amz-Sdk-Request': 'attempt=1; max=3',
    'Amz-Sdk-Invocation-Id': crypto.randomUUID()
  };

  const response = await nodeHttps(KIRO.chatUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(kiroBody),
    timeout: parseInt(process.env.FXC_TIMEOUT || '30000')
  });

  const requestId = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  return { response, requestId, format: 'binary' };
}

// Helper for SSE formatting
function formatSSE(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// The streaming function that was missing – exported as a generator
export async function* streamKiroResponse(response, requestId) {
  const stream = response.body || response;
  let buffer = Buffer.alloc(0);
  let inputTokens = 0;
  let outputTokens = 0;
  const startTime = Date.now();

  yield formatSSE('message_start', {
    type: 'message_start',
    message: {
      id: requestId,
      type: 'message',
      role: 'assistant',
      content: [],
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 }
    }
  });

  yield formatSSE('content_block_start', {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'text', text: '' }
  });

  yield formatSSE('ping', { type: 'ping' });

  for await (const chunk of stream) {
    if (Date.now() - startTime > parseInt(process.env.FXC_TIMEOUT || '30000')) {
      logger.warn('Kiro stream timeout');
      break;
    }

    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > parseInt(process.env.FXC_MAX_BUFFER || '5242880')) {
      logger.warn('Buffer exceeded limit, truncating');
      buffer = buffer.slice(-parseInt(process.env.FXC_MAX_BUFFER || '5242880'));
    }

    let processed = 0;
    while (buffer.length - processed >= 16) {
      const view = new DataView(buffer.buffer, buffer.byteOffset + processed, buffer.length - processed);
      const totalLength = view.getUint32(0, false);
      if (totalLength < 16 || totalLength > parseInt(process.env.FXC_MAX_BUFFER || '5242880')) {
        processed++;
        continue;
      }
      if (buffer.length - processed < totalLength) break;

      const { parseEventFrame } = await import('../utils/streaming.js');
      const frame = parseEventFrame(buffer.slice(processed, processed + totalLength));
      processed += totalLength;

      if (!frame) continue;

      const eventType = frame.headers[':event-type'] || '';

      if (eventType === 'assistantResponseEvent' && frame.payload?.content) {
        const text = frame.payload.content;
        outputTokens += Math.ceil(text.length / 4);
        yield formatSSE('content_block_delta', {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text }
        });
      }

      if (eventType === 'metricsEvent') {
        const m = frame.payload?.metricsEvent || frame.payload;
        if (m?.inputTokens) inputTokens = m.inputTokens;
        if (m?.outputTokens) outputTokens = m.outputTokens;
      }

      if (eventType === 'messageStopEvent') break;
    }

    if (processed > 0) buffer = buffer.slice(processed);
  }

  yield formatSSE('content_block_stop', { type: 'content_block_stop', index: 0 });
  yield formatSSE('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: { output_tokens: outputTokens }
  });
  yield formatSSE('message_stop', { type: 'message_stop' });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
