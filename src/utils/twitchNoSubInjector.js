// src/utils/twitchNoSubInjector.js

export const twitchNoSubScript = `
(function() {
  console.log('[TwitchNoSub] Inicjalizacja...');

  // 1. Podmiana Client-ID
  // Zapisujemy oryginalną metodę
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  
  XMLHttpRequest.prototype.setRequestHeader = function(key, value) {
    // Jeśli nagłwiek to Client-ID, podmieniamy go na publiczny
    if (key.toLowerCase() === 'client-id') {
      // Ten ID jest często używany przez przeglądarkę i jest mniej restrykcyjny
      value = 'kimne79xkrwz66ojhe3v0t249i3m9'; 
      console.log('[TwitchNoSub] Client-ID zamieniony na: kimne79xkrwz66ojhe3v0t249i3m9');
    }
    return originalSetRequestHeader.apply(this, arguments);
  };

  // 2. Iniekcja CSS do ukrywania elementów sub-only
  const style = document.createElement('style');
  style.innerHTML = \`
    /* Ukryj karty VOD/Clips oznaczone jako sub-only */
    .vod-card__sub-only,
    .clip-card__sub-only,
    .stream-card__sub-only,
    [data-sub-only="true"],
    [data-audio-only="true"],
    .video-player__sub-only-overlay {
      display: none !important;
    }
    
    /* Opcjonalnie: Ukryj przycisk "Sub Required" jeśli się pojawi */
    .sub-required-button {
      display: none !important;
    }
  \`;
  document.head.appendChild(style);

  // 3. MutationObserver - dynamiczne ukrywanie nowych elementów
  // Twitch używa lazy-loadingu, więc elementy mogą pojawić się później
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element DOM
          checkAndHideSubOnly(node);
        }
      });
    });
  });

  function checkAndHideSubOnly(element) {
    // Sprawdź sam element
    if (element.classList.contains('sub-only') || 
        element.dataset.subOnly === 'true' ||
        element.dataset.audioOnly === 'true') {
      element.style.display = 'none';
    }
    
    // Sprawdź dzieci
    const subOnlyElements = element.querySelectorAll('.sub-only, [data-sub-only="true"], [data-audio-only="true"]');
    subOnlyElements.forEach(el => el.style.display = 'none');
  }

  // Zacznij obserwować body
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('[TwitchNoSub] Gotowe.');
})();
true; // Zwróć true dla RN WebView
`;