(() => {
  const isSupportedPlexPage = () => {
    const { hostname, port } = window.location;
    return hostname === 'app.plex.tv' || port === '32400';
  };

  if (!isSupportedPlexPage()) {
    return;
  }

  // Define a callback function to be triggered when changes to the DOM occur.
  function handleDomChanges() {
    const skipIntroButton = [...document.querySelectorAll('button')].find(button =>
      button.innerText.toLowerCase().includes('skip intro')
    );

    if (skipIntroButton) {
      skipIntroButton.click();
    }

    const skipCreditsButton = [...document.querySelectorAll('button')].find(button =>
      button.innerText.toLowerCase().includes('skip credits')
    );

    if (skipCreditsButton) {
      skipCreditsButton.click();
    }
  }

  const startObserver = () => {
    if (!document.body) {
      return false;
    }

    const observer = new MutationObserver(handleDomChanges);
    observer.observe(document.body, { childList: true, subtree: true });
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
  
