// Create and append speed slider to DOM
const speedSlider = () => {
  let controlContainer = document.querySelector('[data-testid="playerControlsContainer"]').children[1];
  let targetVideo = document.querySelector('video');

  let rangeInput = document.createElement('input');
  let speedLabel = document.createElement('label');

  speedLabel.value = targetVideo.playbackRate;
  rangeInput.value = targetVideo.playbackRate;
  rangeInput.id = 'speed-control';
  rangeInput.type = 'range';
  rangeInput.min = 1;
  rangeInput.max = 10;

  rangeInput.addEventListener('input', (e) => {
    speedLabel.value = targetVideo.playbackRate;
    targetVideo.playbackRate = e.target.value;
  }, false);

  controlContainer.appendChild(speedLabel);
  controlContainer.appendChild(rangeInput);
}

// Check when to add the speed slider
function onClassChange(element, callback) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === 'attributes' &&
        mutation.attributeName === 'class'
      ) {
        callback(mutation.target);
      }
    });
  });
  observer.observe(element, { attributes: true });
  return observer.disconnect;
}

var itemToWatch = document.querySelector('.application');
onClassChange(itemToWatch, (node) => {
  if (document.getElementById('speed-control') === null) {
    speedSlider();
    console.log('speed slider added')
  }
});


// Numpad speed controls
window.addEventListener("keypress", myEventHandler);

function myEventHandler(event) {
  let targetController = document.getElementById('speed-control');
  let targetVideo = document.querySelector('video');

  if (targetController !== null && targetVideo !== null) {
    switch (event.charCode) {
      case 49:
        targetController.value = 1;
        targetVideo.playbackRate = 1;
        break;
      case 50:
        targetController.value = 2;
        targetVideo.playbackRate = 2;
        break;
      case 51:
        targetController.value = 3;
        targetVideo.playbackRate = 3;
        break;
      case 52:
        targetController.value = 4;
        targetVideo.playbackRate = 4;
        break;
      case 53:
        targetController.value = 5;
        targetVideo.playbackRate = 5;
        break;
      case 54:
        targetController.value = 6;
        targetVideo.playbackRate = 6;
        break;
      case 55:
        targetController.value = 7;
        targetVideo.playbackRate = 7;
        break;
      case 56:
        targetController.value = 8;
        targetVideo.playbackRate = 8;
        break;
      case 57:
        targetController.value = 9;
        targetVideo.playbackRate = 9;
        break;
      default:
        break;
    }
  }
}