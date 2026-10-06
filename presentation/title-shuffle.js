(() => {
  function characters(title, deckBounds, scale) {
    const text = title.firstChild;
    const letters = [];
    const range = document.createRange();
    for (let index = 0; index < text.length; index += 1) {
      const character = text.textContent[index];
      if (character === ' ') continue;
      range.setStart(text, index);
      range.setEnd(text, index + 1);
      const bounds = range.getBoundingClientRect();
      letters.push({
        character,
        x: (bounds.left - deckBounds.left) / scale,
        y: (bounds.top - deckBounds.top) / scale,
        used: false
      });
    }
    return letters;
  }

  function closestMatch(letters, destination) {
    let match;
    let nearest = Infinity;
    for (const letter of letters) {
      if (letter.used || letter.character !== destination.character) continue;
      const dx = destination.x - letter.x;
      const dy = destination.y - letter.y;
      const distance = Math.hypot(dx, dy);
      if (distance < nearest) {
        nearest = distance;
        match = letter;
      }
    }
    if (match) match.used = true;
    return match;
  }

  function create(source, target, deck) {
    const deckBounds = deck.getBoundingClientRect();
    const scale = deckBounds.width / 1920;
    const origins = characters(source, deckBounds, scale);
    const destinations = characters(target, deckBounds, scale);
    const layer = document.createElement('div');
    layer.className = 'title-shuffle-layer';
    layer.setAttribute('aria-hidden', 'true');
    deck.append(layer);
    const probe = document.createElement('span');
    probe.className = 'title-shuffle-letter';
    probe.textContent = 'M';
    layer.append(probe);
    const probeBounds = probe.getBoundingClientRect();
    const probeRange = document.createRange();
    probeRange.selectNodeContents(probe);
    const glyphBounds = probeRange.getBoundingClientRect();
    const glyphOffset = (glyphBounds.top - probeBounds.top) / scale;
    probe.remove();
    const animations = [];

    function token(letter) {
      const element = document.createElement('span');
      element.className = 'title-shuffle-letter';
      element.textContent = letter.character;
      element.style.left = `${letter.x}px`;
      element.style.top = `${letter.y - glyphOffset}px`;
      layer.append(element);
      return element;
    }

    for (const [index, destination] of destinations.entries()) {
      const origin = closestMatch(origins, destination);
      const element = token(destination);
      const delay = index * 6;
      const tilt = index % 2 === 0 ? 9 : -9;
      let frames;
      if (origin) {
        const dx = origin.x - destination.x;
        const dy = origin.y - destination.y;
        const arc = index % 2 === 0 ? -65 : 45;
        frames = [
          { transform: `translate(${dx}px, ${dy}px)`, opacity: 1 },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.45 + arc}px) rotate(${tilt}deg)`, opacity: 1, offset: 0.45 },
          { transform: 'none', opacity: 1 }
        ];
      } else {
        frames = [
          { transform: `translate(0, 70px) rotate(${tilt * 2}deg) scale(.4)`, opacity: 0 },
          { transform: `translate(0, 40px) rotate(${tilt}deg) scale(.7)`, opacity: 0, offset: 0.4 },
          { transform: 'none', opacity: 1 }
        ];
      }
      const animation = element.animate(frames, {
        duration: 950,
        delay,
        easing: 'cubic-bezier(.22,.75,.2,1)',
        fill: 'both'
      });
      animations.push(animation);
    }
    for (const origin of origins) {
      if (origin.used) continue;
      const element = token(origin);
      const animation = element.animate([
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: 'translateY(-75px) rotate(-18deg) scale(.4)' }
      ], { duration: 550, fill: 'forwards', easing: 'ease-in' });
      animations.push(animation);
    }
    source.style.visibility = 'hidden';
    target.style.visibility = 'hidden';
    const completions = animations.map(animation => animation.finished);
    const finished = Promise.all(completions);
    function cleanup() {
      for (const animation of animations) animation.cancel();
      layer.remove();
      source.style.visibility = '';
      target.style.visibility = '';
    }
    return { finished, cleanup };
  }
  window.titleShuffle = { create };
})();
