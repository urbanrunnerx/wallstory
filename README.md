# Wallstory

**[Install Wallstory on your phone](https://urbanrunnerx.github.io/wallstory/install.html)** · **[Open the planner](https://urbanrunnerx.github.io/wallstory/)** · **[Download app source ZIP](https://github.com/urbanrunnerx/wallstory/archive/refs/heads/main.zip)**

> The install and app links become available once GitHub Pages is enabled for this repository.

A phone-friendly gallery wall planner made from a home decorating idea: photograph a wall, enter real dimensions, add frames and artwork, and find an arrangement that fits.

## Install on your phone

Open **Install Wallstory on your phone** above in Chrome or Samsung Internet on Android, then tap **Install on my phone**. If no prompt appears, use the browser menu → **Install app** or **Add to Home screen**. On iPhone, open the link in Safari and use **Share → Add to Home Screen → Add**.

Wallstory is an installable web app, with a home-screen icon and a standalone app window in supporting browsers. Once its first online setup finishes, the app can also load offline. Save project files to keep your work; installing the app does not add cloud storage. The ZIP download contains the source files and is not an Android APK installer.

## Use the app

Open the published GitHub Pages link in your phone or computer browser. No ChatGPT account, API key, or paid AI service is needed. Installation is optional; it also works in your browser.

1. **Wall:** Enter width and height in inches or centimeters. Add your wall photo and mark the four corners of the rectangle you measured.
2. **Pieces:** Clear the sample pieces or edit them. Add your real outside dimensions, including frames. Upload artwork photos; use Crop & straighten to mark their edges.
3. **Layout:** Choose Balanced, Gallery grid, Salon wall, Center line, or Stair step. Set the gap and edge distance. You can also drag a piece or enter its exact position.
4. **Hang:** Open the measured hanging guide, export an image, or print/save the guide as a PDF.
5. **Keep your work:** Download a project file using Save project. Reopen it with Open project later.

Photos are processed in your browser tab and are not uploaded to an application server. Work is not automatically saved or synced. Your photos and layouts are not added to this repository when you use the app.

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

Automatic layouts preserve the entered outside dimensions. Shape spacing is checked conservatively using bounding rectangles. Photos are visual previews; verify all measurements before hanging. The guide provides frame edges and centers, not nail positions. Measure hanger offsets and account for wire sag separately.

## Installation files

`manifest.webmanifest`, `pwa.js`, `sw.js`, and `icons/` provide home-screen installation and the offline app shell. `install.html` explains installation and opens the browser’s native prompt when available.

Implementation references: [MDN installation requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) and [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
