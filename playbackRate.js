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
        console.log(e);
      	speedLabel.value = targetVideo.playbackRate; 
        targetVideo.playbackRate = e.target.value;
    }, false);

    controlContainer.appendChild(speedLabel);
    controlContainer.appendChild(rangeInput);
}

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
  if(document.getElementById('speed-control') === null){
    speedSlider();
    console.log('speed slider added')
  }
});