CYMATIC TITLE BRIDGE
====================

Lets the cymatic_bridge visualizer (https://thedungeons2077.github.io/cymatic_bridge/)
show the title of the YouTube or YouTube Music tab you share with it.
Without it, everything works the same, just with no title.

INSTALL
  1. Unzip this folder somewhere you'll keep it (e.g. Documents\cymatic-bridge).
     Chrome loads it from there every time it starts: don't delete it.
  2. Open chrome://extensions and turn on "Developer mode" (top right).
  3. Click "Load unpacked" and choose the folder that has manifest.json in it.
  4. Reload your YouTube tabs (open tabs don't get it until they reload),
     then press LISTEN on the visualizer again.

UPDATE
  Download the new zip from the visualizer, unzip it over the old folder,
  press the reload arrow on the bridge in chrome://extensions, then reload
  your YouTube tabs.

WHAT IT DOES
  - On youtube.com and music.youtube.com only, it labels the tab with its
    title, using Chrome's "capture handle". When you share that tab with the
    visualizer, the visualizer reads the label. When the video or song
    changes, the label changes with it.
  - Only the visualizer's own address can read the label.
  - It has no permissions. It can't see your other tabs, your history or
    anything else, and it sends nothing anywhere.
