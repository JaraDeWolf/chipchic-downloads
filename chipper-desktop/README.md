# ChipChic apps

Downloads for **ChipChic**: get the newest version from **[Releases](../../releases/latest)**.

| Device | File |
|---|---|
| Windows | `ChipChic-Setup.exe` |
| Mac (Apple chips and Intel) | `ChipChic-Mac.dmg` |
| Linux | `ChipChic-Linux.AppImage` |
| Android | `ChipChic.apk` |
| iPhone / iPad | Open the website in Safari → Share → **Add to Home Screen** |

The apps are small windows that open the ChipChic website, so they update by themselves whenever the website does.

## For the owner: making a new version

You only need this when you change the app's icon, name or website link, or have a new Android file. Changes to the website don't need a new app.

1. Open `package.json` (in the app's folder: `chipchic-desktop`, or `chipper-desktop` if you kept the old name), click the pencil, raise `"version"` (for example `2.1.0` → `2.1.1`) and click **Commit changes**.
2. New Android file? Delete the old `.apk` from the repository and upload the new one (any name).
3. Open the **Actions** tab → **Build the apps** → **Run workflow** → **Run workflow**.
4. Wait about 15 minutes. GitHub builds Windows, Mac and Linux and publishes them as a new release, together with the Android file.

The website link the apps open is in `settings.json`.

## What's in here

- `main.js`: the app itself (window, tray, notifications, calls, screen sharing, start with the computer)
- `preload.js`: the small bridge the website uses to talk to the app
- `loading.html`: the "Connecting…" screen while the website wakes up
- `bubble.html`, `bubble-preload.js`: the floating circle during a call while the app is minimised
- `build/after-pack.js`: gives the Mac app a free signature so Macs allow "Open Anyway"
- `.github/workflows/build.yml` (at the top of the repository): the instructions GitHub follows to build everything
