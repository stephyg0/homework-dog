# Homework Hound

A tiny Chrome extension that summons a giant pixel dog to visually eat the current page. It is meant as a silly "the dog ate my digital homework" gag: the real page is not modified, but the extension paints bite marks and crumbs over it.

## Load It In Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `/Users/steph/Downloads/homework-dog`.
5. Open any page, click the Homework Hound extension, and press **Summon dog**.

Use **Clean page** in the popup to remove the dog and all bite marks.

## Files

- `manifest.json` configures the Manifest V3 extension.
- `popup.html`, `popup.css`, and `popup.js` render the extension popup.
- `content.js` creates the full-screen dog and eating animation.
- `chiba.png` and `chiba2.png` are the two dog animation frames.
