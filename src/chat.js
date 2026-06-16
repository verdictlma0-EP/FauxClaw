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
let currentModel = 'claude-sonnet-4-5';
let currentProvider = null;

// Available models by provider (example mapping)
const availableModels = {
  kiro: ['claude-sonnet-4-5', 'claude-haiku-4-5'],
  openrouter: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4', 'gpt-4o', 'deepseek-r1'],
  iflow: ['deepseek-r1', 'qwen', 'llama'],
  nvidia: ['nemotron-3-super-120b-a12b', 'llama3', 'qwen'],
  groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b', 'gemma2-9b'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  deepseek: ['deepseek-chat', 'deepseek-coder'],
  mistral: ['mistral-small-latest', 'mistral-large-latest'],
  ollama: ['llama3.1', 'mistral', 'codellama']
};

function showHelp() {
  console.log(`
Available Commands:
  /exit, /quit     Exit the chat
  /clear           Clear conversation history
  /status          Show session info and configured providers
  /model           Show current model or list available models
  /model <name>    Switch to a different model
  /provider        Show current provider
  /help            Show this help message

Tips:
  - Just type your message and press Enter to chat
  - The AI will stream responses in real time
  - Conversation history is maintained until you use /clear
`);
}

function showModelHelp() {
  console.log(`\nCurrent model: ${currentModel}`);
  console.log('\nAvailable models by provider:');
  
  const providers = Object.keys(config).filter(k => 
    config[k] && (config[k].apiKey || config[k].token || config[k].accessToken || config[k].baseUrl)
  );
  
  for (const provider of providers) {
    const models = availableModels[provider] || ['default'];
    console.log(`  ${provider}: ${models.join(', ')}`);
  }
  console.log('\nUsage: /model <model-name>');
  console.log('Example: /model claude-sonnet-4-5\n');
}

async function askQuestion() {
  rl.question('\n\x1b[36mYou:\x1b[0m ', async (input) => {
    const trimmed = input.trim().toLowerCase();
    
    if (trimmed === '/exit' || trimmed === '/quit') {
      console.log('\nGoodbye! Fake it till you make it.\n');
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
        config[k] && (config[k].apiKey || config[k].token || config[k].accessToken || config[k].baseUrl)
      ).length;
      
      console.log(`\nSession: ${sessionId}`);
      console.log(`Messages in history: ${conversationHistory.length}`);
      console.log(`Configured providers: ${providerCount}`);
      console.log(`Current model: ${currentModel}`);
      console.log(`Current provider: ${currentProvider || 'auto (fallback chain)'}`);
      console.log(`Proxy: http://${process.env.FXC_HOST || '127.0.0.1'}:${process.env.FXC_PORT || '8083'}\n`);
      askQuestion();
      return;
    }
    
    if (trimmed === '/provider') {
      console.log(`\nCurrent model: ${currentModel}`);
      if (currentProvider) {
        console.log(`Routing to provider: ${currentProvider}\n`);
      } else {
        console.log('Provider will be auto-selected by fallback chain\n');
      }
      askQuestion();
      return;
    }
    
    if (trimmed.startsWith('/model')) {
      const parts = input.split(' ');
      if (parts.length === 1) {
        showModelHelp();
      } else {
        const newModel = parts[1];
        currentModel = newModel;
        currentProvider = null;
        showSuccess(`Model switched to: ${newModel}`);
      }
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
    model: currentModel,
    messages: conversationHistory,
    stream: true,
    max_tokens: 4096
  };
  
  let fullResponse = '';
  let hasStreamed = false;
  let buffer = '';
  let lastChunkTime = Date.now();
  const MAX_BUFFER_SIZE = 5 * 1024 * 1024;
  const TIMEOUT_MS = 30000;
  
  try {
    const { response, format, provider } = await routeRequest(config, requestBody, currentModel, sessionId);
    currentProvider = provider;
    
    if (format === 'binary') {
      // Kiro binary stream
      let streamHandler;
      try {
        const kiroModule = await import('./providers/kiro.js');
        streamHandler = kiroModule.streamKiroResponse;
        if (!streamHandler) {
          throw new Error('streamKiroResponse not found in kiro.js');
        }
      } catch (err) {
        console.log(`\n[Error] Could not load Kiro stream handler: ${err.message}`);
        console.log('Falling back to default handler...');
        hasStreamed = false; // will be handled by fallback
      }
      
      if (streamHandler) {
        for await (const sse of streamHandler(response, `msg_${Date.now()}`)) {
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
      }
    } else if (format === 'ollama') {
      const { streamOllamaResponse } = await import('./providers/ollama.js');
      for await (const sse of streamOllamaResponse(response)) {
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
    } else if (format === 'openai_sse') {
      const { convertOpenAIToAnthropicSSE } = await import('./utils/streaming.js');
      let sseBuffer = '';
      
      for await (const chunk of response) {
        if (Date.now() - lastChunkTime > TIMEOUT_MS) {
          console.log('\n[Warning] Stream timeout');
          break;
        }
        lastChunkTime = Date.now();
        
        sseBuffer += chunk.toString();
        
        if (sseBuffer.length > MAX_BUFFER_SIZE) {
          console.log('\n[Warning] Buffer limit reached, truncating');
          sseBuffer = sseBuffer.slice(-MAX_BUFFER_SIZE);
        }
        
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            if (line.includes('[DONE]')) {
              break;
            }
            const converted = convertOpenAIToAnthropicSSE(line.slice(6));
            if (converted && converted.delta?.text) {
              process.stdout.write(converted.delta.text);
              fullResponse += converted.delta.text;
              hasStreamed = true;
            }
          }
        }
      }
    } else {
      // Default SSE handler for Anthropic-compatible providers
      for await (const chunk of response) {
        if (Date.now() - lastChunkTime > TIMEOUT_MS) {
          console.log('\n[Warning] Stream timeout');
          break;
        }
        lastChunkTime = Date.now();
        
        buffer += chunk.toString();
        
        if (buffer.length > MAX_BUFFER_SIZE) {
          console.log('\n[Warning] Buffer limit reached, truncating');
          buffer = buffer.slice(-MAX_BUFFER_SIZE);
        }
        
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
    
    // Handle case where no content was streamed
    if (!hasStreamed) {
      // For binary streams or streams without .text method, just log a message
      if (typeof response.text !== 'function' || format === 'binary' || format === 'ollama' || format === 'openai_sse') {
        console.log('\n[No response content]');
      } else {
        try {
          const data = await response.text();
          if (data) {
            console.log(data);
          } else {
            console.log('[Empty response]');
          }
        } catch (e) {
          console.log('[Error reading response]');
        }
      }
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
    console.log(`\n[Error] ${err.message}`);
  }
}

function start() {
  console.log(showChatHeader());
  showHelp();
  showInfo(`Starting chat session with model: ${currentModel}\n`);
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
