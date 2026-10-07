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
  const animations = { sync: window.syncRendering, async: window.asyncRendering, runtime: window.runtimeHandoff };
  const animationPlayers = Object.values(animations);
  const scrollHashes = ['-scroll', '-scroll-30', '-scroll-20'];
  let current = 0;
  let build = false;
  let controlsTimer;
  let slideBlend;

  function resize() {
    const widthScale = window.innerWidth / 1920;
    const heightScale = window.innerHeight / 1080;
    const scale = Math.min(widthScale, heightScale);
    deck.style.setProperty('--scale', scale);
  }

  function activeVideo() {
    return slides[current].querySelector('video');
  }

  function activeVideos() {
    const elements = slides[current].querySelectorAll('video');
    return Array.from(elements);
  }

  function videosPlaying() {
    const videos = activeVideos();
    return videos.some(video => video.paused === false && video.ended === false);
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

  async function playVideos() {
    const videos = activeVideos();
    const starts = [];
    for (const video of videos) {
      const start = playVideo(video);
      starts.push(start);
    }
    await Promise.all(starts);
  }

  function updateMediaControls() {
    const video = activeVideo();
    const animation = activeAnimation();
    const hasAnimation = Boolean(animation) && build;
    const hasMedia = Boolean(video) || hasAnimation;
    mediaButton.hidden = hasMedia === false;
    replayButton.hidden = hasMedia === false;
    const playing = hasAnimation ? animation.playing : videosPlaying();
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
    const steppedAnimation = slide.dataset.animation === 'async' || slide.dataset.animation === 'runtime';
    if (build && steppedAnimation && animation.stepIndex >= 0) {
      suffix = `-${slide.dataset.animation}-${animation.stepIndex + 1}`;
    }
    const revealStep = Number(slide.dataset.revealStep);
    if (revealStep > 0) suffix = `-step-${revealStep}`;
    const hash = `#slide-${current + 1}${suffix}`;
    history.replaceState(null, '', hash);
  }

  function hasBuild(slide) {
    return Boolean(slide.dataset.animation) || slide.dataset.transition === 'shared-header';
  }

  function lastRevealStep(slide) {
    if (slide.classList.contains('shop-teaser')) return 1;
    const reveals = slide.querySelectorAll('[data-reveal-step]');
    let lastStep = 0;
    for (const reveal of reveals) {
      const step = Number(reveal.dataset.revealStep);
      lastStep = Math.max(lastStep, step);
    }
    return lastStep;
  }

  function updateNextButton() {
    const slide = slides[current];
    const revealStep = Number(slide.dataset.revealStep ?? 0);
    const finalStep = lastRevealStep(slide);
    const pendingReveal = revealStep < finalStep;
    const atEnd = current === slides.length - 1;
    nextButton.disabled = atEnd && activeVideo() === null && pendingReveal === false;
  }

  function setRevealStep(step) {
    const slide = slides[current];
    const reveals = slide.querySelectorAll('[data-reveal-step]');
    const lowerBound = Math.max(0, step);
    const lastStep = lastRevealStep(slide);
    const boundedStep = Math.min(lastStep, lowerBound);
    slide.dataset.revealStep = String(boundedStep);
    if (slide.classList.contains('shop-teaser')) selectTeaserRun(slide, boundedStep);
    for (const reveal of reveals) {
      const wasHidden = reveal.hidden;
      const revealIndex = Number(reveal.dataset.revealStep);
      reveal.hidden = revealIndex > boundedStep;
      const entering = wasHidden && reveal.hidden === false;
      if (entering && reveal.classList.contains('list-guarantee')) stampGuarantee(reveal);
    }
    updateNextButton();
  }

  function stampGuarantee(element) {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches) return;
    element.animate([
      { opacity: 0, transform: 'rotate(-20deg) scale(1.4)' },
      { opacity: 1, transform: 'rotate(-12deg) scale(.96)', offset: .7 },
      { opacity: 1, transform: 'rotate(-12deg) scale(1)' }
    ], { duration: 450, easing: 'ease-out' });
  }

  function setBuild(showBuild, lastStep = false, animate = false) {
    const slide = slides[current];
    const animation = activeAnimation();
    build = hasBuild(slide) && showBuild;
    if (animation) {
      if (build) animation.reset(lastStep);
      else animation.pause();
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
    const reveals = slide.querySelectorAll('[data-reveal-step]');
    if (reveals.length > 0 || slide.classList.contains('shop-teaser')) {
      const revealContentVisible = build || hasBuild(slide) === false;
      const finalStep = lastRevealStep(slide);
      const revealStep = revealContentVisible && lastStep ? finalStep : 0;
      setRevealStep(revealStep);
    }
    updateMediaControls();
    writeHash();
  }

  function show(index, showBuild = false, lastStep = false) {
    if (slideBlend) {
      slideBlend.cleanup();
      slideBlend = undefined;
    }
    window.pillMix.stop();
    for (const animation of animationPlayers) animation.pause();
    for (const slide of slides) {
      slide.hidden = true;
      const videos = slide.querySelectorAll('video');
      for (const video of videos) {
        video.pause();
        video.currentTime = 0;
        slide.dataset.videoStarted = 'false';
      }
    }
    const boundedIndex = Math.max(0, index);
    current = Math.min(slides.length - 1, boundedIndex);
    const slide = slides[current];
    slide.hidden = false;
    if (slide.classList.contains('pill-mix')) window.pillMix.enter(lastStep);
    setBuild(showBuild, lastStep);
    counter.value = `${current + 1} / ${slides.length}`;
    previousButton.disabled = current === 0;
    updateNextButton();
  }

  async function blendToNext() {
    const outgoing = slides[current];
    show(current + 1);
    outgoing.hidden = false;
    const incoming = slides[current];
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const duration = motionPreference.matches ? 0 : 700;
    const animation = incoming.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration,
      easing: 'ease-out'
    });
    const cleanup = () => {
      animation.cancel();
      outgoing.hidden = true;
    };
    const blend = { cleanup };
    slideBlend = blend;
    try {
      await animation.finished;
    } catch (error) {
      if (error.name === 'AbortError') return;
      throw error;
    }
    if (slideBlend !== blend) return;
    cleanup();
    slideBlend = undefined;
  }

  async function transitionListHeader() {
    const outgoing = slides[current];
    const sourceTitle = outgoing.querySelector('.list-introduction-title');
    const sourceBounds = sourceTitle.getBoundingClientRect();
    const sourceStyle = window.getComputedStyle(sourceTitle);
    const sourceFontSize = sourceStyle.fontSize;
    const sourceLineHeight = sourceStyle.lineHeight;
    const sourceColor = sourceStyle.color;
    const sourceShadow = sourceStyle.textShadow;
    const departingElements = outgoing.querySelectorAll('.list-introduction-gif, .list-guarantee');
    const departures = [];
    for (const element of departingElements) {
      const style = window.getComputedStyle(element);
      departures.push({ element, transform: style.transform, opacity: style.opacity });
    }
    show(current + 1);
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches) return;
    const incoming = slides[current];
    const title = incoming.querySelector('.slide-title');
    const targetBounds = title.getBoundingClientRect();
    const targetStyle = window.getComputedStyle(title);
    const deckBounds = deck.getBoundingClientRect();
    const scale = deckBounds.width / 1920;
    const dx = (sourceBounds.left - targetBounds.left) / scale;
    const dy = (sourceBounds.top - targetBounds.top) / scale;
    outgoing.hidden = false;
    sourceTitle.style.visibility = 'hidden';
    incoming.classList.add('header-bridging');
    const titleMotion = title.animate([
      {
        transform: `translate(${dx}px, ${dy}px)`,
        fontSize: sourceFontSize,
        lineHeight: sourceLineHeight,
        color: sourceColor,
        textShadow: sourceShadow
      },
      {
        transform: 'none',
        fontSize: targetStyle.fontSize,
        lineHeight: targetStyle.lineHeight,
        color: targetStyle.color,
        textShadow: 'none'
      }
    ], { duration: 700, easing: 'cubic-bezier(.22,.75,.2,1)' });
    const animations = [titleMotion];
    for (const departure of departures) {
      const fade = departure.element.animate([
        { opacity: departure.opacity, transform: departure.transform },
        { opacity: 0, transform: departure.transform }
      ], {
        duration: 550,
        fill: 'forwards'
      });
      animations.push(fade);
    }
    const content = incoming.querySelectorAll('.slide-subtitle, .worklets-code');
    for (const element of content) {
      const reveal = element.animate([
        { opacity: 0, transform: 'translateY(14px)' },
        { opacity: 1, transform: 'none' }
      ], { duration: 350, delay: 350, fill: 'both', easing: 'ease-out' });
      animations.push(reveal);
    }
    const cleanup = () => {
      for (const animation of animations) animation.cancel();
      outgoing.hidden = true;
      sourceTitle.style.visibility = '';
      incoming.classList.remove('header-bridging');
    };
    const blend = { cleanup };
    slideBlend = blend;
    try {
      await titleMotion.finished;
    } catch (error) {
      if (error.name === 'AbortError') return;
      throw error;
    }
    if (slideBlend !== blend) return;
    cleanup();
    slideBlend = undefined;
  }

  async function shuffleCoverTitle(index) {
    const outgoing = slides[current];
    show(index);
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches) return;
    const incoming = slides[current];
    outgoing.hidden = false;
    incoming.classList.add('header-bridging');
    const source = outgoing.querySelector('.cover-title');
    const target = incoming.querySelector('.cover-title');
    const shuffle = window.titleShuffle.create(source, target, deck);
    const animations = [];
    const outgoingSubtitle = outgoing.querySelector('.cover-subtitle');
    if (outgoingSubtitle) {
      const fade = outgoingSubtitle.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 350,
        fill: 'forwards'
      });
      animations.push(fade);
    }
    const incomingSubtitle = incoming.querySelector('.cover-subtitle');
    if (incomingSubtitle) {
      const fade = incomingSubtitle.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 400,
        delay: 650,
        fill: 'both'
      });
      animations.push(fade);
    }
    const cleanup = () => {
      shuffle.cleanup();
      for (const animation of animations) animation.cancel();
      outgoing.hidden = true;
      incoming.classList.remove('header-bridging');
    };
    const blend = { cleanup };
    slideBlend = blend;
    try {
      await shuffle.finished;
    } catch (error) {
      if (error.name === 'AbortError') return;
      throw error;
    }
    if (slideBlend !== blend) return;
    cleanup();
    slideBlend = undefined;
  }

  async function transitionNativeCreate(index) {
    const outgoing = slides[current];
    const source = outgoing.querySelector('.native-api-create');
    const sourceBounds = source.getBoundingClientRect();
    const sourceHeading = source.querySelector('h2');
    const sourceStyle = window.getComputedStyle(sourceHeading);
    const sourceFontSize = sourceStyle.fontSize;
    const sourceLineHeight = sourceStyle.lineHeight;
    show(index);
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches) return;
    const incoming = slides[current];
    const target = incoming.querySelector('.native-api-create');
    const targetBounds = target.getBoundingClientRect();
    const targetHeading = target.querySelector('h2');
    const targetStyle = window.getComputedStyle(targetHeading);
    const deckBounds = deck.getBoundingClientRect();
    const scale = deckBounds.width / 1920;
    const dx = (sourceBounds.left - targetBounds.left) / scale;
    const dy = (sourceBounds.top - targetBounds.top) / scale;
    outgoing.hidden = false;
    source.style.visibility = 'hidden';
    incoming.classList.add('header-bridging');
    const movement = target.animate([
      { transform: `translate(${dx}px, ${dy}px)` },
      { transform: 'none' }
    ], { duration: 700, easing: 'cubic-bezier(.22,.75,.2,1)' });
    const heading = targetHeading.animate([
      { fontSize: sourceFontSize, lineHeight: sourceLineHeight },
      { fontSize: targetStyle.fontSize, lineHeight: targetStyle.lineHeight }
    ], { duration: 700, easing: 'cubic-bezier(.22,.75,.2,1)' });
    const animations = [movement, heading];
    const remainderSelector = '.slide-title, .native-api-intro, .native-api-bind, .native-create-points';
    const departingElements = outgoing.querySelectorAll(remainderSelector);
    for (const element of departingElements) {
      const fade = element.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 250,
        fill: 'forwards'
      });
      animations.push(fade);
    }
    const arrivingElements = incoming.querySelectorAll(remainderSelector);
    for (const element of arrivingElements) {
      const reveal = element.animate([
        { opacity: 0, transform: 'translateY(14px)' },
        { opacity: 1, transform: 'none' }
      ], { duration: 350, delay: 350, fill: 'both', easing: 'ease-out' });
      animations.push(reveal);
    }
    const cleanup = () => {
      for (const animation of animations) animation.cancel();
      outgoing.hidden = true;
      source.style.visibility = '';
      incoming.classList.remove('header-bridging');
    };
    const blend = { cleanup };
    slideBlend = blend;
    try {
      await movement.finished;
    } catch (error) {
      if (error.name === 'AbortError') return;
      throw error;
    }
    if (slideBlend !== blend) return;
    cleanup();
    slideBlend = undefined;
  }

  async function transitionPipelineRight() {
    const outgoing = slides[current];
    const sourceThread = outgoing.querySelector('.pipeline-thread');
    const sourceBounds = sourceThread.getBoundingClientRect();
    const sourceNodes = outgoing.querySelectorAll('.pipeline-node');
    const nodeStyles = [];
    for (const node of sourceNodes) {
      const style = window.getComputedStyle(node);
      nodeStyles.push({ node, borderColor: style.borderColor, backgroundColor: style.backgroundColor });
    }
    show(current + 1);
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches) return;
    const incoming = slides[current];
    const targetThread = incoming.querySelector('.pipeline-thread');
    const targetBounds = targetThread.getBoundingClientRect();
    const deckBounds = deck.getBoundingClientRect();
    const scale = deckBounds.width / 1920;
    const dx = (targetBounds.left - sourceBounds.left) / scale;
    const duration = 850;
    const easing = 'cubic-bezier(.22,.75,.2,1)';
    outgoing.classList.add('pipeline-moving');
    outgoing.hidden = false;
    incoming.classList.add('header-bridging');
    const incomingDiagram = incoming.querySelectorAll('.pipeline-thread, .pipeline-runtime, .pipeline-fabric-group');
    for (const element of incomingDiagram) element.style.visibility = 'hidden';
    const movingElements = outgoing.querySelectorAll('.pipeline-thread, .pipeline-runtime, .pipeline-fabric-group');
    const animations = [];
    for (const element of movingElements) {
      const movement = element.animate([
        { transform: 'none' },
        { transform: `translateX(${dx}px)` }
      ], { duration, easing, fill: 'forwards' });
      animations.push(movement);
    }
    const targetNodes = incoming.querySelectorAll('.pipeline-node');
    for (let index = 0; index < nodeStyles.length; index++) {
      const source = nodeStyles[index];
      const targetStyle = window.getComputedStyle(targetNodes[index]);
      const colorChange = source.node.animate([
        { borderColor: source.borderColor, backgroundColor: source.backgroundColor },
        { borderColor: targetStyle.borderColor, backgroundColor: targetStyle.backgroundColor }
      ], { duration, easing, fill: 'forwards' });
      animations.push(colorChange);
    }
    const sourceCode = outgoing.querySelector('.pipeline-sync-capability');
    const departingCode = sourceCode.animate([
      { transform: 'none', opacity: 1 },
      { opacity: 1, offset: 0.45 },
      { opacity: 0, offset: 0.8 },
      { transform: `translateX(${dx}px)`, opacity: 0 }
    ], { duration, easing, fill: 'forwards' });
    animations.push(departingCode);
    const sourceTitle = outgoing.querySelector('.slide-title');
    const titleFade = sourceTitle.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 250, fill: 'forwards'
    });
    animations.push(titleFade);
    const arrivingElements = incoming.querySelectorAll('.slide-title, .pipeline-phone');
    for (const element of arrivingElements) {
      const reveal = element.animate([
        { opacity: 0 }, { opacity: 1 }
      ], { duration: 400, delay: 350, easing: 'ease-out', fill: 'both' });
      animations.push(reveal);
    }
    const targetCall = incoming.querySelector('.pipeline-call');
    const arrivingCall = targetCall.animate([
      { transform: `translateX(${-dx}px)`, opacity: 0 },
      { opacity: 0, offset: 0.65 },
      { transform: 'none', opacity: 1 }
    ], { duration, easing, fill: 'both' });
    animations.push(arrivingCall);
    const cleanup = () => {
      for (const animation of animations) animation.cancel();
      outgoing.hidden = true;
      outgoing.classList.remove('pipeline-moving');
      incoming.classList.remove('header-bridging');
      for (const element of incomingDiagram) element.style.visibility = '';
    };
    const transition = { cleanup };
    slideBlend = transition;
    const movement = animations[0];
    try {
      await movement.finished;
    } catch (error) {
      if (error.name === 'AbortError') return;
      throw error;
    }
    if (slideBlend !== transition) return;
    cleanup();
    slideBlend = undefined;
  }

  function selectTeaserRun(slide, step) {
    const run = step > 0 ? 'rnl' : 'flashlist';
    const label = run === 'rnl' ? 'RNL' : 'FlashList';
    const video = slide.querySelector('video');
    const caption = slide.querySelector('.teaser-label');
    slide.dataset.teaserRun = run;
    caption.textContent = label;
    video.setAttribute('aria-label', `${label} iPhone Discord Shop scrolling teaser`);
    if (video.dataset.run !== run) {
      video.pause();
      video.src = `assets/benchmarks/teaser-${run}.mp4?v=iphone`;
      video.poster = `assets/benchmarks/teaser-${run}-poster.jpg?v=iphone`;
      video.dataset.run = run;
      video.load();
    }
    video.currentTime = 0;
    slide.dataset.videoStarted = 'true';
    playVideo(video);
  }

  async function transitionTeaser(step) {
    const slide = slides[current];
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionPreference.matches) {
      setRevealStep(step);
      writeHash();
      return;
    }
    const demo = slide.querySelector('.teaser-demo');
    const video = slide.querySelector('video');
    video.pause();
    const direction = step > 0 ? 1 : -1;
    const animations = [];
    const cleanup = () => {
      for (const animation of animations) animation.cancel();
    };
    const transition = { cleanup };
    slideBlend = transition;
    const departure = demo.animate([
      { transform: 'none', opacity: 1 },
      { transform: `translateX(${-1600 * direction}px)`, opacity: 0 }
    ], { duration: 320, easing: 'ease-in', fill: 'forwards' });
    animations.push(departure);
    try {
      await departure.finished;
      if (slideBlend !== transition) return;
      setRevealStep(step);
      writeHash();
      const arrival = demo.animate([
        { transform: `translateX(${1600 * direction}px)`, opacity: 0 },
        { transform: 'none', opacity: 1 }
      ], { duration: 420, easing: 'cubic-bezier(.22,.75,.2,1)', fill: 'both' });
      animations.push(arrival);
      await arrival.finished;
    } catch (error) {
      if (error.name === 'AbortError') return;
      throw error;
    }
    if (slideBlend !== transition) return;
    cleanup();
    slideBlend = undefined;
  }

  function next() {
    const slide = slides[current];
    if (slide.classList.contains('shop-teaser')) {
      if (slideBlend) return;
      if (slide.dataset.revealStep === '0') transitionTeaser(1);
      else show(current + 1);
      return;
    }
    if (slide.classList.contains('native-api-recap')) {
      transitionNativeCreate(current + 1);
      return;
    }
    if (slide.classList.contains('cover-original')) {
      shuffleCoverTitle(current + 1);
      return;
    }
    if (slide.classList.contains('pill-mix')) {
      window.pillMix.mixTo(blendToNext);
      return;
    }
    const pipelineSlide = slide.classList.contains('sync-pipeline');
    if (pipelineSlide && slide.dataset.revealStep === '3') {
      if (slide.classList.contains('pipeline-overview')) {
        transitionPipelineRight();
        return;
      }
      blendToNext();
      return;
    }
    const animation = activeAnimation();
    if (hasBuild(slide) && build === false) {
      setBuild(true, false, true);
      return;
    }
    const finalStep = lastRevealStep(slide);
    const revealStep = Number(slide.dataset.revealStep);
    const revealContentVisible = build || hasBuild(slide) === false;
    if (revealContentVisible && revealStep < finalStep) {
      setRevealStep(revealStep + 1);
      writeHash();
      return;
    }
    if (slide.classList.contains('list-introduction')) {
      transitionListHeader();
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
      playVideos();
      return;
    }
    if (current < slides.length - 1) show(current + 1);
  }

  function previous() {
    const slide = slides[current];
    if (slide.classList.contains('shop-teaser') && slide.dataset.revealStep === '1') {
      if (slideBlend) return;
      transitionTeaser(0);
      return;
    }
    if (slides[current].classList.contains('native-api-focus')) {
      transitionNativeCreate(current - 1);
      return;
    }
    if (slides[current].classList.contains('cover-alternate')) {
      shuffleCoverTitle(current - 1);
      return;
    }
    if (window.pillMix.mixing) {
      window.pillMix.enter(true);
      return;
    }
    const revealStep = Number(slides[current].dataset.revealStep);
    if (revealStep > 0) {
      setRevealStep(revealStep - 1);
      writeHash();
      return;
    }
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
      const videos = activeVideos();
      if (videos.length === 0) return;
      slides[current].dataset.videoStarted = 'true';
      const playing = videosPlaying();
      if (playing) {
        for (const video of videos) video.pause();
      } else playVideos();
    }
    updateMediaControls();
  }

  function replay() {
    if (slides[current].classList.contains('pill-mix')) {
      window.pillMix.enter();
      return;
    }
    const animation = activeAnimation();
    if (build && animation) animation.replay();
    else {
      const videos = activeVideos();
      if (videos.length === 0) return;
      slides[current].dataset.videoStarted = 'true';
      for (const video of videos) video.currentTime = 0;
      playVideos();
    }
    updateMediaControls();
    writeHash();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }

  function readHash() {
    const match = location.hash.match(/^#slide-(\d+)(-build|-scroll(?:-(30|20))?|-(async|runtime|step)-(\d+))?$/);
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
      if (match[4] === 'step') {
        const step = Number(match[5]);
        setRevealStep(step);
        writeHash();
      } else if (match[4] && slides[current].dataset.animation === match[4]) {
        const step = Number(match[5]);
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
      const videos = activeVideos();
      for (const video of videos) video.pause();
      updateMediaControls();
    }
  });
  for (const slide of slides) {
    const videos = slide.querySelectorAll('video');
    for (const video of videos) {
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
