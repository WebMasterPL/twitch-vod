# Twitch VOD — odtwarzacz VOD-ów na iOS/iPadOS

Prywatna aplikacja do przeglądania i odtwarzania archiwalnych transmisji
z Twoich śledzonych kanałów Twitcha. Build w GitHub Actions (niepodpisany IPA),
podpis i instalacja przez Sideloadly na Windowsie — darmowe konto Apple,
bez Maca i bez App Store.

Stack: Expo SDK 57 · TypeScript · expo-router · expo-auth-session ·
expo-secure-store · expo-video · AsyncStorage.

---

## Stan projektu

**Etap 1 — gotowy:**

- logowanie OAuth (implicit grant) z tokenem w SecureStore,
- lista śledzonych kanałów ze statusem live (`/channels/followed` + `/streams/followed`),
- wyszukiwarka kanałów (`/search/channels`),
- lista VOD-ów kanału z paginacją kursorem, miniaturami, czasem trwania i datą
  (`/videos?user_id=&type=archive`),
- zapis pozycji odtwarzania (warstwa danych + pasek postępu na kaflach),
- ekran ustawień z podglądem sesji i wylogowaniem.

**Etap 2 — do zrobienia:** odtwarzacz (playback access token, HLS z usher,
expo-video, AirPlay, PiP, Now Playing, gesty, układ dwukolumnowy na iPadzie,
skróty klawiaturowe). Trasa `app/watch/[vodId].tsx` istnieje jako zaślepka
pokazująca metadane VOD-a.

---

## 1. Rejestracja aplikacji w Twitch Developer Console

1. Wejdź na <https://dev.twitch.tv/console/apps> i kliknij **Register Your Application**.
2. **Name** — dowolna, unikalna w skali Twitcha (np. `Moj VOD Player`).
3. **OAuth Redirect URLs** — wpisz dokładnie, bez końcowego ukośnika:

   ```
   twitchvod://auth
   ```

   Twitch porównuje ten adres znak w znak. To **jedyny** poprawny redirect —
   nie używaj `pl.easywebstart.twitchvod://`, mimo że ten schemat też jest
   zarejestrowany w Info.plist (patrz sekcja 2).
4. **Category** — `Application Integration`.
5. **Client Type** — `Public`.
6. Zapisz **Client ID**. Client Secret **nie jest potrzebny**.

## 2. Uwierzytelnianie — implicit grant

Aplikacja używa **implicit grant**: Twitch zwraca `access_token` bezpośrednio
we fragmencie redirectu, bez wymiany kodu i bez sekretu.

Authorization Code odpada, bo Twitch wymaga przy wymianie kodu `client_secret`
(samo PKCE nie wystarcza — `code_verifier` jest ignorowany), a sekret nie może
trafić do bundla aplikacji sideloadowanej.

Konsekwencja: **nie ma refresh tokena**. Token żyje ok. 60 dni. Gdy wygaśnie
albo gdy Helix odpowie `401`, aplikacja czyści SecureStore i wraca na ekran
logowania. W praktyce zobaczysz to rzadziej niż cotygodniowy refresh podpisu.

Zakres uprawnień: `user:read:follows` — wyłącznie odczyt listy śledzonych kanałów.

## 3. Zmienne środowiskowe

```bash
cp .env.example .env
```

Uzupełnij:

```dotenv
EXPO_PUBLIC_TWITCH_CLIENT_ID=twoj_client_id
```

Redirect URI **nie jest** zmienną środowiskową — to stała `twitchvod://auth`
w `src/auth/config.ts` (uzasadnienie w sekcji 2).

Zmienne `EXPO_PUBLIC_*` są wkompilowane w bundle na etapie builda — po ich
zmianie trzeba przebudować aplikację, restart nie wystarczy. `.env` jest
w `.gitignore`.

**Build w CI czyta te zmienne z GitHub Secrets**, nie z pliku `.env`. Ustaw
w repozytorium: *Settings → Secrets and variables → Actions → New repository
secret*:

| Nazwa | Wartość |
|---|---|
| `EXPO_PUBLIC_TWITCH_CLIENT_ID` | Twój Client ID z konsoli Twitcha |

Bez tego sekretu IPA zbuduje się poprawnie, ale ekran logowania pokaże
„Brakuje konfiguracji" i przycisk będzie nieaktywny.

## 4. Budowanie IPA w GitHub Actions

Workflow: `.github/workflows/build.yml`, uruchamiany ręcznie.

1. Wypchnij repozytorium na GitHub.
2. Wejdź w zakładkę **Actions** → **Build unsigned iOS IPA** → **Run workflow**.
3. Poczekaj (~10–20 min). Runner `macos-latest` wykonuje:
   - `npm ci`,
   - `npx expo prebuild -p ios --no-install` (tylko jeśli `ios/` nie ma w repo),
   - `pod install`,
   - `xcodebuild -list` — **wypisuje listę schematów do logów**, przydatne przy
     pierwszym uruchomieniu,
   - `xcodebuild` w konfiguracji Release, `-sdk iphoneos`,
     `-destination 'generic/platform=iOS'`, z wyłączonym podpisywaniem,
   - pakuje `.app` do `Payload/` i zipuje jako `app.ipa`.
4. Po zakończeniu zjedź na dół strony przebiegu do sekcji **Artifacts**
   i pobierz **`app-unsigned-ipa`**. Rozpakuj ZIP — w środku jest `app.ipa`.

Artefakty żyją 14 dni.

Nazwa schematu nie jest wpisana na sztywno — workflow czyta ją z
`xcodebuild -list -json`, więc zmiana `name` w `app.config.js` nic nie psuje.
Listę schematów i tak zobaczysz w logach kroku „Lista schematow Xcode".

## 5. Instalacja przez Sideloadly

Potrzebujesz: Windows, kabel Lightning/USB-C, Apple ID (darmowe wystarcza),
zainstalowane **iTunes** (wersja ze strony Apple, nie ze Sklepu Microsoft) —
Sideloadly korzysta z jego sterowników.

1. Pobierz Sideloadly z <https://sideloadly.io> i zainstaluj.
2. Podłącz iPhone/iPada kablem, odblokuj i potwierdź **Zaufaj temu komputerowi**.
3. Uruchom Sideloadly. Urządzenie powinno pojawić się na liście **Device**.
4. Przeciągnij `app.ipa` na okno Sideloadly (albo wskaż przez **IPA**).
5. Wpisz **Apple ID** i kliknij **Start**. Sideloadly poprosi o hasło —
   jeśli masz włączone 2FA, wygeneruj hasło aplikacji na
   <https://account.apple.com> i użyj go zamiast zwykłego.
6. Sideloadly sam podpisze IPA darmowym certyfikatem deweloperskim
   i wgra na urządzenie.
7. Na urządzeniu: **Ustawienia → Ogólne → VPN i zarządzanie urządzeniem →**
   wybierz swój Apple ID → **Zaufaj**. Bez tego aplikacja nie uruchomi się.

### Ograniczenia darmowego konta

- **Podpis wygasa po 7 dniach.** Po tym czasie aplikacja przestaje się
  uruchamiać (zwykle zamyka się natychmiast po tapnięciu w ikonę).
- Maksymalnie **3 aplikacje** sideloadowane jednocześnie na jednym Apple ID.
- Limit **10 identyfikatorów aplikacji na 7 dni** — nie zmieniaj bundle ID bez
  potrzeby.

### Cotygodniowy refresh podpisu

Podpis odnawiasz **bez ponownego budowania IPA** — ten sam plik `app.ipa`
jest ważny bezterminowo, wygasa tylko podpis.

1. Podłącz urządzenie kablem.
2. Uruchom Sideloadly, wskaż ten sam `app.ipa`, wpisz Apple ID, **Start**.
3. Aplikacja zostanie nadpisana świeżym podpisem. Dane (w tym zalogowana
   sesja Twitcha w SecureStore) zwykle przeżywają nadpisanie, bo bundle ID
   i konto podpisujące się nie zmieniają — ale jeśli po refreshu zobaczysz
   ekran logowania, po prostu zaloguj się ponownie.

Alternatywa bez kabla: Sideloadly ma opcję **Sideload via WiFi** po pierwszym
podłączeniu przewodem. Można też zainstalować na urządzeniu aplikację
**SideStore**/**AltStore**, która odnawia podpis w tle — to już poza zakresem
tego README.

Nowy build z Actions jest potrzebny tylko wtedy, gdy zmienisz kod, zależności
natywne albo zmienne `EXPO_PUBLIC_*`.

## 6. Konfiguracja natywna

`app.config.js` (zastąpił `app.json`, żeby czytać `.env` przez `process.env`):

- `ios.bundleIdentifier: "pl.easywebstart.twitchvod"`,
- `scheme: "twitchvod"` → `CFBundleURLSchemes: ["twitchvod", "pl.easywebstart.twitchvod"]`
  — kod używa wyłącznie pierwszego,
- `ios.infoPlist.UIBackgroundModes: ["audio"]` — odtwarzanie w tle,
- plugin `expo-video` z `supportsBackgroundPlayback` i `supportsPictureInPicture`,
- `ios.supportsTablet: true` oraz `UIRequiresFullScreen: false` — Split View
  i Stage Manager na iPadzie,
- plugin `./plugins/withUnsignedPods` — wstrzykuje do `Podfile` blok
  `post_install` ustawiający `CODE_SIGN_IDENTITY=""` na wszystkich targetach
  Podów. Same flagi `xcodebuild` nie zawsze docierają do targetów CocoaPods.

Żadne entitlement niedostępne na darmowym koncie nie jest używane: brak push
notifications, App Groups, iCloud, Associated Domains, HealthKit, CarPlay
i Sign in with Apple. `UIBackgroundModes` to klucz Info.plist, nie entitlement,
więc działa bez ograniczeń. OAuth wraca przez custom scheme, a nie Universal
Links — dlatego Associated Domains nie są potrzebne.

Weryfikacja konfiguracji z Windowsa (bez Maca):

```bash
npx expo config --type introspect   # pokazuje wynikowy Info.plist
npx expo-doctor                     # spójność zależności i configu
npx expo export --platform ios      # sprawdza, że bundle się składa
npm run typecheck
```

## 7. Folder `ios/`

`.gitignore` wyklucza tylko `ios/Pods/` i `ios/build/` — reszta folderu `ios/`
ma trafić do repozytorium.

**Folder nie jest jeszcze wygenerowany.** `npx expo prebuild -p ios` odmawia
pracy na Windowsie („Run npx expo prebuild again from macOS or Linux"), a WSL
nie jest zainstalowany. Do wyboru:

- **Nic nie robić** — workflow wykrywa brak `ios/` i sam uruchamia prebuild na
  runnerze macOS. Build działa od razu, tylko projekt natywny powstaje na nowo
  przy każdym przebiegu.
- **Wygenerować i zacommitować** — zainstaluj WSL (`wsl.exe --install`), a potem
  w dystrybucji Linuksa:

  ```bash
  npm run prebuild        # = expo prebuild -p ios
  git add ios && git commit -m "Add native iOS project"
  ```

  Od tego momentu workflow pominie prebuild i użyje wersji z repo.
  Plugin `withUnsignedPods` wstrzyknie `post_install` do `Podfile` niezależnie
  od tego, gdzie prebuild się wykona.

Po zmianie konfiguracji natywnej regeneruj przez `npm run prebuild:clean`.

## 8. Struktura projektu

```
.github/workflows/build.yml   build niepodpisanego IPA na macos-latest
app.config.js                 konfiguracja Expo (czyta .env)
plugins/withUnsignedPods.js   post_install w Podfile: CODE_SIGN_IDENTITY=""

app/                      trasy expo-router
  _layout.tsx             AuthProvider + bramka logowania + Stack
  login.tsx               ekran logowania OAuth
  (tabs)/
    index.tsx             śledzone kanały + status live
    search.tsx            wyszukiwarka kanałów
    settings.tsx          sesja i wylogowanie
  channel/[id].tsx        lista VOD-ów kanału (paginacja kursorem)
  watch/[vodId].tsx       zaślepka odtwarzacza (etap 2)

src/
  auth/
    config.ts             client id, redirect, zakresy, walidacja configu
    tokenStore.ts         zapis sesji w SecureStore
    twitchAuth.ts         implicit grant: signIn / revoke / validate
    authManager.ts        stan sesji, czyszczenie po 401
    AuthContext.tsx       React-owa nakładka na authManager
  api/
    client.ts             fetch do Helixa, obsługa 401, budowa query
    helix.ts              typowane endpointy + mapowanie odpowiedzi
    types.ts              modele domenowe
    errors.ts             ApiError / NetworkError + komunikaty dla użytkownika
  hooks/
    usePaginated.ts       lista stronicowana kursorem
    useAsync.ts           pojedyncze pobranie z anulowaniem
  lib/
    format.ts             czas trwania, daty, liczba widzów
    storage.ts            AsyncStorage z JSON-em
    playbackPositions.ts  pozycje odtwarzania per VOD
  components/             ChannelRow, VodCard, StateViews
  theme.ts                kolory, odstępy, próg układu szerokiego
```

Warstwa API nie wie nic o Reakcie — `client.ts` bierze token z `authManager`,
więc reakcja na 401 działa tak samo z każdego miejsca w aplikacji.

## 9. VOD-y sub-only

Aplikacja **nie omija** ograniczeń Twitcha. VOD-y dostępne tylko dla
subskrybentów mają działać wyłącznie dzięki uprawnieniom zalogowanego konta —
jeśli konto nie ma subskrypcji, Twitch odmówi dostępu, a aplikacja pokaże
komunikat „wymagana subskrypcja kanału". Bez obejść, bez podmiany identyfikatora
klienta, bez sięgania po nieautoryzowane warianty manifestu.

Uwaga praktyczna na etap 2: publiczny endpoint GQL Twitcha honoruje token OAuth
tylko wtedy, gdy pasuje on do identyfikatora klienta wysyłanego w nagłówku
`Client-Id`. Uprawnienia subskrypcyjne zalogowanego konta przenoszą się na
playback access token tylko w takim zakresie, w jakim Twitch to przewiduje dla
Twojej aplikacji. Jeśli VOD-y sub-only okażą się niedostępne mimo aktywnej
subskrypcji, właściwą reakcją jest komunikat o braku dostępu — nie próba
obejścia.

## 10. Rozwiązywanie problemów

**Aplikacja zamyka się zaraz po uruchomieniu** — najczęściej wygasł 7-dniowy
podpis. Odśwież przez Sideloadly (sekcja 5). Drugi możliwy powód: nie
zatwierdzono profilu w *Ustawienia → Ogólne → VPN i zarządzanie urządzeniem*.

**„Redirect URI mismatch"** — w konsoli Twitcha musi być wpisane dokładnie
`twitchvod://auth`, bez końcowego ukośnika. Ta wartość jest stałą w kodzie
(`src/auth/config.ts`), więc nie da się jej rozjechać przez `.env`.

**Ekran logowania pokazuje „Brakuje konfiguracji"** — w buildzie zabrakło
`EXPO_PUBLIC_TWITCH_CLIENT_ID`. Sprawdź, czy sekret jest ustawiony
w repozytorium, i uruchom workflow ponownie.

**Logowanie kończy się natychmiast, bez błędu** — `scheme` w `app.config.js`
nie zgadza się z redirectem. Sprawdź `npx expo config --type introspect`
i sekcję `CFBundleURLTypes`.

**Wylogowuje po jakimś czasie** — to normalne. Implicit grant nie daje refresh
tokena, więc po wygaśnięciu (ok. 60 dni) albo po `401` z Helixa sesja jest
czyszczona i trzeba zalogować się ponownie.

**Build w Actions wywala się na podpisywaniu** — sprawdź w logach kroku
`pod install`, czy w `Podfile` jest blok `# --- twitch-vod: unsigned build ---`.
Jeśli go nie ma, plugin `withUnsignedPods` nie zadziałał — najpewniej zmienił
się szablon Podfile w nowszym SDK.

**Konflikty peer dependencies przy `npm ci`** — projekt ma `.npmrc`
z `legacy-peer-deps=true`. Powód: `expo-router` 57 ciągnie `react-dom` 19.2.8
wymagający `react` ^19.2.8, podczas gdy `expo` 57 przypina `react` 19.2.3.
Aplikacja jest tylko na iOS, więc `react-dom` nie jest w ogóle używany.
