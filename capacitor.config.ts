import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.savesmart.app',
  appName: 'SaveSmart',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
}

export default config
