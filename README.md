# Wallstory

**[Install Wallstory on your phone](https://urbanrunnerx.github.io/wallstory/install.html)** · **[Open the planner](https://urbanrunnerx.github.io/wallstory/)** · **[Download app source ZIP](https://github.com/urbanrunnerx/wallstory/archive/refs/heads/main.zip)**

> Open the live planner or use the install link above. No account is needed.

A phone-friendly gallery wall planner made from a home decorating idea: photograph a wall, enter real dimensions, add frames and artwork, and find an arrangement that fits.

## Install on your phone

Open **Install Wallstory on your phone** above in Chrome or Samsung Internet on Android, then tap **Install on my phone**. If no prompt appears, use the browser menu → **Install app** or **Add to Home screen**. On iPhone, open the link in Safari and use **Share → Add to Home Screen → Add**.

Wallstory is an installable web app, with a home-screen icon and a standalone app window in supporting browsers. Once its first online setup finishes, the app can also load offline. Your latest wall is automatically saved on this device, including its photos, and restored when you reopen the app. Save project files for backup or to move designs between devices; autosave does not add cloud storage. The ZIP download contains the source files and is not an Android APK installer.

## Use the app

Open the published GitHub Pages link in your phone or computer browser. No ChatGPT account, API key, or paid AI service is needed. Installation is optional; it also works in your browser.

1. **Wall:** Enter width and height in inches or centimeters. Add your wall photo and mark the four corners of the rectangle you measured.
2. **Pieces:** Clear the sample pieces or edit them. Add your real outside dimensions, including frames. Upload artwork photos; use Crop & straighten to mark their edges.
3. **Layout:** Choose Balanced, Gallery grid, Salon wall, Center line, or Stair step. Set the gap and edge distance. You can also drag a piece or enter its exact position.
4. **Hang:** Open a piece and choose **Save & set hanging points**, or use **Hanging points** in the full-screen studio. Measure and confirm its hardware, then open **Hanging guide** for separate frame-edge and nail coordinates. Download the guide, print/save it as a PDF, or download the nail map as SVG.
5. **Keep your work:** Look for **Saved on this device** after editing. Your latest wall restores automatically. Download a backup with **Save project** and use **Open project** to import a design. Finish a piece edit with **Save changes** (or **Add to wall**) to include it in autosave.
6. **Update:** Use **Check for updates**. When **Update available** appears, choose **Save & update**. The app waits for the design to finish saving before reloading. If saving fails, it stays open and explains what to do.

Photos are processed on your device and are not uploaded to an application server. The latest design is stored locally in IndexedDB, separate from the offline app cache. Clearing browser data, removing app storage, or browser storage eviction can remove this local draft; keep downloadable backups of important designs. Autosave does not sync across devices or browsers. Your photos and layouts are not added to this repository when you use the app.

Autosave reports storage errors instead of claiming a save succeeded. A second window cannot overwrite a draft changed by another window; download that window’s project before reopening. If an existing draft cannot be read, it is left untouched. Undo/redo history and unfinished form edits are kept only for the current session.

## Full-screen wall studio

Tap **Full-screen studio** above the wall. The app requests fullscreen and landscape where supported. If your browser cannot lock orientation, turn the phone sideways with auto-rotate enabled; the workspace also supports portrait. **Done** returns to the main planner with the same design.

- **+ Piece** opens a compact editor. Enter the shape, outside dimensions, and frame finish, then **Add to wall**.
- Tap a piece to select it. Drag it to move, drag a blue corner to resize, or use the panel for exact dimensions and positions. **Apply changes** commits form edits; a completed drag saves immediately.
- Circles and squares stay equal on both axes. **Keep proportions with corner handles** preserves other aspect ratios. Measurement snapping also applies to resizing.
- **Photo & crop** opens the existing photo editor without leaving the workspace. Rotate, duplicate, center across the wall, center vertically, delete with confirmation, and undo/redo are available in the studio.
- Pinch with two fingers or use the zoom buttons (100–800%). Empty space pans the view; **Pan** allows dragging over pieces without moving them. **Fit wall** resets the view. Zoom never changes the measured wall or piece sizes.
- Collapse **Pieces** to use the entire canvas. The **Arrange** tab controls layout and spacing; **View** includes plan view, grid, measurement labels, snapping, landscape, and downloads.
- The save indicator and fit warnings remain visible. A single resize gesture is one undo step. Unapplied form edits block updates and ask before being discarded.

Fullscreen and orientation are browser capabilities; support varies. The viewport fallback preserves all editing controls. Test on the target phone before relying on automatic rotation. The automated DOM interaction tests do not render CSS or emulate native phone fullscreen.

## Precise hanging points

- Open a piece and choose **Save & set hanging points**. In full-screen mode, tap a piece → **Hanging points**. The guide also links to each frame’s hanging editor.
- Keep the frame’s intended top at the top. The **Back of frame** diagram is a true-scale schematic of the frame you entered. **Front / wall view** mirrors the support points horizontally so they match the wall view.
- Add up to 12 points per frame. **One centered**, **Symmetric pair**, **Center this point**, and **Level all to this point** help set initial positions. Shortcuts are drafts, not measured hardware.
- Drag crosshairs or enter exact distances from the left, right, and top. Labels always identify which side you are viewing. Inches and centimeters are supported; arrow keys nudge by 1/16 inch or 1 mm, with Shift for four times that step.
- For a direct nail or screw, measure the actual support contact point. For a wall hook, enter how far its nail entry is **above** the support point. This models one nail directly above each hook, not multiple nails or horizontal offsets within a hook. Measure wire under tension at the intended support positions.
- Check **I measured every support point…** only after verifying the actual hardware, then **Save hanging points**. Saving unchecked keeps a draft and withholds nail coordinates.
- The guide provides frame-edge distances from the wall’s left, top and right, followed by individually labeled nail coordinates from all four wall edges. The numbered nail map is downloadable as SVG; guide HTML can be downloaded or printed to PDF. The diagrams are not full-size drilling templates.
- Moving or arranging a piece recalculates its nail positions. Resizing, rotating, changing shape, or duplicating a piece requires reconfirming its hardware. Existing physical offsets are preserved for review rather than scaled. Points outside a resized frame cannot be confirmed. A nail outside the measured wall is flagged in the guide.
- Saved projects and on-device autosave include the hanging measurements. Older projects open with **Hanging points not measured**. Edits support undo/redo; unfinished hanging edits block app updates and ask before being discarded.

The calculation is based on entered measurements, not the wall photograph: `wall nail x = frame left + frame width − distance from back left`; `wall nail y = frame top + distance down from frame top − hook rise`. A 10-inch frame placed 20 inches from wall left and 12 inches below wall top, with direct hangers 2.5 inches from each side and 1 inch down, needs nails at 22.5 and 27.5 inches from wall left, both 13 inches from wall top.

`hanging.js` validates and calculates the measurements. `hanging-editor.js` / `hanging.css` provide the editor; `hanging-guide.js` generates the maps and tables. Automated tests cover asymmetric mirroring, both user examples, hook offsets, invalid data, saved project compatibility, draft protection, centimeters, touch/keyboard edits and undo. The DOM harness does not render phone layouts or test native browser fullscreen.

## Publish on GitHub Pages

After these files are uploaded to the repository root:

1. Open the repository **Settings → Pages**.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Choose the branch containing these files (usually `main`) and the **/ (root)** folder, then Save.
4. Wait for GitHub Pages to finish and use the site URL shown in Settings → Pages. Send that app URL to the person who will use it.

The files use relative asset paths, so the app works under a GitHub Pages project path. No compilation or package installation is needed. The `.nojekyll` file keeps the site static.

GitHub's official instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Run on your own computer

Serve this folder with any static HTTP server. For example, with Python installed, run `python -m http.server 8000` in this folder and open `http://localhost:8000/`.

Use an HTTP server or hosted link; opening `index.html` directly as a local file can block JavaScript modules in some browsers.

## How it works

- `layout.js`: geometric layout engine, fit checks, project validation, and perspective mapping.
- `app.js`: interaction, photo processing, imports, exports, and optional browser-native agent tools.
- `index.html` and `style.css`: responsive interface.
- `sample-wall.webp`: generated demonstration photograph, not a measurement reference.

Automatic layouts preserve the entered outside dimensions. Shape spacing is checked conservatively using bounding rectangles. Photos are visual previews; verify all measurements before hanging. The guide separates frame placement from nail / anchor positions. Nail coordinates are calculated only for confirmed hanging measurements. Wire tension and hook offsets must be measured on the actual hardware.

## Publishing updates

For every app release, bump `VERSION` to the same new value in both `sw.js` and `pwa.js`. Include every runtime asset in `SHELL` in `sw.js`, then publish all changes together. The worker downloads the complete release before offering it. It activates when the user chooses **Save & update**, or after all older app windows close. Windows already in use are never automatically reloaded. Draft storage is versioned separately and never deleted by app updates. The first upgrade from the original release requires saving a project file before reloading, because that original release did not include autosave.

## Installation files

`manifest.webmanifest`, `pwa.js`, `sw.js`, and `icons/` provide home-screen installation and the offline app shell. `install.html` explains installation and opens the browser’s native prompt when available.

Implementation references: [MDN installation requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) and [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

`studio.js`, `studio.css`, and `studio-math.js` provide the immersive editor, responsive controls, and viewport/resize geometry. `project-store.js` handles draft transactions and serialized autosave. `update.css` and `pwa.js` provide saving status and controlled updates. Regression tests run with `node --test tests/*.test.mjs` with Node 22 or newer.

Browser references: [Fullscreen requests](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen), [orientation lock](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock).
