#!/usr/bin/env node

import readline from 'readline';
import { loadConfig } from './config.js';
import { routeRequest } from './providers/index.js';
import { showChatHeader, showError, showSuccess, showInfo } from './utils/branding.js';

const config = loadConfig();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let conversationHistory = [];
let sessionId = `chat_${Date.now()}`;

function showHelp() {
  console.log(`
\x1b[33mAvailable Commands:\x1b[0m
  /exit, /quit     Exit the chat
  /clear           Clear conversation history
  /status          Show session info and configured providers
  /help            Show this help message

\x1b[36mTips:\x1b[0m
  - Just type your message and press Enter to chat
  - The AI will stream responses in real time
  - Conversation history is maintained until you use /clear
`);
}

function askQuestion() {
  rl.question('\n\x1b[36mYou:\x1b[0m ', async (input) => {
    const trimmed = input.trim().toLowerCase();
    
    if (trimmed === '/exit' || trimmed === '/quit') {
      console.log('\n Goodbye \n');
      rl.close();
      process.exit(0);
    }
    
    if (trimmed === '/clear') {
      conversationHistory = [];
      showSuccess('Conversation cleared.');
      askQuestion();
      return;
    }
    
    if (trimmed === '/status') {
      const providerCount = Object.keys(config).filter(k => 
        config[k] && (config[k].apiKey || config[k].token || config[k].accessToken)
      ).length;
      
      console.log(`\n Session: ${sessionId}`);
      console.log(` Messages in history: ${conversationHistory.length}`);
      console.log(` Configured providers: ${providerCount}`);
      console.log(` Proxy: http://${process.env.FXC_HOST || '127.0.0.1'}:${process.env.FXC_PORT || '8083'}\n`);
      askQuestion();
      return;
    }
    
    if (trimmed === '/help') {
      showHelp();
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
    
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }
    
  } catch (err) {
    console.log(`\n Error: ${err.message}`);
  }
}

function start() {
  console.log(showChatHeader());
  showHelp();
  showInfo('Starting chat session...\n');
  askQuestion();
}

const hasProviders = Object.keys(config).some(k => 
  k === 'kiro' || k === 'openrouter' || k === 'iflow' || 
  k === 'nvidia' || k === 'groq' || k === 'gemini' || 
  k === 'deepseek' || k === 'mistral'
);

if (!hasProviders) {
  showError('No providers configured. Run: npx fauxclaw setup');
  process.exit(1);
}

start();
