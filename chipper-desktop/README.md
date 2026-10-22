# Chipper apps

Downloads for **Chipper**: get the newest version from **[Releases](../../releases/latest)**.

| Device | File |
|---|---|
| Windows | `Chipper-Setup.exe` |
| Mac (Apple chips and Intel) | `Chipper-Mac.dmg` |
| Linux | `Chipper-Linux.AppImage` |
| Android | `Chipper.apk` |
| iPhone / iPad | Open the website in Safari → Share → **Add to Home Screen** |

The apps are small windows that open the Chipper website, so they update by themselves whenever the website does.

## For the owner: making a new version

You only need this when you change the app's icon, name or website link. Changes to the website don't need a new app.

1. In this repository, open `package.json` and raise `"version"` (for example `2.0.0` → `2.0.1`). Click **Commit changes**.
2. Open the **Actions** tab → **Build the apps** → **Run workflow** → **Run workflow**.
3. Wait about 15 minutes. GitHub builds Windows, Mac and Linux and publishes them as a new release, together with `Chipper.apk` from the last release.

The website link the apps open is in `settings.json`.

## What's in here

- `main.js`: the app itself (window, tray, notifications, calls, screen sharing, start with the computer)
- `preload.js`: the small bridge the website uses to talk to the app
- `loading.html`: the "Connecting…" screen while the website wakes up
- `bubble.html`, `bubble-preload.js`: the floating circle during a call while the app is minimised
- `build/after-pack.js`: gives the Mac app a free signature so Macs allow "Open Anyway"
- `.github/workflows/build.yml`: the instructions GitHub follows to build everything
