# Website Notes Overlay Extension

A minimal, premium-style Chrome extension to add persistent notes to any website.

## Features
- **Domain-Specific**: Notes are saved per website (e.g., distinct notes for `google.com` vs `github.com`).
- **Overlay**: A draggable, semi-transparent overlay shows your notes on the page.
- **Privacy**: Notes are stored locally in your browser (`chrome.storage.local`).
- **Premium UI**: Glassmorphism design with Dark Mode support.
- **Auto-Save**: Typing is saved automatically.

## Installation
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked**.
4. Select the `AnnotateExtension` directory.

## Usage
1. Click the extension icon to write a note for the current site.
2. The overlay will appear on the page.
3. Hover over the overlay to make it opaque.
4. Drag the overlay by the handle (⋮⋮) to reposition it.
5. Toggle visibility using the switch in the popup.
