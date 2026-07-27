# plex-firefox-extension

### Features

- Adjust the playback speed of media
- Automatically skip intros and credits (toggleable)

#### Speed step

The speed slider runs from 1x to 10x. By default it moves in steps of `1`, but
the step size is configurable from the settings panel (gear icon next to the
slider) — anything from `0.05` to `1`. A step of `0.2` gives 1x, 1.2x, 1.4x …
which is easier to follow on educational material than whole-number jumps.

Number keys `1`–`9` select the first nine slider positions, so they follow the
same step. With a step of `1` that is 1x–9x (unchanged); with a step of `0.2` it
is 1x, 1.2x, … 2.6x.

Settings persist in `localStorage`, and the step is stored **per Plex library**,
so an "Educational" library can sit at `0.2` while "TV Shows" stays at `1`.
Libraries you have not configured start at `1`, and the playback speed itself
always starts at `1x` — only the step is remembered.

The current library is worked out from the item being played: the player route
carries `key=/library/metadata/<id>`, and asking the server for that item's
metadata returns its `librarySectionID` and `librarySectionTitle`. The server
address and access token are read out of the browser's resource timing buffer
(requests Plex Web has already made), so no script injection or extra
permissions are needed, and the token is only ever sent back to the Plex server
that issued it. The settings panel shows the detected library; if it cannot be
determined, the most recently chosen step is used instead.

Note that `app.plex.tv` and a directly accessed server (`<host>:32400`) are
separate origins, so each keeps its own saved settings.

### In Development
    
- Automatically skip intro on plex prompt (plex pass required)
- Imediate skip to next episode on plex prompt

### Installation

You must use the nightly or developer build of firefox.
Download this repository as a ZIP.

PROCEED WITH CATION: Changing advanced configuration preferences can impact Firefox Developer Edition performance or security.

Enter `about:config` in the address bar, then `Accept the Rick and Continue`
Search for `xpinstall.signatures.required` and set it to `false`

Enter `about:addons` in the address bar
Click the settings icon next to Manage you Extensions, then `Install Add-on From File...`
Select the downloaded ZIP of the repository and enjoy.
