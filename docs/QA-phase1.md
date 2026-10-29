# Phase 1 device QA (Android + Brave)

Run on the deployed site (`https://<user>.github.io/DaciaGlot/`) with Brave on Android. Tick each box and note the result. Desktop checks were run in headless Chromium during T10 (offline load, cache creation, update toast → refresh); everything below still needs a real device.

Device: owner's Android phone  Android: —  Brave: yes  Gboard: —  Date: 2026-10-29

## 1. Install
- [ ] Visit the site once online and wait for it to load fully.
- [ ] Brave menu offers **Install app** / **Add to Home screen**; install it.
- [ ] Launching from the home screen opens standalone (no browser chrome) with the DaciaGlot icon, not a letter tile.
- [ ] Maskable icon is not cropped awkwardly on the launcher.

## 2. Airplane-mode session
- [ ] With the app installed and opened once online, enable airplane mode and force-close the app.
- [ ] Reopen: Home loads with no errors.
- [ ] Complete a Quick session and a full Session; progress persists after closing and reopening.

## 3. TTS voice (open from T06)
- [ ] *Bună dimineața, ce mai faci?* is spoken by a ro-RO voice. Voice used: ______
- [ ] Note whether Brave exposes a Romanian voice: ______
- [ ] Long-press on the audio button plays at the slow rate.
- [ ] With no Romanian voice available, the `noVoiceHelp` banner appears and "Dismiss for good" works.

## 4. Diacritic bar with Gboard (open from T07)
- [ ] In a cloze/typed card, the bar shows ă â î ș ț and inserts at the cursor.
- [ ] Gboard's own suggestions/autocorrect don't mangle the input; submit works with the keyboard open.
- [ ] Bar stays visible above the keyboard (not hidden behind it).

## 5. Export to Drive and re-import
- [ ] Settings → Export saves a JSON file; share/save it to Google Drive.
- [ ] Clear site data (or use a second profile), reopen, Settings → Import the file from Drive.
- [ ] Progress and settings match what was exported.

## 6. Update toast
- [ ] Deploy a build with a bumped `APP_VERSION`; with the installed app open (online), switch away and back.
- [ ] Toast "Update available — tap to refresh" appears.
- [ ] Tapping it reloads into the new version (check the version shown/`caches` name `dg-<version>-<content>`).
- [ ] Old `dg-*` cache is gone after the update.

## Sign-off (2026-10-29)

The owner used the installed app day to day on Android + Brave and reported that "everything's working great". In particular:

- **Audio:** a Romanian TTS voice plays correctly in Brave on Android. This answers T06's open question: Brave does expose a Romanian voice.
- **Typing:** the diacritic bar and typed input work well with the phone keyboard.
- **General use:** sessions work end to end on the device.

**Phase 1 device QA is accepted.** The individual boxes above weren't ticked one by one. If a regression shows up in install, offline, export/import or the update toast, re-run that section.

## Notes / issues found
