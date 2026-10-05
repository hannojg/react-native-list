# True native lists presentation

Open `index.html` in a browser. All fonts, images, and videos are local, so the deck works offline. Keep the `assets` folder beside the HTML.

The deck contains original Keynote slides 1, 2, and 4–13, in order. Original slide 3 is omitted. All TODO text stays visible.

## Presenting

- **Right / Space / Page Down:** advance a slide, build, or animation step.
- **Left / Page Up:** return to the previous animation step, build, or slide.
- **F:** enter or leave fullscreen.
- **P:** play or pause the current animation segment or video.
- **R:** reset the animation without starting it, or replay the current video.
- **Home / End:** jump to the first or last slide.
- **?:** display shortcuts.

On HTML slide 4 (original slide 5), advance once to reveal the synchronous rendering animation, paused. Each subsequent Right / Space / Page Down plays one of Swipe 01's five UI-thread steps and stops. The next advance starts continuous playback through Swipes 02–04. Advance again to continue to slide 5. Left / Page Up returns to the previous step, paused; from the continuous segment, it returns to the end of Swipe 01. Going back from slide 5 returns to the completed animation, and continuing backward eventually returns to slide 4's TODO content. The numbered points and Swipe segments are labels, without click targets. On the two video slides, the first advance plays the demo and the next advance continues. You can also click a demo to play or pause it.

## Editing

- `index.html`: slide text, order, images, and video placement. Each section records its original Keynote slide number.
- `styles.css`: fonts, colors, original 1920 × 1080 layout, and responsive scaling.
- `sync-rendering.js`: editable canvas animation. Adjust `stages`, `cycles`, and `cuts` to change the sequence and timing. The touch indicator is a small dot.
- `presentation.js`: navigation, builds, fullscreen, and media playback.
- `assets/`: original media and local fonts.

The animation illustrates the native Android case with schematic slow-motion timing. Its item binding stage uses `Adapter.onBindViewHolder()`. It omits prefetching and background image loading to focus on the synchronous UI work during one scroll update. See the [Android RecyclerView documentation](https://developer.android.com/develop/ui/views/layout/recyclerview) and [rendering performance guidance](https://developer.android.com/topic/performance/issues/render).
