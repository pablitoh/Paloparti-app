import { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV === 'development';

if (isDev && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    'NEXT_PUBLIC_API_URL environment variable is required for Android development'
  );
}

const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || '';

const config: CapacitorConfig = {
  appId: 'com.paloparti.app',
  appName: 'Paloparti',
  webDir: '.next/server/pages',
  bundledWebRuntime: false,
  server: {
    // En desarrollo usar la URL de desarrollo, en producción usar la app empaquetada
    url: isDev ? baseUrl : 'http://10.0.2.2:3000',
    androidScheme: isDev ? 'http' : 'https',
    cleartext: true,
    // Dominios permitidos para navegación
    allowNavigation: [
      'http://10.0.2.2:*',
      'http://192.168.1.34:*',
      'https://accounts.google.com',
      'https://*.googleapis.com',
      'https://paloparti.vercel.app',
      'https://*.paloparti.vercel.app',
    ],
  },
  android: {
    allowMixedContent: true,
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      signingType: 'apksigner',
    },
  },
  ios: {
    // Configuración futura para iOS
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: '#ffffffff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      spinnerColor: '#999999',
      splashFullScreen: true,
      splashImmersive: true,
    },
    GoogleAuth: {
      scopes: ['profile', 'email', 'openid'],
      serverClientId: process.env.GOOGLE_CLIENT_ID,
      forceCodeForRefreshToken: true,
    },
    CapacitorCookies: {
      enabled: true,
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
