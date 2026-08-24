import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.grupopixel.pandanet',
  appName: 'PandaNet',
  webDir: 'dist',
  server: {
    url: 'https://pandanet.grupopixel.com.br',
    cleartext: true
  }
};

export default config;
