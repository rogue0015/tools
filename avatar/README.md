# Avatar Studio

Record videos as a customisable 2D avatar that copies your face, with your voice and a built-in teleprompter. After one visit with internet, it works completely offline.

## Run it

It is served from the same GitHub Pages site as the other small apps, at `/avatar/`.
The camera and offline mode need `https://` (or `localhost`), so unlike the other apps
it does **not** work by double-clicking `index.html`. To test locally, from the repo root:

```
python -m http.server 8080
```

Then open http://localhost:8080/avatar/.

Open it once with internet, turn on the camera, and wait for **Offline ready**. The
face tracker (about 17 MB) downloads only when you first use the camera. From then
on it opens and records with no connection.

To keep it like an app: on iPhone, Share → Add to Home Screen. On Android, browser menu →
Install app. On iPhone this matters, because Safari can clear the saved files of sites
you haven't opened for a while.

## Using it

- **Avatar**: start from a look (Host, Podcaster, Headwrap, Lecturer, Male, Female, Student, Grandpa, Grandma, Coach, Neon), set body type (male, female, neutral), shoulders, neck and age, then change face shape, skin tone, eyes, brows, nose, mouth, 16 hair styles, makeup, beauty mark, facial hair, glasses, headwear, earrings, clothes, background, framing and line style. Save your own looks, randomize, undo, and export or import a look as a `.json` file. Green and blue screen backgrounds are there for editing later.
- **Prompter**: paste or upload a plain-text `.txt` script, then export it as `.txt` when you’re done. Put cues in square brackets, like `[pause]`, and they show in amber. Set the speed in words per minute, the text size and position, and mirror the text if you use prompter glass. It starts scrolling when you start recording. It sits over the stage but is never part of the video.
- **Setup**: pick the camera and microphone and their clean-up filters. Tune each expression (blinks, gaze, brows, mouth, smile and more) with live meters, tune head turn, nod and tilt separately, and choose the tracker engine and confidence. For recording: 16:9, 9:16, 1:1, 4:3, 4:5 or a custom size, 480p to 4K, 24 to 60 fps, video and audio bitrate, file type and codec, and the countdown.
- **Clips**: play, save, share or delete your takes.

Press **Camera**, look straight at the screen for a second (the app learns your neutral pose), then press the red button. If the avatar looks tilted while you face the camera, press **Recenter**.

Keyboard: Space starts or pauses the script, R starts or stops recording.

## How it works

| File | What it does |
| --- | --- |
| `index.html` | Layout and styles |
| `app.js` | Camera, render loop, recording, clips, editor, settings |
| `avatar.js` | Draws the avatar on a canvas; the list of customisation options |
| `tracker.js` | MediaPipe Face Landmarker; turns its 52 expression scores and the face mesh into avatar movement |
| `prompter.js` | The teleprompter |
| `store.js` | Saves takes in IndexedDB, one second at a time while recording |
| `sw.js` | Service worker that keeps everything available offline |

The camera picture is only used for tracking and never leaves the device. Each recording is the avatar canvas plus your microphone, combined into one stream, so picture and sound stay in sync.

While recording, every second of video is written to storage straight away. If the browser crashes or the tab closes, the Clips tab offers to recover the unfinished take.

## Face tracker files

The tracker (MediaPipe tasks-vision 1.1.1, about 17 MB) is not stored in this repo. It is
downloaded from jsDelivr and Google storage the first time the app opens, then `sw.js`
keeps it on the device so later visits work offline. The versions are pinned, so the
saved copies never go out of date.

## Good to know

- Keep the app on screen while recording. If you switch apps, the recording pauses and carries on when you come back.
- Chrome, Edge and Safari record MP4. Firefox records WebM.
- Takes are stored in this browser on this device. Save the ones you want to keep; clearing the site's data deletes them.
- After you change any app file, raise `VERSION` in `sw.js` so installed copies pick up the update.
