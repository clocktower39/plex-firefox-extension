// Define a callback function to be triggered when changes to the DOM occur
function handleDomChanges(mutationsList, observer) {
    // Check if the "Skip Intro" button has appeared on the screen
      const skipIntroButton = [...document.querySelectorAll('button')]
    .find(button => button.innerText.toLowerCase().includes('skip intro'));
  
      if (skipIntroButton) {
        skipIntroButton.click();
      }
      const skipCreditsButton = [...document.querySelectorAll('button')]
    .find(button => button.innerText.toLowerCase().includes('skip credits'));
  
      if (skipCreditsButton) {
        skipCreditsButton.click();
      }  
  }
  
  // Create a new MutationObserver instance and start observing changes to the DOM
  const observer = new MutationObserver(handleDomChanges);
  observer.observe(document.body, { childList: true, subtree: true });
  