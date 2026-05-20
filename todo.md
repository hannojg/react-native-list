## Core architecture

[x] - Fix view config shit? this way color processing would work
[x] - Fix native modules?
[x] - Make native modules stable & dynamic - Fix getConstants use case & crash
[x] - Checkout how iOS works so i can get started designing a stable API
[ ] - Create a "SyncRenderer" and a "SyncView", this will also help with debugging (to render just one view instead of a whole list!)
[ ] - Do I want to use the ReactFiberConfig? (what do i mean by that?)
[x] - Implement the main list API lol
[ ] - There was some react tag collision as we are reusing the same fabric ui manager … thats why i just started the tags from 1mil. Idk, seems dirty, and is potentially something we'd like to address in the future by running our own instance?
[x] - Right now we need to pass a fixed size to the list (with height/width), lets get rid of that
[x] - Changing item height back and forth breaks layout on iOS
[ ] - Data source API add animated:boolean option for all operations, or also think about how we could give the developer here a proper animation API
[ ] - ios: rendering one list, and then a second one crashes the app - i assume react key collision
[x] - Android: you always have to interact with the UI once to render out the changes lol
[x] - Android: content overflowing
[x] - iOS: first content broken layout
[ ] - Upgrade nitro to latest
[ ] - I have hardcoded surface 3 basically everywhere thats not good

## Base functionality (what users expect to just work)

[x] - Try pressability stuff (even emitter - i think that should just work tbh, at least the emitting part)
[x] - Do I have to implement getPublicInstance so people can work with refs as expected?
[ ] - Vertical/Horizontal support?
[ ] - RNGH / reanimated (i guess?)
[ ] - When trying to use RNGH it says: Error: GestureDetector must be used as a descendant of GestureHandlerRootView. Otherwise the gestures will not be recognized. - The problem is that they render a react context to check for the gesture detector - Either i need to add WrapperComponent prop support (i think i still have to do this) - But there might be other more severe issues with running RNGH

## Features

[ ] - Mosaic layout
[ ] - An API to pull data in when rendering (see discussion i had with miguel)
[ ] - An API that tells you how many recycles happened and how many views were created. If the user does not provide
item sizes or just estimates, its possible that too many creates happen if the estimation is off on iOS! Could be paired
with some other performance data.

## Performance

[ ] - Create a custom view manager so i don't have to inject empty views to keep the indices correct - Benchmarking before after would be interesting! - I guess that could be huge, for 10k list items, it created 10k dummy views right now!
[ ] - Move the commit to root into the render phase function for earlier execution - Would be nice to properly benchmark the diff

## Stability

[ ] - Fix the crash by delaying setting the adapter after the render phase - I think the issue is really that the adapter fill will be requested on layout
[ ] - Fix crash during hot reload
[ ] - Test with worklets global strict mode
[ ] - (Android) There is an issue with the how the mounting item dispatcher works. I think it only executes at choreographer frame interval, but
we basically want it to "force render" something for our view. In 90% of cases the window is hit, but sometimes the app crashes here
because the view has not yet rendered out.
