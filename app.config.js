/**
 * Konfiguracja Expo. Zamiast statycznego app.json, zeby czytac .env.
 * Expo CLI wczytuje pliki .env samo, wiec process.env.EXPO_PUBLIC_* jest
 * dostepne zarowno lokalnie, jak i na runnerze GitHub Actions.
 *
 * Build idzie przez `npx expo prebuild` + xcodebuild (niepodpisany IPA),
 * podpis dokłada Sideloadly - dlatego nie ma tu niczego zwiazanego z EAS.
 */

const BUNDLE_ID = 'pl.easywebstart.twitchvod';
const SCHEME = 'twitchvod';

module.exports = () => ({
  expo: {
    name: 'Twitch VOD',
    slug: 'twitch-vod',
    version: '1.0.0',
    orientation: 'default',
    icon: './assets/icon.png',
    scheme: SCHEME,
    userInterfaceStyle: 'dark',
    assetBundlePatterns: ['**/*'],

    ios: {
      supportsTablet: true,
      requireFullScreen: false,
      bundleIdentifier: BUNDLE_ID,
      config: {
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        UIBackgroundModes: ['audio'],
        UISupportsDocumentBrowser: false,
        UIRequiresFullScreen: false,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
        },
        // Pierwszy wpis to schemat redirectu OAuth i TYLKO jego uzywa kod
        // (src/auth/config.ts). Drugi zostaje dla zgodnosci z domyslnym
        // schematem Expo, ale nic sie na nim nie opiera - Sideloadly nadpisuje
        // CFBundleIdentifier, wiec redirect nie moze byc jego pochodna.
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [SCHEME, BUNDLE_ID],
          },
        ],
      },
    },

    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 180,
          resizeMode: 'contain',
          backgroundColor: '#0E0E10',
        },
      ],
      'expo-secure-store',
      'expo-web-browser',
      [
        'expo-video',
        {
          supportsBackgroundPlayback: true,
          supportsPictureInPicture: true,
        },
      ],
      'expo-font',
      // Wylacza podpisywanie Podow - podpis dokłada Sideloadly.
      './plugins/withUnsignedPods',
    ],

    experiments: {
      typedRoutes: true,
    },

    extra: {
      twitchClientId: process.env.EXPO_PUBLIC_TWITCH_CLIENT_ID ?? '',
      // Adres strony-pomostu na GitHub Pages. To jest redirect_uri wysylany
      // do Twitcha (musi byc HTTPS - custom scheme jest odrzucany).
      // NIE mylic z APP_CALLBACK_URL w src/auth/config.ts, ktory zostaje
      // twitchvod://auth i sluzy do powrotu ze strony-pomostu do aplikacji.
      authBridgeUrl: process.env.EXPO_PUBLIC_AUTH_BRIDGE_URL ?? '',
    },
  },
});
