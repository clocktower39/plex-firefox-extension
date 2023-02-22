// Add speed slider controls
const addSpeedSlider = () => {
  const controlContainer = document.querySelector('[data-testid="playerControlsContainer"] > div:nth-child(2)');
  const targetVideo = document.querySelector('video');

  if (!controlContainer || !targetVideo) {
    return;
  }

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

  controlContainer.appendChild(speedLabel);
  controlContainer.appendChild(rangeInput);
  console.log('speed slider added');
}

// use Mutation Observer to detect when speed slider needs to be appended
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
}

const itemToWatch = document.querySelector('.application');
const disconnectObserver = onClassChange(itemToWatch, node => {
  if (!document.getElementById('speed-control')) {
    addSpeedSlider();
  }
});

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
}

window.addEventListener('keypress', handleKeyPress);
