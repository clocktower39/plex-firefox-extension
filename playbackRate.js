(() => {
  const isSupportedPlexPage = () => {
    const { hostname, port } = window.location;
    return hostname === 'app.plex.tv' || port === '32400';
  };

  if (!isSupportedPlexPage()) {
    return;
  }

  // Add speed slider controls
  const addFeatures = () => {
    const controlContainer = document.querySelector('[data-testid="playerControlsContainer"] > div:nth-child(2)');
    const targetVideo = document.querySelector('video');

    if (!controlContainer || !targetVideo || document.getElementById('speed-control')) {
      return;
    }

    const addedFeatureContainer = document.createElement('div');
    addedFeatureContainer.style.padding = '0px 5px';
    controlContainer.appendChild(addedFeatureContainer);

    const rangeInput = document.createElement('input');
    const speedLabel = document.createElement('label');

    speedLabel.value = targetVideo.playbackRate;
    rangeInput.id = 'speed-control';
    rangeInput.type = 'range';
    rangeInput.min = 1;
    rangeInput.max = 10;
    rangeInput.value = targetVideo.playbackRate;

    rangeInput.addEventListener('input', () => {
      speedLabel.value = rangeInput.value;
      targetVideo.playbackRate = rangeInput.value;
    });

    // Create and append the skip intro checkbox
    const skipIntroCheckbox = createCheckbox('skip-intro-checkbox', 'Intro', true);
    addedFeatureContainer.appendChild(skipIntroCheckbox);

    // Create and append the skip credits checkbox
    const skipCreditsCheckbox = createCheckbox('skip-credits-checkbox', 'Credits', false);
    addedFeatureContainer.appendChild(skipCreditsCheckbox);

    addedFeatureContainer.appendChild(speedLabel);
    addedFeatureContainer.appendChild(rangeInput);
  };

  // Function to create and append a checkbox
  function createCheckbox(id, label, defaultChecked) {
    const checkboxContainer = document.createElement('div');
    const checkbox = document.createElement('input');
    const checkboxLabel = document.createElement('label');

    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = defaultChecked;
    checkboxLabel.htmlFor = id;
    checkboxLabel.innerText = label;

    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(checkboxLabel);

    // Apply initial visibility based on current window width
    checkboxContainer.style.display = window.innerWidth >= 960 ? '' : 'none';

    // Event listener to adjust visibility on window resize
    window.addEventListener('resize', () => {
      checkboxContainer.style.display = window.innerWidth >= 960 ? '' : 'none';
    });

    return checkboxContainer;
  }

  // Use a MutationObserver to detect when speed slider needs to be appended.
  const onClassChange = (element, callback) => {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          callback(mutation.target);
        }
      });
    });
    observer.observe(element, { attributes: true });
    return () => observer.disconnect();
  };

  const startWatchingPlayer = () => {
    const itemToWatch = document.querySelector('.application');

    if (!itemToWatch) {
      return false;
    }

    onClassChange(itemToWatch, () => {
      addFeatures();
    });
    addFeatures();
    return true;
  };

  if (!startWatchingPlayer()) {
    const bootObserver = new MutationObserver(() => {
      if (startWatchingPlayer()) {
        bootObserver.disconnect();
      }
    });

    bootObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Speed controls with number input
  const handleKeyPress = event => {
    const targetController = document.getElementById('speed-control');
    const targetVideo = document.querySelector('video');

    if (!targetController || !targetVideo) {
      return;
    }

    const speeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const speedIndex = speeds.findIndex(speed => speed.toString() === event.key);

    if (speedIndex >= 0) {
      targetController.value = speeds[speedIndex];
      targetVideo.playbackRate = speeds[speedIndex];
    }
  };

  window.addEventListener('keypress', handleKeyPress);
})();
