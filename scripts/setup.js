// Setup wizard thing people keep making
// Walks you through Kiro (device auth), OpenRouter, and iFlow.

import readline from 'readline';
import { loadConfig, saveConfig } from '../src/config.js';
import { kiroRegisterClient, kiroStartDeviceAuth, kiroPollToken } from '../src/providers/kiro.js';

export async function setupWizard() {
  console.log('\n🦞 Welcome to Fauxclaw setup. \n');
  const config = loadConfig();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(resolve => rl.question(q, resolve));

  // ---- Kiro (free Claude) ----
  console.log('━━━ Kiro (AWS CodeWhisperer) – free Claude Sonnet 4.5 ━━━');
  const doKiro = (await ask('Set up Kiro? (Y/n): ')).toLowerCase() !== 'n';
  if (doKiro) {
    try {
      console.log('→ Registering OAuth client with AWS...');
      const { clientId, clientSecret } = await kiroRegisterClient();
      const auth = await kiroStartDeviceAuth(clientId, clientSecret);
      console.log(`\n Open this URL in your browser:\n\n  ${auth.verificationUriComplete}\n`);
      if (auth.userCode) console.log(`Enter code: ${auth.userCode}`);
      console.log('⏳ Waiting for you to authorize (this can take a minute)...');
      const tokens = await kiroPollToken(clientId, clientSecret, auth.deviceCode, auth.interval || 5);
      config.kiro = {
        clientId,
        clientSecret,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: Date.now() + (tokens.expiresIn || 3600) * 1000
      };
      saveConfig(config);
      console.log(' Kiro is ready. Free Claude, time to go be a vibecoder! n');
    } catch (err) {
      console.log(` Kiro setup failed: ${err.message}. You can try again later with your broke self.\n`);
    }
  }

  // ---- OpenRouter ----
  console.log('━━━ OpenRouter (free fallback) ━━━');
  const orKey = await ask('OpenRouter API key (https://openrouter.ai/keys) or Enter to skip: ');
  if (orKey.trim()) {
    config.openrouter = { apiKey: orKey.trim() };
    saveConfig(config);
    console.log('OpenRouter configured.\n');
  }

  // ---- iFlow ----
  console.log('━━━ iFlow (DeepSeek R1, Qwen, etc.) ━━━');
  const ifToken = await ask('iFlow token (https://iflow.cn) or Enter to skip: ');
  if (ifToken.trim()) {
    config.iflow = { token: ifToken.trim() };
    saveConfig(config);
    console.log('iFlow configured.\n');
  }

  rl.close();

  console.log('🎉 Setup complete! Start the proxy with:\n');
  console.log('  fxc start\n');
  console.log('Then point Claude Code:\n');
  console.log('  export ANTHROPIC_BASE_URL=http://localhost:8083');
  console.log('  export ANTHROPIC_API_KEY=anything   (or your FXC_API_KEY if set)');
  console.log('  claude\n');
}
