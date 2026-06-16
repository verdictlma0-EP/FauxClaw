#!/usr/bin/env node

import readline from 'readline';
import { loadConfig } from './config.js';
import { routeRequest } from './providers/index.js';
import { showChatHeader, showError, showInfo } from './utils/branding.js';

const config = loadConfig();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let conversationHistory = [];
let sessionId = `chat_${Date.now()}`;
let currentModel = 'claude-sonnet-4-5';

function askQuestion() {
  rl.question('\n\x1b[36mYou:\x1b[0m ', async (input) => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed === '/exit' || trimmed === '/quit') {
      console.log('\nGoodbye!\n');
      rl.close();
      process.exit(0);
    }
    if (trimmed === '/clear') {
      conversationHistory = [];
      console.log('\n[Cleared]\n');
      askQuestion();
      return;
    }
    if (trimmed === '/status') {
      console.log(`\nModel: ${currentModel}\nHistory: ${conversationHistory.length} messages\n`);
      askQuestion();
      return;
    }
    if (!input.trim()) {
      askQuestion();
      return;
    }
    await sendMessage(input);
    askQuestion();
  });
}

async function sendMessage(userInput) {
  process.stdout.write('\n\x1b[32mFauxclaw:\x1b[0m ');
  conversationHistory.push({ role: 'user', content: userInput });

  const requestBody = {
    model: currentModel,
    messages: conversationHistory,
    stream: true,
    max_tokens: 1024
  };

  try {
    const { response, format } = await routeRequest(config, requestBody, currentModel, sessionId);

    if (format === 'binary') {
      // Use streamKiroResponse properly
      const { streamKiroResponse } = await import('./providers/kiro.js');
      let hasStreamed = false;
      for await (const sse of streamKiroResponse(response, `msg_${Date.now()}`)) {
        const lines = sse.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.delta?.text) {
                process.stdout.write(data.delta.text);
                hasStreamed = true;
              }
            } catch (e) {}
          }
        }
      }
      if (!hasStreamed) {
        console.log('\n[No response content]');
      } else {
        console.log('\n');
      }
    } else {
      // Standard SSE or passthrough
      let hasStreamed = false;
      for await (const chunk of response) {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.delta?.text) {
                process.stdout.write(data.delta.text);
                hasStreamed = true;
              } else if (data.content?.[0]?.text) {
                process.stdout.write(data.content[0].text);
                hasStreamed = true;
              }
            } catch (e) {}
          }
        }
      }
      if (!hasStreamed) {
        console.log('\n[No response content]');
      } else {
        console.log('\n');
      }
    }
  } catch (err) {
    console.log(`\n[Error] ${err.message}`);
  }
}

function start() {
  console.log(showChatHeader());
  showInfo('Chat started. Type /exit to quit.\n');
  askQuestion();
}

const hasProviders = Object.keys(config).some(k => 
  k === 'kiro' || k === 'openrouter' || k === 'iflow' || 
  k === 'nvidia' || k === 'groq' || k === 'gemini' || 
  k === 'deepseek' || k === 'mistral' || k === 'ollama'
);

if (!hasProviders) {
  showError('No providers configured. Run: fxc setup');
  process.exit(1);
}

start();
