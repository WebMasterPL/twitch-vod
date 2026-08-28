const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# --- twitch-vod: unsigned build ---';

/**
 * Wylacza podpisywanie na wszystkich targetach Podow.
 *
 * Build w GitHub Actions leci z CODE_SIGNING_ALLOWED=NO, ale flagi xcodebuild
 * nie zawsze docieraja do targetow generowanych przez CocoaPods - czesc z nich
 * i tak probuje sie podpisac i wywraca build. Podpis dokłada Sideloadly
 * po stronie Windowsa, wiec tutaj nie jest do niczego potrzebny.
 *
 * Blok jest wstrzykiwany przy `expo prebuild`, dzieki czemu przezywa
 * regeneracje folderu ios/ (rowniez z flaga --clean).
 */
const withUnsignedPods = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes(MARKER)) {
        return cfg;
      }

      const injection = [
        '',
        `    ${MARKER}`,
        '    installer.pods_project.targets.each do |target|',
        '      target.build_configurations.each do |build_configuration|',
        "        build_configuration.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'",
        "        build_configuration.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'",
        "        build_configuration.build_settings['CODE_SIGN_IDENTITY'] = ''",
        "        build_configuration.build_settings['CODE_SIGN_ENTITLEMENTS'] = ''",
        "        build_configuration.build_settings['EXPANDED_CODE_SIGN_IDENTITY'] = ''",
        '      end',
        '    end',
      ].join('\n');

      const anchor = /post_install do \|installer\|/;
      if (!anchor.test(contents)) {
        throw new Error(
          'withUnsignedPods: nie znaleziono bloku post_install w Podfile - ' +
            'szablon Podfile sie zmienil, plugin wymaga aktualizacji.'
        );
      }

      contents = contents.replace(anchor, (match) => `${match}\n${injection}`);
      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);

module.exports = withUnsignedPods;
