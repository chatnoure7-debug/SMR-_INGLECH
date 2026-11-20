import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'es.smrenglish.app',
  appName: 'SMR English',
  webDir: 'dist',
  android: { backgroundColor: '#0b1020' },
  // Las llamadas fetch pasan por el código nativo (sin problemas de CORS) para el tutor de IA.
  plugins: { CapacitorHttp: { enabled: true } },
};

export default config;
