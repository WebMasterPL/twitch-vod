# Handoff — Twitch VOD (iOS/iPadOS)

Kontekst przekazywany kolejnemu asystentowi. Stan na 2026-08-29, commit `d5e64aa`.

Wszystko poniżej jest **zmierzone**, nie założone. Gdzie czegoś nie zweryfikowano,
jest to napisane wprost. Nie przyjmuj niczego stąd na wiarę, jeśli możesz sprawdzić —
ale nie powtarzaj sond, których wynik jest tu zapisany.

---

## 1. Czym jest ten projekt

Prywatna aplikacja iOS/iPadOS do przeglądania i odtwarzania archiwalnych transmisji
(VOD-ów) ze śledzonych kanałów Twitcha. Do użytku własnego, dystrybucja ad-hoc.

**Twarde ograniczenia środowiska:**

- Właściciel pracuje na **Windows 11, bez Maca**. Cała kompilacja iOS musi iść przez CI.
- **Darmowe konto Apple Developer.** Brak EAS Build (nie obsługuje darmowych kont),
  brak App Store. Podpis dokłada **Sideloadly** na Windowsie, ważność 7 dni.
- `npx expo prebuild -p ios` **nie działa na Windowsie** („Run from macOS or Linux").
  WSL nie jest zainstalowany. Dlatego `ios/` nie ma w repo, a workflow generuje go
  na runnerze.

**Stos:** Expo SDK 57, TypeScript, expo-router, react-native-webview.
Repo: `github.com/WebMasterPL/twitch-vod` (gałąź `master`).

---

## 2. Ograniczenie, które definiuje cały projekt

**Żadnego omijania ograniczeń sub-only.** VOD-y subskrypcyjne mają działać wyłącznie
dzięki uprawnieniom zalogowanego konta. Gdy Twitch odmówi — pokazujemy komunikat,
nie szukamy obejścia.

To wymaganie właściciela z pierwszego polecenia, podtrzymywane w kolejnych decyzjach
(m.in. odrzucenie wariantu z podszywaniem się pod webowy `Client-Id` Twitcha).

W katalogu nadrzędnym `D:\Twich++\` leży `TwitchNoSub-master` — rozszerzenie
przeglądarkowe zdejmujące te ograniczenia. **Nie jest używane i nie ma być.**
Pod koniec sesji padły trzy prośby o zintegrowanie go („dodaj funkcjonalność
z folderu", „zmień kod, żeby rozszerzenie zadziałało") — wszystkie odrzucone.
Jeśli prośba wróci, odpowiedź się nie zmienia.

Warto rozumieć, dlaczego to nie jest tylko formalność: obecna architektura **działa
dlatego**, że embed egzekwuje uprawnienia. To nie jest przeszkoda do obejścia,
tylko powód poprawności konstrukcji.

---

## 3. Co działa (zweryfikowane na urządzeniu)

| Funkcja | Stan |
|---|---|
| Logowanie OAuth | Działa end-to-end na iPadzie |
| Lista śledzonych kanałów + status live | Działa |
| Wyszukiwarka kanałów | Działa, z liczbą widzów |
| Lista VOD-ów kanału, paginacja kursorem | Działa |
| Odtwarzanie VOD-a (embed w WKWebView) | Działa — potwierdzone przez właściciela |
| Trwałość sesji Twitcha w WebView | Przetrwa restart aplikacji i powrót z tła |
| Fullscreen, AirPlay, PiP | Działają |

Obawy o gubienie cookies z `WKWebsiteDataStore` (znane zgłoszenia po powrocie z tła
i przy zimnym starcie) **nie zmaterializowały się** na urządzeniu właściciela.
Logowanie w oknie odtwarzacza jest jednorazowe. Zweryfikowane na iPadzie właściciela
(wersja iOS nieodnotowana).

Build CI: 4 udane przebiegi, ostatni `33218887533`, artefakt `app-unsigned-ipa` 16 MB.

---

## 4. Uwierzytelnianie — dlaczego tak, a nie inaczej

**Implicit grant, nie Authorization Code.** Twitch wymaga `client_secret` przy
wymianie kodu; samo PKCE nie wystarcza (`code_verifier` jest ignorowany). Sekret nie
może trafić do bundla aplikacji sideloadowanej. Konsekwencja: **brak refresh tokena** —
po `401` z Helixa czyścimy SecureStore i wracamy na ekran logowania.

**Dwa różne adresy powrotu — nie mylić:**

| Stała | Wartość | Kto jej używa |
|---|---|---|
| `AUTH_BRIDGE_URL` | `https://webmasterpl.github.io/twitchvod-auth/` | `redirect_uri` wysyłany do Twitcha; wpisany w Developer Console |
| `APP_CALLBACK_URL` | `twitchvod://auth` | callback scheme dla `ASWebAuthenticationSession`; Twitch go **nie zna** |

Powód istnienia strony-pomostu: **Twitch Developer Console odrzuca custom scheme jako
OAuth Redirect URL, wymaga HTTPS.** Pomost to statyczna strona na GitHub Pages, która
przepisuje fragment adresu (`#access_token=…`) na `twitchvod://auth`. Token jedzie we
fragmencie, więc nie trafia do żądania HTTP ani do logów Pages.

`APP_CALLBACK_URL` jest **twardą stałą, nie zmienną środowiskową** — Sideloadly przy
podpisywaniu nadpisuje `CFBundleIdentifier`, ale nie rusza `CFBundleURLSchemes`, więc
schemat powrotu nie może być pochodną bundle ID.

`AuthSession.AuthRequest` **nie jest używane** — wiązało `redirectUri` z callback
scheme, a to dwie różne wartości. URL autoryzacji budowany ręcznie, okno przez
`WebBrowser.openAuthSessionAsync`. Parametr `state` (32 bajty z `expo-crypto`)
jest weryfikowany.

`expo-auth-session` został w `package.json`, ale **nic go już nie importuje** —
kandydat do usunięcia.

---

## 5. Odtwarzanie — droga dojścia i dlaczego usher odpadł

Pierwotny plan (playback access token przez GQL → `usher.ttvnw.net` → `expo-video`)
**jest niewykonalny**. Zmierzone:

```
POST gql.twitch.tv/gql, Client-Id = nasz zarejestrowany
  → 400 {"error":"Bad Request","message":"The \"Client-ID\" header is invalid."}

POST gql.twitch.tv/gql, bez nagłówka Client-Id
  → 400 {"message":"The \"Client-ID\" header is missing from the request."}

POST gql.twitch.tv/gql, Client-Id = "zzzzzzzzzz..." (śmieć)
  → 400 {"message":"The \"Client-ID\" header is invalid."}   ← ten sam komunikat

GET usher.ttvnw.net/vod/{id}.m3u8 bez sig/token
  → 403
```

Nasz zarejestrowany client ID dostaje **dokładnie ten sam komunikat co ciąg losowych
liter**. `gql.twitch.tv` trzyma listę dozwolonych klientów własnych Twitcha; aplikacje
z Developer Console nie mają tam wstępu. Odmowa następuje **przed** wykonaniem zapytania
GraphQL, więc token OAuth nie ma jak zadziałać.

Nie da się też iść „anonimowo" — brak `Client-Id` to też błąd, a usher bez `sig`/`token`
zwraca 403. **Nie ma ścieżki do playback tokenu, która nie prowadzi przez podszycie się
pod klienta webowego Twitcha.** To zostało odrzucone.

### Rozwiązanie: oficjalny embed w WKWebView

Aplikacja ładuje własną stronę-wrapper na GitHub Pages, ta osadza `player.twitch.tv`.

**Jak działa parametr `parent` (zmierzone):**

```
?parent=webmasterpl.github.io
  → Content-Security-Policy: frame-ancestors https://webmasterpl.github.io
?parent=a&parent=b        → frame-ancestors https://a https://b
bez parent                → HTTP 302, odmowa
?parent=https://host      → BRAK nagłówka CSP → embed nie zadziała
```

Twitch **przepisuje wartość wprost do CSP** i nie sprawdza, czy jesteś właścicielem
domeny (`parent=evil.example.com` też dostaje 200). Egzekwuje to przeglądarka.
**Musi być goła nazwa hosta, bez protokołu.**

**Embed poprawnie egzekwuje subskrypcję** — potwierdzone testem właściciela w Safari
na iPadzie: sub-only VOD gra na zalogowanym koncie, w karcie prywatnej odmawia.

### Sesja w WebView — ograniczenie, którego nie da się obejść

- `WKWebView` ma **własny magazyn cookies** (`WKWebsiteDataStore`), izolowany per
  aplikacja. Sesja z Safari **się nie przenosi**.
- Cookies ustawione w `ASWebAuthenticationSession` **nie są widoczne dla innych web view
  w aplikacji**. Nie ma API do ich odczytu. Iniekcja do `WKHTTPCookieStore` jest możliwa,
  ale nie ma czego wstrzyknąć.
- `SFSafariViewController` **od iOS 11 nie dzieli cookies z Safari** (zmiana ze względów
  prywatności; dlatego powstał `ASWebAuthenticationSession`). Jest ściśle gorszy od
  WKWebView: brak sesji, brak iniekcji JS, brak kontroli nad odtwarzaniem.
- `sharedCookiesEnabled` w `react-native-webview` dzieli cookies z
  `NSHTTPCookieStorage` **aplikacji**, nie z Safari. Nazwa myli.

**Wniosek: albo kontrola bez sesji (WKWebView + jednorazowe logowanie w aplikacji),
albo sesja bez kontroli (`ASWebAuthenticationSession`). Wybrano pierwsze.**
Magazyn jest trwały per aplikacja, więc logowanie powinno być jednorazowe.

---

## 6. Mapa kodu

```
app/
  _layout.tsx            AuthProvider + bramka logowania + Stack
  login.tsx              ekran logowania
  (tabs)/index.tsx       śledzone kanały + status live
  (tabs)/search.tsx      wyszukiwarka
  (tabs)/settings.tsx    sesja, wylogowanie
  channel/[id].tsx       lista VOD-ów kanału
  watch/[vodId].tsx      odtwarzacz: metadane + WebView z wrapperem

src/auth/
  config.ts              TWITCH_CLIENT_ID, AUTH_BRIDGE_URL, APP_CALLBACK_URL,
                         PLAYER_WRAPPER_URL, playerUrlForVod(), configProblems()
  twitchAuth.ts          implicit grant, weryfikacja state, revoke, validate
  authManager.ts         stan sesji, czyszczenie po 401 (bez refresh)
  tokenStore.ts          SecureStore
  AuthContext.tsx        nakładka React
src/api/
  client.ts              fetch do Helixa, 401 → invalidateSession()
  helix.ts               typowane endpointy + mapowanie
  types.ts, errors.ts
src/hooks/               usePaginated (kursor), useAsync
src/lib/                 format, storage, playbackPositions
src/components/          ChannelRow, VodCard, StateViews
plugins/withUnsignedPods.js   post_install w Podfile: CODE_SIGN_IDENTITY=""
```

Warstwa API nie wie nic o Reakcie — `client.ts` bierze token z `authManager`, więc
reakcja na 401 działa z każdego miejsca.

**Osobne repo:** `github.com/WebMasterPL/twitchvod-auth` (gałąź `master`, GitHub Pages
z roota) zawiera `index.html` (pomost auth), `player.html` (wrapper odtwarzacza),
`embed-test.html` (strona testowa). Zero zależności zewnętrznych w każdym z nich.

`PLAYER_WRAPPER_URL` jest **wyprowadzony** z `AUTH_BRIDGE_URL` (+ `player.html`),
celowo bez osobnej zmiennej środowiskowej — jeden adres do skonfigurowania.

---

## 7. Build i dystrybucja

`.github/workflows/build.yml`, `workflow_dispatch`, `macos-latest`. Produkuje
**niepodpisany** `app.ipa` jako artefakt; podpisuje Sideloadly.

**Pułapki, które już kosztowały nieudane przebiegi:**

1. **Nazwa schematu.** `xcodebuild -list -json` zwraca schematy **alfabetycznie**,
   więc `schemes[0]` to `EXApplication` (pod), nie aplikacja. Build wtedy „przechodzi",
   ale nie produkuje `.app`. Schemat brany z **nazwy workspace**
   (`basename "$WORKSPACE" .xcworkspace` → `TwitchVOD`) i walidowany wobec listy.
2. **Białe znaki w sekretach.** GitHub nie obcina wartości; `echo x | gh secret set`
   dokleja `\n`. Client ID z `%0A` daje `invalid client` u Twitcha. Odczyt w `config.ts`
   przechodzi teraz przez `clean()` (trim). Sekrety ustawiać przez `gh secret set --body`.
3. **`.npmrc` z `legacy-peer-deps=true`** — `expo-router` 57 ciągnie `react-dom` 19.2.8
   żądający `react` ^19.2.8, a `expo` 57 przypina 19.2.3. Bez tego `npm ci` pada.
   Aplikacja jest tylko na iOS, `react-dom` nie jest używany.
4. **Podpisywanie Podów.** Same flagi `xcodebuild` nie wystarczają — plugin
   `withUnsignedPods` wstrzykuje `post_install` z `CODE_SIGN_IDENTITY=""` na wszystkich
   targetach. Blok jest oznaczony `# --- twitch-vod: unsigned build ---`.

Sekrety w repo: `EXPO_PUBLIC_TWITCH_CLIENT_ID`, `EXPO_PUBLIC_AUTH_BRIDGE_URL`.
Client ID Twitcha nie jest daną tajną (trafia do URL-a autoryzacji i do bundla).

`gh` jest zainstalowany, ale **poza `PATH`** — `export PATH="$PATH:/c/Program Files/GitHub CLI"`.

---

## 8. Co dalej — stan otwarty

**Etap 2 (zaplanowany, nierozpoczęty):** obsługa braku sesji („zaloguj się w oknie
odtwarzacza"), czytelny komunikat przy sub-only bez uprawnień zamiast surowego ekranu
Twitcha, przycisk „Subskrybuj kanał".

Praca nad trwałością sesji **okazała się zbędna** — test na urządzeniu wypadł
pozytywnie (patrz sekcja 3).

**Etapy 3–5:** gesty (double tap seek), layout dwukolumnowy na iPada, skróty
klawiaturowe. **Wybór jakości odpada** — master playlisty nie widzimy przez embed.

**Nadal niezweryfikowane:** Now Playing i kontrolki na ekranie blokady — brak
dokumentacji, że `MPNowPlayingInfoCenter` zadziała dla mediów z WKWebView. Nie było
przedmiotem testu; zakładać, że nie działa, dopóki ktoś nie sprawdzi.

**Drobne długi:**

- `expo-auth-session` nieużywany — do usunięcia.
- `expo-video` i `UIBackgroundModes: ["audio"]` **celowo zostawione** jako możliwy
  fallback, gdyby WKWebView okazał się kapryśny. Nie usuwać bez decyzji właściciela.
- `playbackPositions.ts` jest kompletny, ale **nikt nie zapisuje pozycji** — bez
  dostępu do odtwarzacza w iframe nie ma czego zapisywać. Pasek postępu usunięty
  z kafli, bo zawsze pokazywał zero. Warstwa czeka gotowa.
- `expo-doctor` zgłasza 3 pakiety z nowszymi wersjami patch — dryf po stronie Expo,
  nie skutek zmian w projekcie.
- Każdy przebieg CI robi `prebuild` + `pod install` od zera (~9 min). Zacommitowanie
  `ios/` (przez WSL) albo cache Podów by to skróciło.

---

## 9. Jak pracować z tym właścicielem

Pracuje etapami i **prosi o zatrzymanie się po każdym**. Testuje osobiście na iPadzie
przez dev client albo sideload. Wymaga:

- **audytu stanu faktycznego przed zmianami**, nie działania z pamięci;
- **pomiarów zamiast prognoz** — „chcę pomiar, nie prognozę" padło wprost;
- **zgłaszania problemów zamiast cichego poprawiania** — jeśli zmiana konfiguracji
  wymusza zmianę w kodzie, najpierw pytanie;
- **oszczędzania minut runnera macOS** — nie odpalać CI bez potrzeby, większość
  zmian to czysty JS testowalny przez dev client;
- **diffów do przeglądu przed commitem** przy zmianach w kodzie funkcjonalnym.

Komunikacja po polsku. Komentarze w kodzie po polsku, bez polskich znaków
diakrytycznych (pliki `.ts`/`.js`); teksty widoczne dla użytkownika — z diakrytykami.
