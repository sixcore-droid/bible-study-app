# Run your own Bible Study App

The [Bible Study App](https://jayms.com/bible-study-app/) runs in any browser. This folder turns a downloaded copy into your own study desk, on your own computer, with your own tools plugged in:

- **Logos Bible Software:** your commentaries and study Bibles on the Shelf, each opening in Logos at the passage.
- **Obsidian:** your notes on each passage saved to your vault, and the notes you already have that cite the passage.
- **Speechify:** the Read button reads the passage aloud in a Speechify voice.
- **Claude:** "Ask in my Project" sends your question about the passage to your own claude.ai Project.

Each one is optional. Skip any you don't use.

## What you need

- A Mac or a Windows PC.
- **Python 3** (on a Mac, type `python3` in Terminal and follow the prompt; on Windows, install it from python.org).
- Whichever of Logos, Obsidian, a Speechify API key and a claude.ai Project you want to use.

## Set it up

1. **Download** the app: <https://github.com/sixcore-droid/bible-study-app/archive/refs/heads/main.zip>, and unzip it anywhere.
2. **Open a terminal** in the unzipped folder (on a Mac: Terminal, type `cd ` and drag the folder in; on Windows: right-click the folder, Open in Terminal).
3. **Answer the questions:**
   ```
   python3 setup/setup.py
   ```
   Press Enter to skip any question. It finds Logos on its own, then builds your shelf and reads your vault.
4. **Start it:**
   ```
   python3 setup/serve.py
   ```
   and open <http://localhost:8940/> in Chrome or Safari. Leave the terminal window open while you study.

## Each part

**Logos.** Nothing to type. Setup reads Logos's own list of your library (open Logos once first, so the list is current). Your commentaries appear on the Shelf under each book, your study Bibles on its Study Bibles tab. Bought more books? Run `python3 setup/setup.py --refresh`.

**Obsidian.** Give the vault's name exactly as Obsidian shows it, and drag its folder in when asked for the path. Notes you write under a passage save there with Open in Obsidian. The Obsidian button lists your notes that already mention the passage; run `--refresh` after you write more. A second "books" vault (one folder per author) fills the Shelf's Vault tab.

**Speechify.** Get an API key from Speechify's developer page (speechify.ai, API). The key stays in `setup/settings.json` on your computer and is only sent to Speechify.

**Claude.** In claude.ai, make a Project for your Bible study and copy its link. The Claude button copies your question with the passage's material and opens that Project beside the app.

**Podcasts.** The Media panel's podcast list works without a key. If you'd rather use your own, Podcast Index keys are free at podcastindex.org.

## Keeping it current

Download the zip again for a newer app. Keep your `setup/settings.json` and `setup/mine/` folder: copy them into the new download and run `--refresh`.

## Private by design

Your answers, keys, Logos list and vault index stay in `setup/settings.json` and `setup/mine/` on your computer. The app only talks to the services you turned on.
