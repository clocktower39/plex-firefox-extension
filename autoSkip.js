(() => {
  const SETTINGS_DATASET_KEYS = {
    skipIntroEnabled: 'plexSkipIntroEnabled',
    skipCreditsEnabled: 'plexSkipCreditsEnabled'
  };

  const DEFAULT_SETTINGS = {
    [SETTINGS_DATASET_KEYS.skipIntroEnabled]: true,
    [SETTINGS_DATASET_KEYS.skipCreditsEnabled]: true
  };

  const isSupportedPlexPage = () => {
    const { hostname, port } = window.location;
    return hostname === 'app.plex.tv' || port === '32400';
  };

  if (!isSupportedPlexPage()) {
    return;
  }

  const isSettingEnabled = key => {
    const existingValue = document.documentElement.dataset[key];

    if (existingValue === undefined) {
      const defaultValue = DEFAULT_SETTINGS[key];
      document.documentElement.dataset[key] = String(defaultValue);
      return defaultValue;
    }

    return existingValue === 'true';
  };

  const getButtonText = button => {
    return [
      button.innerText,
      button.textContent,
      button.getAttribute('aria-label'),
      button.getAttribute('title')
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  };

  const findButton = buttonText => {
    return [...document.querySelectorAll('button')].find(button => {
      return !button.disabled && button.getClientRects().length > 0 && getButtonText(button).includes(buttonText);
    });
  };

  // Define a callback function to be triggered when changes to the DOM occur.
  function handleDomChanges() {
    const skipIntroButton = findButton('skip intro');
    if (isSettingEnabled(SETTINGS_DATASET_KEYS.skipIntroEnabled) && skipIntroButton) {
      skipIntroButton.click();
    }

    const skipCreditsButton = findButton('skip credits');
    if (isSettingEnabled(SETTINGS_DATASET_KEYS.skipCreditsEnabled) && skipCreditsButton) {
      skipCreditsButton.click();
    }
  }

  const startObserver = () => {
    if (!document.body) {
      return false;
    }

    const observer = new MutationObserver(handleDomChanges);
    observer.observe(document.body, { childList: true, subtree: true });
    handleDomChanges();
    return true;
  };

  if (!startObserver()) {
    const bootObserver = new MutationObserver(() => {
      if (startObserver()) {
        bootObserver.disconnect();
      }
    });

    bootObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
  
