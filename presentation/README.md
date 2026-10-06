# True native lists presentation

Open `index.html` in a browser. All fonts, images, and videos are local, so the deck works offline. Keep the `assets` folder beside the HTML.

The deck contains original Keynote slides 1, 2, and 4–13, in order. Original slide 3 is omitted. Slides 4 and 5 include editable rendering animations. The remaining draft slides retain their TODO text.

## Presenting

- **Right / Space / Page Down:** advance a slide, build, or animation step.
- **Left / Page Up:** return to the previous animation step, build, or slide.
- **F:** enter or leave fullscreen.
- **P:** play or pause the current animation segment or video.
- **R:** reset the animation without starting it, or replay the current video.
- **Home / End:** jump to the first or last slide.
- **?:** display shortcuts.

On HTML slide 4 (original slide 5), the title and subtitle start centered. Advance once to move the header to the top and reveal the synchronous rendering animation, paused. Each subsequent Right / Space / Page Down plays one of Swipe 01's five UI-thread steps and stops. The next advance starts continuous playback through Swipes 02–04. Advance again to fade out the thread walkthrough and start fast scrolling at a simulated 60 FPS, keeping the phone in place. This step plays and then holds at 60 FPS. The next advance plays and holds at 30 FPS, and the next plays and holds at 20 FPS as binding and layout exceed the 16.7 ms frame budget of a 60 Hz display. Each FPS change requires an advance. A timing bar and missed-refresh markers explain the visible stutter. Advance once more to continue to slide 5. Open `#slide-4-scroll`, `#slide-4-scroll-30`, or `#slide-4-scroll-20` to start directly at a specific FPS step. P pauses or resumes the current step, and R rewinds that step without starting playback.

Left / Page Up returns to the previous step, paused, through 20, 30, and 60 FPS, then the completed UI-thread walkthrough. Going back from slide 5 returns to the completed 20 FPS step, and continuing backward eventually returns to slide 4's TODO content. The numbered points and Swipe segments are labels, without click targets. On the two video slides, the first advance plays the demo and the next advance continues. You can also click a demo to play or pause it.

## Editing

HTML slide 5 opens with its title and subtitle centered. Advance once to move those elements into the normal header position and reveal the viewport strip across the top with the phone showing rows 1–5 below it. The strip shows which cells have native views and outlines the visible rows. Each subsequent advance plays and holds one of five steps: begin scrolling and reveal the native scroll event on the Main / UI thread, reveal the JS thread and React rendering, reveal native mounting after commit/layout, scroll past mounted content while JS is busy, and mount the missing batch at the current scroll position. The commit/layout block ends before the native mounting block starts. The 60 UI FPS counter appears only in the final blank-content and catch-up steps. Blank regions in the phone contain no skeletons or placeholders. Both slides omit the display/simulation subtitle beneath the FPS counter.

Left reverses one animation step at a time, paused, hiding the later layers, then reverses the title transition. P plays or pauses the current step. R rewinds only the current step without starting it. Going back from slide 6 restores the completed catch-up step. `#slide-5-build` opens the viewport introduction; `#slide-5-async-1` through `#slide-5-async-5` start individual steps.

To reuse this transition, add `data-transition="shared-header"` to a slide, put its heading and subtitle in a `.shared-header` using `.shared-header-title` and `.shared-header-subtitle`, and mark the content below with `data-build-content`. The navigation handles the intro and expanded build automatically. Set `--header-transition-duration` or `--header-transition-easing` on that slide to customize its motion. Reduced-motion preferences skip the movement.

HTML slide 7 explains VirtualView's synchronous rendering with one fixed React Native runtime. The first advance reveals the diagram, paused. Five subsequent advances play and hold normal JS execution, a synchronous UI request waiting for safe access, the exclusive-access handoff, React rendering on the UI thread while JS waits, and the return to JS execution. The runtime stays in place; the blue access token moves between the threads. Queued JS work stops during the handoff and UI rendering, and the phone reveals row 6 when rendering completes. Left reverses the sequence, P pauses or resumes, and R rewinds the current step. `#slide-7-build` opens the diagram and `#slide-7-runtime-1` through `#slide-7-runtime-5` open individual steps. Returning from slide 8 restores the completed handoff.

- `index.html`: slide text, order, images, and video placement. Each section records its original Keynote slide number.
- `styles.css`: fonts, colors, original 1920 × 1080 layout, and responsive scaling.
- `list-scene.js`: shared phone, cell drawing, fonts, canvas primitives, and background for both rendering animations.
- `sync-rendering.js`: synchronous rendering and the steppable FPS simulation. Adjust `stages`, `cycles`, and `cuts` to change the sequence and timing. The touch indicator is a small dot.
- `async-rendering.js`: FlatList's progressive rendering and blank-content simulation. Adjust `stages` and `stateAt` to change timing, scrolling, and mounting.
- `runtime-handoff.js`: VirtualView's shared-runtime access handoff and synchronous React rendering on the UI thread.
- `presentation.js`: navigation, builds, fullscreen, and media playback.
- `assets/`: original media and local fonts.

The animation illustrates the native Android case with schematic slow-motion timing. Its item binding stage uses `Adapter.onBindViewHolder()`. It omits prefetching and background image loading to focus on the synchronous UI work during one scroll update. The fast-scroll build is a simulation, not a device benchmark: 14, 32, and 47 ms of UI work require one, two, and three display intervals respectively. The phone advances only on simulated presented frames, so its stutter and FPS counter share the same timing model. The timeline magnifies one frame's work for readability. See the [Android RecyclerView documentation](https://developer.android.com/develop/ui/views/layout/recyclerview) and [rendering performance guidance](https://developer.android.com/topic/performance/issues/render).

The async slide illustrates FlatList's typical JS rendering path, with deliberately slowed schematic timing and a small mounted buffer. Native scrolling does not wait for receipt of scroll events on JS. New cells need React rendering, renderer commit/layout work, and mounting on the UI thread before they become visible. If scrolling outruns that preparation, VirtualizedList can expose blank content. The simulated 60 UI FPS isolates this case; it is not a claim that every FlatList scroll stays smooth. The two lanes simplify renderer scheduling, which can vary, and Fabric also supports synchronous rendering scenarios. See the [React Native performance guide](https://reactnative.dev/docs/performance), [VirtualizedList documentation](https://reactnative.dev/docs/virtualizedlist), [render pipeline](https://reactnative.dev/architecture/render-pipeline), and [threading model](https://reactnative.dev/architecture/threading-model).

Slide 7 shows the synchronous VirtualView path, with schematic timing rather than measured durations. The UI thread first waits for runtime access at a safe point; the JS thread then waits while the UI thread executes work in that same runtime. Runtime memory and app state stay in place. This differs from Worklets' separate UI runtime. The local React Native implementation uses `experimental_flushSync` in `RCTVirtualViewComponentView.mm` and `executeSynchronouslyOnSameThread_CAN_DEADLOCK` in `RuntimeExecutorSyncUIThreadUtils.cpp`. See the [React Native threading model](https://reactnative.dev/architecture/threading-model) and [Worklets runtime kinds](https://docs.swmansion.com/react-native-worklets/docs/fundamentals/runtimeKinds/).
