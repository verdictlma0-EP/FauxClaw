#!/usr/bin/env node

import readline from 'readline';
import { loadConfig } from './config.js';
import { routeRequest } from './providers/index.js';
import { logger } from './utils/logger.js';
import { showBranding } from './utils/branding.js';

const config = loadConfig();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let conversationHistory = [];
let sessionId = `chat_${Date.now()}`;

function askQuestion() {
  rl.question('\n\x1b[36mYou:\x1b[0m ', async (input) => {
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log('\n Goodbye\n');
      rl.close();
      process.exit(0);
    }
    
    if (input.toLowerCase() === 'clear') {
      conversationHistory = [];
      console.log('\n Conversation cleared.\n');
      askQuestion();
      return;
    }
    
    if (input.toLowerCase() === 'status') {
      console.log(`\n Session: ${sessionId}`);
      console.log(` Messages: ${conversationHistory.length}`);
      console.log(` Providers: ${Object.keys(config).filter(k => config[k] && (config[k].apiKey || config[k].token)).join(', ')}\n`);
      askQuestion();
      return;
    }
    
    await sendMessage(input);
    askQuestion();
  });
}

async function sendMessage(userInput) {
  console.log('\n\x1b[32mFauxclaw:\x1b[0m ');
  
  conversationHistory.push({
    role: 'user',
    content: userInput
  });
  
  const requestBody = {
    model: 'claude-sonnet-4-5',
    messages: conversationHistory,
    stream: true,
    max_tokens: 4096
  };
  
  let fullResponse = '';
  let hasStreamed = false;
  
  try {
    const { response, format } = await routeRequest(config, requestBody, 'claude-sonnet-4-5', sessionId);
    
    if (format === 'binary') {
      // Handle Kiro binary stream
      const { streamKiroResponse } = await import('./providers/kiro.js');
      for await (const sse of streamKiroResponse(response, `msg_${Date.now()}`)) {
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
            } catch (e) {}
          }
        }
      }
    } else {
      // Handle SSE stream
      for await (const chunk of response) {
        const chunkStr = chunk.toString();
        const lines = chunkStr.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.choices?.[0]?.delta?.content) {
                process.stdout.write(data.choices[0].delta.content);
                fullResponse += data.choices[0].delta.content;
                hasStreamed = true;
              } else if (data.delta?.text) {
                process.stdout.write(data.delta.text);
                fullResponse += data.delta.text;
                hasStreamed = true;
              } else if (data.content?.[0]?.text) {
                process.stdout.write(data.content[0].text);
                fullResponse += data.content[0].text;
                hasStreamed = true;
              }
            } catch (e) {}
          }
        }
      }
    }
    
    if (!hasStreamed) {
      const data = await response.text();
      console.log(data);
    } else {
      console.log('\n');
    }
    
    if (fullResponse) {
      conversationHistory.push({
        role: 'assistant',
        content: fullResponse
      });
    }
    
    // Trim history if too long
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }
    
  } catch (err) {
    console.log(`\n Error: ${err.message}`);
  }
}

function start() {
  console.log(showBranding());
  console.log('\n\x1b[33m Commands: /exit, /clear, /status\x1b[0m\n');
  console.log('Starting chat session...\n');
  askQuestion();
}

// Check if providers are configured
const hasProviders = Object.keys(config).some(k => 
  k === 'kiro' || k === 'openrouter' || k === 'iflow' || 
  k === 'nvidia' || k === 'groq' || k === 'gemini' || 
  k === 'deepseek' || k === 'mistral'
);

if (!hasProviders) {
  console.log('\n No providers configured. Run: npx fauxclaw setup\n');
  process.exit(1);
}

start();
