(() => {
  const SETTINGS_DATASET_KEYS = {
    skipIntroEnabled: 'plexSkipIntroEnabled',
    skipCreditsEnabled: 'plexSkipCreditsEnabled'
  };

  const DEFAULT_SETTINGS = {
    [SETTINGS_DATASET_KEYS.skipIntroEnabled]: true,
    [SETTINGS_DATASET_KEYS.skipCreditsEnabled]: true
  };

  const STORAGE_KEY = 'plexExtensionSettings';
  const STORAGE_VERSION = 1;
  const CURRENT_LIBRARY_SESSION_KEY = 'plexExtensionCurrentLibrary';

  const SPEED_MIN = 1;
  const SPEED_MAX = 10;
  const DEFAULT_STEP = 1;
  const MIN_STEP = 0.05;
  const MAX_STEP = 1;
  const HOTKEY_SLOT_COUNT = 9;

  const isSupportedPlexPage = () => {
    const { hostname, port } = window.location;
    return hostname === 'app.plex.tv' || port === '32400';
  };

  if (!isSupportedPlexPage()) {
    return;
  }

  // ---------------------------------------------------------------------------
  // Persisted settings
  //
  // Shape:
  // {
  //   version: 1,
  //   lastStep: 1,                       // most recently chosen step, used when
  //                                      // the library cannot be detected
  //   libraries: {                       // per-library overrides
  //     "<machineId>:<sectionId>": { name: "Educational", step: 0.2 }
  //   },
  //   toggles: { plexSkipIntroEnabled: true, plexSkipCreditsEnabled: true }
  // }
  // ---------------------------------------------------------------------------
  const createEmptyStore = () => ({
    version: STORAGE_VERSION,
    lastStep: DEFAULT_STEP,
    libraries: {},
    toggles: { ...DEFAULT_SETTINGS }
  });

  const isValidStep = value => {
    return typeof value === 'number' && isFinite(value) && value >= MIN_STEP && value <= MAX_STEP;
  };

  const readStore = () => {
    const store = createEmptyStore();

    let raw = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return store;
    }

    if (!raw) {
      return store;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return store;
    }

    if (!parsed || typeof parsed !== 'object') {
      return store;
    }

    if (isValidStep(parsed.lastStep)) {
      store.lastStep = parsed.lastStep;
    }

    if (parsed.libraries && typeof parsed.libraries === 'object') {
      Object.entries(parsed.libraries).forEach(([key, value]) => {
        if (value && typeof value === 'object' && isValidStep(value.step)) {
          store.libraries[key] = {
            name: typeof value.name === 'string' ? value.name : '',
            step: value.step
          };
        }
      });
    }

    if (parsed.toggles && typeof parsed.toggles === 'object') {
      Object.keys(DEFAULT_SETTINGS).forEach(key => {
        if (typeof parsed.toggles[key] === 'boolean') {
          store.toggles[key] = parsed.toggles[key];
        }
      });
    }

    return store;
  };

  const store = readStore();

  const persistStore = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
      // Storage can be unavailable (private browsing, quota). Settings still
      // apply for the current page, they just will not survive a reload.
    }
  };

  // ---------------------------------------------------------------------------
  // Auto-skip toggles
  //
  // These live on documentElement.dataset because autoSkip.js reads them from
  // there. Hydrate them synchronously so autoSkip.js — which runs after this
  // file — sees the persisted values instead of seeding the defaults itself.
  // ---------------------------------------------------------------------------
  const getSetting = key => {
    const existingValue = document.documentElement.dataset[key];

    if (existingValue === undefined) {
      const defaultValue = DEFAULT_SETTINGS[key];
      document.documentElement.dataset[key] = String(defaultValue);
      return defaultValue;
    }

    return existingValue === 'true';
  };

  const setSetting = (key, value) => {
    document.documentElement.dataset[key] = String(value);
    store.toggles[key] = value;
    persistStore();
  };

  Object.keys(DEFAULT_SETTINGS).forEach(key => {
    document.documentElement.dataset[key] = String(store.toggles[key]);
  });

  // ---------------------------------------------------------------------------
  // Session scratch storage (per tab)
  // ---------------------------------------------------------------------------
  const readSessionValue = (key, isValid) => {
    try {
      const raw = window.sessionStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      return isValid(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  };

  const writeSessionValue = (key, value) => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Non-fatal: the value just will not survive a route change.
    }
  };

  // ---------------------------------------------------------------------------
  // Plex server connection discovery
  //
  // Plex Web has already talked to the server long before the player exists, so
  // the base URL and access token can be lifted straight out of the resource
  // timing buffer — no script injection, no page CSP to fight. Only plex.direct
  // and :32400 origins are ever considered, so the token is never sent anywhere
  // other than the Plex server that issued it.
  //
  // The buffer holds 250 entries by default and Plex Web fills it, so a
  // PerformanceObserver covers the case where the token-bearing request only
  // shows up after the buffer is full.
  // ---------------------------------------------------------------------------
  const CONNECTION_SESSION_KEY = 'plexExtensionConnection';

  const isPlexServerUrl = url => {
    return /^https?:\/\/[^/]*\.plex\.direct(:\d+)?\//i.test(url) || /^https?:\/\/[^/]+:32400\//.test(url);
  };

  const isConnectionShape = value => {
    return Boolean(value) && typeof value.origin === 'string' && typeof value.token === 'string';
  };

  let connection = readSessionValue(CONNECTION_SESSION_KEY, isConnectionShape);

  const captureConnectionFromUrl = url => {
    if (connection || typeof url !== 'string' || !isPlexServerUrl(url) || !/[?&]X-Plex-Token=/i.test(url)) {
      return;
    }

    let parsed = null;
    try {
      parsed = new URL(url);
    } catch (error) {
      return;
    }

    const token = parsed.searchParams.get('X-Plex-Token');

    if (!token) {
      return;
    }

    connection = { origin: parsed.origin, token };
    writeSessionValue(CONNECTION_SESSION_KEY, connection);
  };

  const discoverConnection = () => {
    if (connection) {
      return connection;
    }

    try {
      window.performance.getEntriesByType('resource').forEach(entry => captureConnectionFromUrl(entry.name));
    } catch (error) {
      // Resource timing unavailable; the observer below may still find it.
    }

    return connection;
  };

  const forgetConnection = () => {
    connection = null;
    try {
      window.sessionStorage.removeItem(CONNECTION_SESSION_KEY);
    } catch (error) {
      // Nothing to clean up.
    }
  };

  try {
    const resourceObserver = new PerformanceObserver(entryList => {
      if (connection) {
        resourceObserver.disconnect();
        return;
      }

      entryList.getEntries().forEach(entry => captureConnectionFromUrl(entry.name));
    });

    resourceObserver.observe({ type: 'resource', buffered: true });
  } catch (error) {
    // PerformanceObserver unsupported; discoverConnection() still covers the
    // entries already in the buffer.
  }

  // ---------------------------------------------------------------------------
  // Library detection
  //
  // The player route carries the item, not the library:
  //   #!/server/<machineId>/details?key=%2Flibrary%2Fmetadata%2F57875
  // Asking the server for that item's metadata yields librarySectionID and
  // librarySectionTitle, which works no matter how playback was started —
  // including straight from Continue Watching, where no library was ever
  // browsed. The result is cached per tab so route changes keep the context.
  // ---------------------------------------------------------------------------
  const isLibraryShape = value => Boolean(value) && typeof value.key === 'string';

  let currentLibrary = readSessionValue(CURRENT_LIBRARY_SESSION_KEY, isLibraryShape);
  let pendingRatingKey = null;
  let lastLookupFailed = false;

  const libraryByRatingKey = new Map();

  const getRatingKeyFromLocation = () => {
    const hash = window.location.hash || '';

    let decoded = hash;
    try {
      decoded = decodeURIComponent(hash);
    } catch (error) {
      // Malformed escape sequence; fall back to the raw hash.
    }

    const match = decoded.match(/\/library\/metadata\/(\d+)/);
    return match ? match[1] : null;
  };

  const getMachineIdFromLocation = () => {
    const match = (window.location.hash || '').match(/\/(?:media|server)\/([\w-]+)/);
    return match ? match[1] : 'unknown';
  };

  const fetchLibraryForRatingKey = async ratingKey => {
    if (libraryByRatingKey.has(ratingKey)) {
      return libraryByRatingKey.get(ratingKey);
    }

    const active = discoverConnection();

    if (!active) {
      return null;
    }

    let payload = null;
    try {
      const response = await fetch(`${active.origin}/library/metadata/${ratingKey}`, {
        headers: { Accept: 'application/json', 'X-Plex-Token': active.token }
      });

      if (!response.ok) {
        // A stale token is worth re-discovering on the next attempt.
        if (response.status === 401 || response.status === 403) {
          forgetConnection();
        }
        return null;
      }

      payload = await response.json();
    } catch (error) {
      return null;
    }

    const container = payload && payload.MediaContainer;
    const metadata = container && Array.isArray(container.Metadata) ? container.Metadata[0] : null;
    const sectionId = metadata ? metadata.librarySectionID : undefined;

    if (sectionId === undefined || sectionId === null) {
      return null;
    }

    const library = {
      key: `${getMachineIdFromLocation()}:${sectionId}`,
      name: typeof metadata.librarySectionTitle === 'string' ? metadata.librarySectionTitle : ''
    };

    libraryByRatingKey.set(ratingKey, library);
    return library;
  };

  const applyLibrary = (library, ratingKey) => {
    if (!library) {
      return;
    }

    const resolved = { key: library.key, name: library.name, ratingKey };
    const changed = !currentLibrary || currentLibrary.key !== resolved.key || currentLibrary.name !== resolved.name;

    currentLibrary = resolved;
    writeSessionValue(CURRENT_LIBRARY_SESSION_KEY, resolved);

    // Keep the stored label in step with a library that was renamed in Plex.
    const saved = store.libraries[resolved.key];
    if (saved && resolved.name && saved.name !== resolved.name) {
      saved.name = resolved.name;
      persistStore();
    }

    if (changed) {
      syncStepToControls();
    }
  };

  const forgetCurrentLibrary = () => {
    currentLibrary = null;
    try {
      window.sessionStorage.removeItem(CURRENT_LIBRARY_SESSION_KEY);
    } catch (error) {
      // Nothing to clean up.
    }
  };

  const refreshCurrentLibrary = () => {
    const ratingKey = getRatingKeyFromLocation();

    if (!ratingKey || pendingRatingKey === ratingKey) {
      return;
    }

    const cached = libraryByRatingKey.get(ratingKey);

    if (cached) {
      lastLookupFailed = false;
      applyLibrary(cached, ratingKey);
      return;
    }

    pendingRatingKey = ratingKey;
    lastLookupFailed = false;
    syncStepToControls();

    const settle = library => {
      if (pendingRatingKey === ratingKey) {
        pendingRatingKey = null;
      }

      // Drop a late response for an item that is no longer on screen.
      if (getRatingKeyFromLocation() === ratingKey) {
        lastLookupFailed = !library;

        if (library) {
          applyLibrary(library, ratingKey);
        } else if (currentLibrary && currentLibrary.ratingKey !== ratingKey) {
          // We have moved to a different item and cannot say which library it
          // belongs to. Holding on to the previous one would silently apply
          // that library's step to unrelated media.
          forgetCurrentLibrary();
        }
      }

      syncStepToControls();
    };

    fetchLibraryForRatingKey(ratingKey)
      .then(settle)
      .catch(() => settle(null));
  };

  const getLibraryDisplayName = () => {
    if (currentLibrary) {
      return currentLibrary.name || `Library ${currentLibrary.key.split(':').pop()}`;
    }

    if (pendingRatingKey) {
      return 'checking…';
    }

    // Distinguish "the server would not tell us" from "nothing to ask about".
    return lastLookupFailed ? 'lookup failed' : 'not detected';
  };

  // ---------------------------------------------------------------------------
  // Step resolution
  // ---------------------------------------------------------------------------
  const getActiveStep = () => {
    if (currentLibrary) {
      const saved = store.libraries[currentLibrary.key];
      // A library we have not seen before starts at the default step.
      return saved && isValidStep(saved.step) ? saved.step : DEFAULT_STEP;
    }

    return isValidStep(store.lastStep) ? store.lastStep : DEFAULT_STEP;
  };

  const saveActiveStep = step => {
    store.lastStep = step;

    if (currentLibrary) {
      store.libraries[currentLibrary.key] = { name: currentLibrary.name, step };
    }

    persistStore();
  };

  const getDecimalPlaces = value => {
    const text = String(value);
    const separatorIndex = text.indexOf('.');
    return separatorIndex === -1 ? 0 : text.length - separatorIndex - 1;
  };

  const snapSpeed = (value, step) => {
    const numeric = Number(value);

    if (!isFinite(numeric)) {
      return SPEED_MIN;
    }

    const slots = Math.round((numeric - SPEED_MIN) / step);
    const snapped = Number((SPEED_MIN + slots * step).toFixed(6));
    return Math.min(SPEED_MAX, Math.max(SPEED_MIN, snapped));
  };

  const formatSpeed = (value, step) => {
    return Number(value.toFixed(Math.max(getDecimalPlaces(step), 0))).toString();
  };

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  let rangeInput = null;
  let speedLabel = null;
  let stepInput = null;
  let libraryValueLabel = null;

  const applySpeed = speed => {
    const targetVideo = document.querySelector('video');
    const step = getActiveStep();
    const snapped = snapSpeed(speed, step);

    if (rangeInput) {
      rangeInput.value = snapped;
    }

    if (speedLabel) {
      speedLabel.textContent = `${formatSpeed(snapped, step)}x`;
    }

    if (targetVideo) {
      targetVideo.playbackRate = snapped;
    }

    return snapped;
  };

  // Re-applies the active step to the slider and re-snaps the current speed onto
  // the new grid.
  const syncStepToControls = () => {
    const step = getActiveStep();

    if (stepInput && document.activeElement !== stepInput) {
      stepInput.value = step;
    }

    if (libraryValueLabel) {
      libraryValueLabel.textContent = getLibraryDisplayName();
    }

    if (!rangeInput) {
      return;
    }

    rangeInput.step = step;
    applySpeed(rangeInput.value);
  };

  const changeStep = nextStep => {
    saveActiveStep(nextStep);
    syncStepToControls();
  };

  const createStepControl = () => {
    const container = document.createElement('div');
    const label = document.createElement('label');

    stepInput = document.createElement('input');
    stepInput.type = 'number';
    stepInput.id = 'speed-step-control';
    stepInput.min = MIN_STEP;
    stepInput.max = MAX_STEP;
    stepInput.step = 0.05;
    stepInput.value = getActiveStep();
    stepInput.style.width = '64px';
    stepInput.style.margin = '0';
    stepInput.style.padding = '2px 4px';
    stepInput.style.color = 'inherit';
    stepInput.style.background = 'rgba(255, 255, 255, 0.08)';
    stepInput.style.border = '1px solid rgba(255, 255, 255, 0.25)';
    stepInput.style.borderRadius = '4px';

    label.htmlFor = stepInput.id;
    label.innerText = 'Step';
    label.style.cursor = 'pointer';

    stepInput.addEventListener('input', () => {
      const parsed = Number(stepInput.value);

      // Ignore half-typed values such as "0." and keep the last valid step.
      if (isValidStep(parsed)) {
        changeStep(parsed);
      }
    });

    // Normalise whatever is left in the field once editing finishes.
    stepInput.addEventListener('change', () => {
      const parsed = Number(stepInput.value);
      const nextStep = isValidStep(parsed) ? parsed : getActiveStep();
      stepInput.value = nextStep;
      changeStep(nextStep);
    });

    // Plex has its own single-key shortcuts; keep them out of this field.
    stepInput.addEventListener('keydown', event => event.stopPropagation());
    stepInput.addEventListener('keypress', event => event.stopPropagation());

    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '6px';
    container.style.justifyContent = 'space-between';
    container.style.whiteSpace = 'nowrap';

    container.appendChild(label);
    container.appendChild(stepInput);

    return container;
  };

  const createLibraryRow = () => {
    const container = document.createElement('div');
    const label = document.createElement('span');

    libraryValueLabel = document.createElement('span');
    libraryValueLabel.textContent = getLibraryDisplayName();
    libraryValueLabel.style.opacity = '0.85';
    libraryValueLabel.style.maxWidth = '140px';
    libraryValueLabel.style.overflow = 'hidden';
    libraryValueLabel.style.textOverflow = 'ellipsis';

    label.innerText = 'Library';

    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '10px';
    container.style.justifyContent = 'space-between';
    container.style.whiteSpace = 'nowrap';
    container.style.fontSize = '12px';
    container.style.opacity = '0.8';

    container.appendChild(label);
    container.appendChild(libraryValueLabel);

    return container;
  };

  const createDivider = () => {
    const divider = document.createElement('div');
    divider.style.height = '1px';
    divider.style.background = 'rgba(255, 255, 255, 0.15)';
    divider.style.margin = '2px 0';
    return divider;
  };

  // Add speed slider controls
  const addFeatures = () => {
    const controlContainer = document.querySelector('[data-testid="playerControlsContainer"] > div:nth-child(2)');
    const targetVideo = document.querySelector('video');

    if (!controlContainer || !targetVideo || document.getElementById('speed-control')) {
      return;
    }

    refreshCurrentLibrary();

    const addedFeatureContainer = document.createElement('div');
    addedFeatureContainer.style.padding = '0px 5px';
    addedFeatureContainer.style.display = 'flex';
    addedFeatureContainer.style.alignItems = 'center';
    addedFeatureContainer.style.gap = '8px';
    addedFeatureContainer.style.position = 'relative';
    controlContainer.appendChild(addedFeatureContainer);

    const step = getActiveStep();

    rangeInput = document.createElement('input');
    speedLabel = document.createElement('label');

    const settingsPanel = createSettingsPanel();
    const settingsButton = createSettingsButton(settingsPanel);

    rangeInput.id = 'speed-control';
    rangeInput.type = 'range';
    rangeInput.min = SPEED_MIN;
    rangeInput.max = SPEED_MAX;
    rangeInput.step = step;
    rangeInput.value = snapSpeed(targetVideo.playbackRate, step);
    rangeInput.style.width = '96px';
    speedLabel.textContent = `${formatSpeed(snapSpeed(targetVideo.playbackRate, step), step)}x`;

    rangeInput.addEventListener('input', () => {
      applySpeed(rangeInput.value);
    });

    // Create and append the skip intro checkbox
    const skipIntroCheckbox = createCheckbox(
      'skip-intro-checkbox',
      'Intro',
      DEFAULT_SETTINGS[SETTINGS_DATASET_KEYS.skipIntroEnabled],
      SETTINGS_DATASET_KEYS.skipIntroEnabled
    );
    settingsPanel.appendChild(skipIntroCheckbox);

    // Create and append the skip credits checkbox
    const skipCreditsCheckbox = createCheckbox(
      'skip-credits-checkbox',
      'Credits',
      DEFAULT_SETTINGS[SETTINGS_DATASET_KEYS.skipCreditsEnabled],
      SETTINGS_DATASET_KEYS.skipCreditsEnabled
    );
    settingsPanel.appendChild(skipCreditsCheckbox);

    settingsPanel.appendChild(createDivider());
    settingsPanel.appendChild(createStepControl());
    settingsPanel.appendChild(createLibraryRow());

    addedFeatureContainer.appendChild(speedLabel);
    addedFeatureContainer.appendChild(rangeInput);
    addedFeatureContainer.appendChild(settingsButton);
    addedFeatureContainer.appendChild(settingsPanel);
  };

  // Function to create and append a checkbox
  function createCheckbox(id, label, defaultChecked, settingKey) {
    const checkboxContainer = document.createElement('div');
    const checkbox = document.createElement('input');
    const checkboxLabel = document.createElement('label');

    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = settingKey ? getSetting(settingKey) : defaultChecked;
    checkbox.style.margin = '0';
    checkboxLabel.htmlFor = id;
    checkboxLabel.innerText = label;
    checkboxLabel.style.cursor = 'pointer';

    if (settingKey) {
      checkbox.addEventListener('change', () => {
        setSetting(settingKey, checkbox.checked);
      });
    }

    checkboxContainer.style.display = 'flex';
    checkboxContainer.style.alignItems = 'center';
    checkboxContainer.style.gap = '6px';
    checkboxContainer.style.whiteSpace = 'nowrap';

    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(checkboxLabel);

    return checkboxContainer;
  }

  const createSettingsPanel = () => {
    const panel = document.createElement('div');
    panel.style.position = 'absolute';
    panel.style.right = '0';
    panel.style.bottom = 'calc(100% + 8px)';
    panel.style.display = 'none';
    panel.style.flexDirection = 'column';
    panel.style.gap = '6px';
    panel.style.padding = '10px 12px';
    panel.style.borderRadius = '8px';
    panel.style.background = 'rgba(24, 24, 24, 0.95)';
    panel.style.border = '1px solid rgba(255, 255, 255, 0.18)';
    panel.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.35)';
    panel.style.zIndex = '9999';

    // Clicks inside the panel should not reach the player underneath.
    panel.addEventListener('click', event => event.stopPropagation());

    return panel;
  };

  const createSettingsButton = settingsPanel => {
    const setPanelOpen = isOpen => {
      settingsPanel.style.display = isOpen ? 'flex' : 'none';
      button.setAttribute('aria-expanded', String(isOpen));

      if (isOpen) {
        refreshCurrentLibrary();
        syncStepToControls();
      }
    };

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Auto-skip options');
    button.setAttribute('aria-expanded', 'false');
    button.style.display = 'inline-flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.width = '28px';
    button.style.height = '28px';
    button.style.padding = '0';
    button.style.color = 'inherit';
    button.style.cursor = 'pointer';
    button.innerHTML = `
      <svg viewBox="0 0 30 30" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>settings</title> <desc>Created with Sketch Beta.</desc> <defs> </defs> <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" sketch:type="MSPage"> <g id="Icon-Set" sketch:type="MSLayerGroup" transform="translate(-101.000000, -360.000000)" fill="#000000"> <path d="M128.52,381.134 L127.528,382.866 C127.254,383.345 126.648,383.508 126.173,383.232 L123.418,381.628 C122.02,383.219 120.129,384.359 117.983,384.799 L117.983,387 C117.983,387.553 117.54,388 116.992,388 L115.008,388 C114.46,388 114.017,387.553 114.017,387 L114.017,384.799 C111.871,384.359 109.98,383.219 108.582,381.628 L105.827,383.232 C105.352,383.508 104.746,383.345 104.472,382.866 L103.48,381.134 C103.206,380.656 103.369,380.044 103.843,379.769 L106.609,378.157 C106.28,377.163 106.083,376.106 106.083,375 C106.083,373.894 106.28,372.838 106.609,371.843 L103.843,370.232 C103.369,369.956 103.206,369.345 103.48,368.866 L104.472,367.134 C104.746,366.656 105.352,366.492 105.827,366.768 L108.582,368.372 C109.98,366.781 111.871,365.641 114.017,365.201 L114.017,363 C114.017,362.447 114.46,362 115.008,362 L116.992,362 C117.54,362 117.983,362.447 117.983,363 L117.983,365.201 C120.129,365.641 122.02,366.781 123.418,368.372 L126.173,366.768 C126.648,366.492 127.254,366.656 127.528,367.134 L128.52,368.866 C128.794,369.345 128.631,369.956 128.157,370.232 L125.391,371.843 C125.72,372.838 125.917,373.894 125.917,375 C125.917,376.106 125.72,377.163 125.391,378.157 L128.157,379.769 C128.631,380.044 128.794,380.656 128.52,381.134 L128.52,381.134 Z M130.008,378.536 L127.685,377.184 C127.815,376.474 127.901,375.749 127.901,375 C127.901,374.252 127.815,373.526 127.685,372.816 L130.008,371.464 C130.957,370.912 131.281,369.688 130.733,368.732 L128.75,365.268 C128.203,364.312 126.989,363.983 126.041,364.536 L123.694,365.901 C122.598,364.961 121.352,364.192 119.967,363.697 L119.967,362 C119.967,360.896 119.079,360 117.983,360 L114.017,360 C112.921,360 112.033,360.896 112.033,362 L112.033,363.697 C110.648,364.192 109.402,364.961 108.306,365.901 L105.959,364.536 C105.011,363.983 103.797,364.312 103.25,365.268 L101.267,368.732 C100.719,369.688 101.044,370.912 101.992,371.464 L104.315,372.816 C104.185,373.526 104.099,374.252 104.099,375 C104.099,375.749 104.185,376.474 104.315,377.184 L101.992,378.536 C101.044,379.088 100.719,380.312 101.267,381.268 L103.25,384.732 C103.797,385.688 105.011,386.017 105.959,385.464 L108.306,384.099 C109.402,385.039 110.648,385.809 112.033,386.303 L112.033,388 C112.033,389.104 112.921,390 114.017,390 L117.983,390 C119.079,390 119.967,389.104 119.967,388 L119.967,386.303 C121.352,385.809 122.598,385.039 123.694,384.099 L126.041,385.464 C126.989,386.017 128.203,385.688 128.75,384.732 L130.733,381.268 C131.281,380.312 130.957,379.088 130.008,378.536 L130.008,378.536 Z M116,378 C114.357,378 113.025,376.657 113.025,375 C113.025,373.344 114.357,372 116,372 C117.643,372 118.975,373.344 118.975,375 C118.975,376.657 117.643,378 116,378 L116,378 Z M116,370 C113.261,370 111.042,372.238 111.042,375 C111.042,377.762 113.261,380 116,380 C118.739,380 120.959,377.762 120.959,375 C120.959,372.238 118.739,370 116,370 L116,370 Z" id="settings" sketch:type="MSShapeGroup"> </path> </g> </g> </g></svg>
    `;

    button.addEventListener('click', event => {
      event.preventDefault();
      const isOpen = settingsPanel.style.display !== 'none';
      setPanelOpen(!isOpen);
    });

    return button;
  };

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

  refreshCurrentLibrary();

  // Plex Web is a single page app that routes with history.pushState, which
  // fires neither hashchange nor popstate. Both events are still handled for
  // the cases that do fire them, but the URL has to be polled to reliably catch
  // a move to a different show.
  let lastObservedHref = window.location.href;

  const handleLocationChange = () => {
    if (window.location.href === lastObservedHref) {
      return;
    }

    lastObservedHref = window.location.href;
    refreshCurrentLibrary();
  };

  window.addEventListener('hashchange', handleLocationChange);
  window.addEventListener('popstate', handleLocationChange);
  window.setInterval(handleLocationChange, 1000);

  // Speed controls with number input: key N selects the Nth slider position, so
  // the step setting decides how far apart those speeds are.
  const isEditableTarget = target => {
    if (!target || !target.tagName) {
      return false;
    }

    const tagName = target.tagName.toUpperCase();
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable === true;
  };

  const handleKeyPress = event => {
    if (isEditableTarget(event.target)) {
      return;
    }

    const targetController = document.getElementById('speed-control');
    const targetVideo = document.querySelector('video');

    if (!targetController || !targetVideo) {
      return;
    }

    const slot = Number(event.key);

    if (!Number.isInteger(slot) || slot < 1 || slot > HOTKEY_SLOT_COUNT) {
      return;
    }

    applySpeed(SPEED_MIN + (slot - 1) * getActiveStep());
  };

  window.addEventListener('keypress', handleKeyPress);
})();
