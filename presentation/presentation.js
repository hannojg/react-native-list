(() => {
  const deck = document.getElementById('deck');
  const slideElements = document.querySelectorAll('.slide');
  const slides = Array.from(slideElements);
  const counter = document.getElementById('counter');
  const previousButton = document.getElementById('previous');
  const nextButton = document.getElementById('next');
  const mediaButton = document.getElementById('media');
  const replayButton = document.getElementById('replay');
  const fullscreenButton = document.getElementById('fullscreen');
  const helpButton = document.getElementById('help-button');
  const help = document.getElementById('help');
  const closeHelp = document.getElementById('close-help');
  const animation = window.syncRendering;
  let current = 0;
  let build = false;
  let controlsTimer;

  function resize() {
    const widthScale = window.innerWidth / 1920;
    const heightScale = window.innerHeight / 1080;
    const scale = Math.min(widthScale, heightScale);
    deck.style.setProperty('--scale', scale);
  }

  function activeVideo() {
    return slides[current].querySelector('video');
  }

  async function playVideo(video) {
    try {
      await video.play();
    } catch (error) {
      if (error.name === 'AbortError') return;
      throw error;
    }
  }

  function updateMediaControls() {
    const video = activeVideo();
    const hasAnimation = slides[current].dataset.animation === 'sync' && build;
    const hasMedia = Boolean(video) || hasAnimation;
    mediaButton.hidden = hasMedia === false;
    replayButton.hidden = hasMedia === false;
    const playing = hasAnimation ? animation.playing : video && video.paused === false;
    mediaButton.textContent = playing ? 'Pause' : 'Play';
    replayButton.textContent = hasAnimation ? 'Restart' : 'Replay';
    replayButton.title = hasAnimation ? 'Restart animation (R)' : 'Replay (R)';
  }

  function showControls() {
    document.body.classList.add('show-controls');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
      document.body.classList.remove('show-controls');
    }, 1800);
  }

  function writeHash() {
    const suffix = build ? '-build' : '';
    const hash = `#slide-${current + 1}${suffix}`;
    history.replaceState(null, '', hash);
  }

  function hasBuild(slide) {
    return slide.dataset.animation === 'sync' || slide.dataset.transition === 'shared-header';
  }

  function setBuild(showBuild, lastStep = false, animate = false) {
    const slide = slides[current];
    build = hasBuild(slide) && showBuild;
    if (slide.dataset.animation === 'sync') {
      const animationBuild = slide.querySelector('.animation-build');
      animationBuild.hidden = build === false;
      if (build) animation.reset(lastStep);
    }
    if (slide.dataset.transition === 'shared-header') {
      slide.dataset.transitionMotion = animate ? 'animate' : 'instant';
      slide.dataset.buildState = build ? 'content' : 'intro';
      const contentElements = slide.querySelectorAll('[data-build-content]');
      for (const content of contentElements) {
        content.inert = build === false;
        const hidden = String(build === false);
        content.setAttribute('aria-hidden', hidden);
      }
    }
    updateMediaControls();
    writeHash();
  }

  function show(index, showBuild = false, lastStep = false) {
    animation.pause();
    for (const slide of slides) {
      slide.hidden = true;
      const video = slide.querySelector('video');
      if (video) {
        video.pause();
        video.currentTime = 0;
        slide.dataset.videoStarted = 'false';
      }
    }
    const boundedIndex = Math.max(0, index);
    current = Math.min(slides.length - 1, boundedIndex);
    const slide = slides[current];
    slide.hidden = false;
    setBuild(showBuild, lastStep);
    counter.value = `${current + 1} / ${slides.length}`;
    previousButton.disabled = current === 0;
    nextButton.disabled = current === slides.length - 1 && activeVideo() === null;
  }

  function next() {
    const slide = slides[current];
    if (hasBuild(slide) && build === false) {
      setBuild(true, false, true);
      return;
    }
    if (build && slide.dataset.animation === 'sync' && animation.nextStep()) return;
    const video = activeVideo();
    if (video && slide.dataset.videoStarted !== 'true') {
      slide.dataset.videoStarted = 'true';
      playVideo(video);
      return;
    }
    if (current < slides.length - 1) show(current + 1);
  }

  function previous() {
    if (build) {
      const slide = slides[current];
      if (slide.dataset.animation === 'sync' && animation.previousStep()) return;
      setBuild(false, false, true);
      return;
    }
    if (current > 0) {
      const previousIndex = current - 1;
      const previousSlide = slides[previousIndex];
      const showBuild = hasBuild(previousSlide);
      show(previousIndex, showBuild, true);
    }
  }

  function toggleMedia() {
    if (build && slides[current].dataset.animation === 'sync') {
      if (animation.playing) animation.pause();
      else animation.play();
    } else {
      const video = activeVideo();
      if (video === null) return;
      slides[current].dataset.videoStarted = 'true';
      if (video.paused) playVideo(video);
      else video.pause();
    }
    updateMediaControls();
  }

  function replay() {
    if (build && slides[current].dataset.animation === 'sync') animation.replay();
    else {
      const video = activeVideo();
      if (video === null) return;
      slides[current].dataset.videoStarted = 'true';
      video.currentTime = 0;
      playVideo(video);
    }
    updateMediaControls();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }

  function readHash() {
    const match = location.hash.match(/^#slide-(\d+)(-build)?$/);
    if (match) {
      const number = Number(match[1]);
      const showBuild = Boolean(match[2]);
      show(number - 1, showBuild);
    } else show(0);
  }

  window.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    if (help.open) return;
    const key = event.key.toLowerCase();
    const isButton = event.target instanceof HTMLButtonElement;
    if (isButton && (key === ' ' || key === 'enter')) return;
    const actions = {
      arrowright: next,
      ' ': next,
      pagedown: next,
      arrowleft: previous,
      pageup: previous,
      home: () => show(0),
      end: () => show(slides.length - 1),
      f: toggleFullscreen,
      p: toggleMedia,
      r: replay,
      '?': () => help.showModal()
    };
    const action = actions[key];
    if (action) {
      event.preventDefault();
      action();
      document.body.classList.remove('show-controls');
    }
  });
  previousButton.addEventListener('click', previous);
  nextButton.addEventListener('click', next);
  mediaButton.addEventListener('click', toggleMedia);
  replayButton.addEventListener('click', replay);
  fullscreenButton.addEventListener('click', toggleFullscreen);
  helpButton.addEventListener('click', () => help.showModal());
  closeHelp.addEventListener('click', () => help.close());
  window.addEventListener('resize', resize);
  window.addEventListener('hashchange', readHash);
  window.addEventListener('pointermove', showControls);
  window.addEventListener('media-state-change', updateMediaControls);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      animation.pause();
      const video = activeVideo();
      if (video) video.pause();
      updateMediaControls();
    }
  });
  for (const slide of slides) {
    const video = slide.querySelector('video');
    if (video) {
      video.addEventListener('click', toggleMedia);
      video.addEventListener('play', updateMediaControls);
      video.addEventListener('pause', updateMediaControls);
      video.addEventListener('ended', updateMediaControls);
    }
  }
  document.addEventListener('fullscreenchange', () => {
    fullscreenButton.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
  });
  resize();
  readHash();
})();
