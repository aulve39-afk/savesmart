import type { CapacitorConfig } from '@capacitor/cli'
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard'

const config: CapacitorConfig = {
  appId: 'com.klyp.app',
  appName: 'KLYP',
  webDir: 'out',

  server: {
    androidScheme: 'https',
    // Point to the Vercel deployment for API calls in native builds
    // (Next.js API routes aren't available in static export)
    // Uncomment and set your URL when building for stores:
    // url: 'https://your-app.vercel.app',
    // cleartext: false,
  },

  plugins: {
    StatusBar: {
      style: 'DEFAULT',
      backgroundColor: '#ffffff',
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false,
      launchFadeOutDuration: 300,
      backgroundColor: '#4f46e5',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    Keyboard: {
      resize: KeyboardResize.Body,
      style: KeyboardStyle.Dark,
      resizeOnFullScreen: true,
    },
  },

  ios: {
    contentInset: 'always',
    scrollEnabled: true,
    backgroundColor: '#ffffff',
  },

  android: {
    backgroundColor: '#ffffff',
  },
}

export default config
