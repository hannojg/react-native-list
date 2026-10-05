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
  const animations = { sync: window.syncRendering, async: window.asyncRendering };
  const animationPlayers = Object.values(animations);
  const scrollHashes = ['-scroll', '-scroll-30', '-scroll-20'];
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

  function activeAnimation() {
    const name = slides[current].dataset.animation;
    return animations[name];
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
    const animation = activeAnimation();
    const hasAnimation = Boolean(animation) && build;
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
    const slide = slides[current];
    const animation = activeAnimation();
    let suffix = build ? '-build' : '';
    if (build && slide.dataset.animation === 'sync' && animation.scrolling) {
      suffix = scrollHashes[animation.scrollPhase];
    }
    if (build && slide.dataset.animation === 'async' && animation.stepIndex >= 0) {
      suffix = `-async-${animation.stepIndex + 1}`;
    }
    const hash = `#slide-${current + 1}${suffix}`;
    history.replaceState(null, '', hash);
  }

  function hasBuild(slide) {
    return Boolean(slide.dataset.animation) || slide.dataset.transition === 'shared-header';
  }

  function setBuild(showBuild, lastStep = false, animate = false) {
    const slide = slides[current];
    const animation = activeAnimation();
    build = hasBuild(slide) && showBuild;
    if (animation) {
      if (build) animation.reset(lastStep);
      else animation.pause();
    }
    if (slide.dataset.animation === 'sync') {
      const animationBuild = slide.querySelector('.animation-build');
      animationBuild.hidden = build === false;
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
    for (const animation of animationPlayers) animation.pause();
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
    const animation = activeAnimation();
    if (hasBuild(slide) && build === false) {
      setBuild(true, false, true);
      return;
    }
    if (build && animation) {
      const advanced = animation.nextStep();
      if (advanced) {
        writeHash();
        return;
      }
    }
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
      const animation = activeAnimation();
      if (animation) {
        const reversed = animation.previousStep();
        if (reversed) {
          writeHash();
          return;
        }
      }
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
    const animation = activeAnimation();
    if (build && animation) {
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
    const animation = activeAnimation();
    if (build && animation) animation.replay();
    else {
      const video = activeVideo();
      if (video === null) return;
      slides[current].dataset.videoStarted = 'true';
      video.currentTime = 0;
      playVideo(video);
    }
    updateMediaControls();
    writeHash();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }

  function readHash() {
    const match = location.hash.match(/^#slide-(\d+)(-build|-scroll(?:-(30|20))?|-async-(\d+))?$/);
    if (match) {
      const number = Number(match[1]);
      const showBuild = Boolean(match[2]);
      show(number - 1, showBuild);
      const animation = activeAnimation();
      const scrollBuild = match[2] && match[2].startsWith('-scroll');
      if (scrollBuild && slides[current].dataset.animation === 'sync') {
        const phaseIndex = match[3] === '20' ? 2 : match[3] === '30' ? 1 : 0;
        animation.startScroll(phaseIndex);
        writeHash();
      }
      if (match[4] && slides[current].dataset.animation === 'async') {
        const step = Number(match[4]);
        animation.startStep(step - 1);
        writeHash();
      }
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
      for (const animation of animationPlayers) animation.pause();
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
