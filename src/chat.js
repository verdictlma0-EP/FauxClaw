#!/usr/bin/env node

import readline from 'readline';
import { loadConfig } from './config.js';
import { routeRequest } from './providers/index.js';
import { showChatHeader, showError, showInfo } from './utils/branding.js';
// Correct imports:
import { streamOpenAIAsAnthropic } from './utils/streaming.js';
import { streamKiroResponse } from './providers/kiro.js';
import { streamOllamaResponse } from './providers/ollama.js';

const config = loadConfig();

let conversationHistory = [];
let sessionId = `chat_${Date.now()}`;
let currentModel = 'claude-sonnet-4-5';

export function startChat() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(showChatHeader());
  showInfo('Chat started. Type /exit to quit. Use /model <name> to switch models.\n');

  const ask = () => {
    rl.question('\n\x1b[36mYou:\x1b[0m ', async (input) => {
      const trimmed = input.trim();
      if (!trimmed) return ask();
      if (trimmed === '/exit' || trimmed === '/quit') {
        console.log('\nGoodbye!\n');
        rl.close();
        process.exit(0);
      }
      if (trimmed === '/clear') {
        conversationHistory = [];
        console.log('\n[Cleared]\n');
        return ask();
      }
      if (trimmed === '/status') {
        console.log(`\nModel: ${currentModel}\nHistory: ${conversationHistory.length} messages\n`);
        return ask();
      }
      if (trimmed.startsWith('/model ')) {
        const newModel = trimmed.slice(7).trim();
        if (newModel) {
          currentModel = newModel;
          console.log(`\n[Switched to model: ${currentModel}]\n`);
        }
        return ask();
      }
      await sendMessage(trimmed, rl, ask);
    });
  };

  ask();
}

async function sendMessage(userInput, rl, ask) {
  process.stdout.write('\n\x1b[32mFauxclaw:\x1b[0m ');
  conversationHistory.push({ role: 'user', content: userInput });

  const requestBody = {
    model: currentModel,
    messages: conversationHistory,
    stream: true,
    max_tokens: 4096
  };

  try {
    const result = await routeRequest(config, requestBody, currentModel, sessionId);
    const { response, format, requestId, provider } = result;
    let fullResponse = '';
    let hasStreamed = false;

    if (format === 'binary') {
      for await (const sse of streamKiroResponse(response, requestId, currentModel)) {
        const lines = sse.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.delta?.text) {
                process.stdout.write(data.delta.text);
                fullResponse += data.delta.text;
                hasStreamed = true;
              }
            } catch {}
          }
        }
      }
    } else if (format === 'ollama') {
      for await (const sse of streamOllamaResponse(response, requestId, currentModel)) {
        const lines = sse.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.delta?.text) {
                process.stdout.write(data.delta.text);
                fullResponse += data.delta.text;
                hasStreamed = true;
              }
            } catch {}
          }
        }
      }
    } else if (format === 'openai_sse') {
      for await (const sse of streamOpenAIAsAnthropic(response, requestId, currentModel)) {
        const lines = sse.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.delta?.text) {
                process.stdout.write(data.delta.text);
                fullResponse += data.delta.text;
                hasStreamed = true;
              }
            } catch {}
          }
        }
      }
    } else {
      // sse (Anthropic-shaped) passthrough
      let buffer = '';
      for await (const chunk of response) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.delta?.text) {
                process.stdout.write(data.delta.text);
                fullResponse += data.delta.text;
                hasStreamed = true;
              }
            } catch {}
          }
        }
      }
    }

    if (!hasStreamed) {
      console.log('\n[No response content]');
    } else {
      console.log('\n');
      if (fullResponse) {
        conversationHistory.push({ role: 'assistant', content: fullResponse });
      }
    }
  } catch (err) {
    console.log(`\n[Error] ${err.message}`);
    conversationHistory.pop();
  }
}
