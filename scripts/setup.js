#!/usr/bin/env node
import readline from 'readline';
import { loadConfig, saveConfig } from '../src/config.js';
import { kiroRegisterClient, kiroStartDeviceAuth, kiroPollToken } from '../src/providers/kiro.js';

export async function setupWizard() {
  console.log('\n Welcome to Fauxclaw setup – the claw that scratches for free.\n');
  const config = loadConfig();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(resolve => rl.question(q, resolve));

  console.log('━━━ Kiro (AWS CodeWhisperer) – free Claude Sonnet 4.5 ━━━');
  const doKiro = (await ask('Set up Kiro? (Y/n): ')).toLowerCase() !== 'n';
  if (doKiro) {
    try {
      console.log('→ Registering OAuth client with AWS...');
      const { clientId, clientSecret } = await kiroRegisterClient();
      const auth = await kiroStartDeviceAuth(clientId, clientSecret);
      console.log(`\n Open this URL in your browser:\n\n  ${auth.verificationUriComplete}\n`);
      if (auth.userCode) console.log(` Enter code: ${auth.userCode}\n`);
      console.log(' Waiting for you to authorize (this can take a minute)...');
      const tokens = await kiroPollToken(clientId, clientSecret, auth.deviceCode, auth.interval || 5);
      config.kiro = {
        clientId,
        clientSecret,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: Date.now() + (tokens.expiresIn || 3600) * 1000
      };
      saveConfig(config);
      console.log(' Kiro is ready. Free Claude, no bill.\n');
    } catch (err) {
      console.log(` Kiro setup failed: ${err.message}. You can try again later.\n`);
    }
  }

  console.log('━━━ OpenRouter (free fallback) ━━━');
  const orKey = await ask('OpenRouter API key (https://openrouter.ai/keys) or Enter to skip: ');
  if (orKey.trim()) {
    config.openrouter = { apiKey: orKey.trim() };
    saveConfig(config);
    console.log(' OpenRouter configured.\n');
  }

  console.log('━━━ iFlow (DeepSeek R1, Qwen, etc.) ━━━');
  const ifToken = await ask('iFlow token (https://iflow.cn) or Enter to skip: ');
  if (ifToken.trim()) {
    config.iflow = { token: ifToken.trim() };
    saveConfig(config);
    console.log(' iFlow configured.\n');
  }

  console.log('━━━ NVIDIA NIM (free 40 requests/min) ━━━');
  const nvidiaKey = await ask('NVIDIA NIM API key (https://build.nvidia.com) or Enter to skip: ');
  if (nvidiaKey.trim()) {
    config.nvidia = { apiKey: nvidiaKey.trim() };
    saveConfig(config);
    console.log(' NVIDIA NIM configured.\n');
  }

  console.log('━━━ Groq (fast free tier) ━━━');
  const groqKey = await ask('Groq API key (https://console.groq.com/keys) or Enter to skip: ');
  if (groqKey.trim()) {
    config.groq = { apiKey: groqKey.trim() };
    saveConfig(config);
    console.log(' Groq configured.\n');
  }

  console.log('━━━ Google Gemini (free tier) ━━━');
  const geminiKey = await ask('Gemini API key (https://aistudio.google.com/apikey) or Enter to skip: ');
  if (geminiKey.trim()) {
    config.gemini = { apiKey: geminiKey.trim() };
    saveConfig(config);
    console.log(' Gemini configured.\n');
  }

  console.log('━━━ DeepSeek (Anthropic-compatible API) ━━━');
  const deepseekKey = await ask('DeepSeek API key (https://platform.deepseek.com) or Enter to skip: ');
  if (deepseekKey.trim()) {
    config.deepseek = { apiKey: deepseekKey.trim() };
    saveConfig(config);
    console.log(' DeepSeek configured.\n');
  }

  console.log('━━━ Mistral (OpenAI-compatible API) ━━━');
  const mistralKey = await ask('Mistral API key (https://console.mistral.ai) or Enter to skip: ');
  if (mistralKey.trim()) {
    config.mistral = { apiKey: mistralKey.trim() };
    saveConfig(config);
    console.log(' Mistral configured.\n');
  }

  console.log('━━━ Ollama (local free models) ━━━');
  console.log('   Install Ollama from https://ollama.com then pull a model: ollama pull llama3.1');
  const ollamaUrl = await ask('Ollama base URL (http://localhost:11434) or Enter to skip: ');
  if (ollamaUrl.trim()) {
    config.ollama = { baseUrl: ollamaUrl.trim() };
    saveConfig(config);
    console.log(' Ollama configured.\n');
  }

  rl.close();

  console.log(' Setup complete! Start the proxy with:\n');
  console.log('  fxc start\n');
  console.log('Or try the interactive chat:\n');
  console.log('  fxc chat\n');
  console.log('Then point Claude Code:\n');
  console.log('  export ANTHROPIC_BASE_URL=http://localhost:8083');
  console.log('  export ANTHROPIC_API_KEY=anything');
  console.log('  claude\n');
}
