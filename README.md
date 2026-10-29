# Ludoka

A classic Ludo game that runs in your browser. Play against the computer, pass the device around with friends, install it as an app, and keep playing offline.

**Play now: [ludoka.vercel.app](https://ludoka.vercel.app/)**

---

## Features

- **Classic board:** bright flat colours, star safe squares, coloured home columns, entry arrows and a four-triangle centre.
- **Play vs Computer:** three computer opponents that get smarter as you climb the milestone levels.
- **Pass & Play:** 2–4 players sharing one device.
- **Sound:** dice rolls, token steps, captures, getting home and win fanfares, all synthesised in the browser (no audio files). A speaker button in the header mutes everything.
- **Congratulations pop-ups:** every player who brings all four tokens home gets a medal pop-up (1st, 2nd, 3rd), followed by a final standings screen.
- **Milestones:** ten levels. Beat the computer to unlock the next one.
- **Installable (PWA):** add it to your home screen or desktop and play offline.
- **Responsive:** built for phones first, with a side-by-side layout on desktop.
- **Accessible:** keyboard-friendly controls, screen-reader labels on tokens and dice, and reduced-motion support.
- **Private:** no ads, no analytics, no third-party requests.

## How to play

1. Roll a **6** to bring a token out of your base.
2. Tokens travel **clockwise** around the board, then up your coloured home column to the centre.
3. Your start square and the starred squares are **safe**.
4. Land on an opponent's token (off a safe square) to **send it back to base**.
5. A **6**, a **capture**, or getting a token **home** gives you another roll.
6. The first player to bring all four tokens to the centre wins. The game carries on until 1st, 2nd and 3rd place are decided.

## Run it locally

No build step and no dependencies. Serve the folder with any static server:

```bash
git clone https://github.com/Philemon12421/Uncomplete-Ludo-app.git
cd Uncomplete-Ludo-app

# Option 1: Python
python3 -m http.server 8000

# Option 2: Node
npx serve .
```

Then open `http://localhost:8000`. Service workers work on `localhost`, so you can test installing and offline mode there too.

## Project structure

```
.
├── index.html              Page markup, PWA meta tags, footer, cookie banner
├── index.css               Board, tokens, dice, layout and theme
├── index.js                Game rules, computer player, UI flow, consent, PWA hooks
├── sw.js                   Service worker (offline support)
├── manifest.webmanifest    PWA manifest
├── vercel.json             Hosting headers for Vercel
├── favicon.ico
├── icons/                  favicon.svg and PNG app icons
└── scripts/
    └── make-icons.py       Regenerates the icons (needs Pillow)
```

## How it works

- **Board:** a 15×15 grid. The 52-square shared track, the four home columns and the base slots are defined as coordinate lists in `index.js`, and tokens are positioned by percentage so the board scales cleanly.
- **Token positions:** `-1` is in base, `0–50` is the shared track, `51–55` is the home column, and `56` is home.
- **Turn flow:** a small state machine (`roll → rolling → move → animating`) with a session counter, so quitting or restarting a game safely cancels any pending animation or computer move.
- **Computer player:** scores each possible move (finishing, capturing, leaving base, landing on safe squares, escaping danger) and picks the best one more often at higher levels.

## Offline and updates

`sw.js` caches the app on first visit and uses a stale-while-revalidate strategy: pages load instantly from the cache, and new deployments are picked up on the next visit. To force every user's old cache to be cleared, bump `VERSION` in `sw.js`.

## Privacy and cookies

On the first visit a small banner asks for a choice:

- **Essential only:** the game works fully. Only your banner choice and the offline cache are stored.
- **Accept:** also saves your unlocked milestone level and sound on/off choice in this browser's local storage.

Nothing is sent to a server. "Cookie settings" in the footer lets you change your choice at any time.

## Deploying to Vercel

This is a static site, so no framework preset or build command is needed.

1. Import the repo in Vercel.
2. Leave the build command and output directory empty (the project root is served).
3. Deploy. `vercel.json` already sets the service worker and manifest headers.

If you host under a different domain, update the URLs in `index.html` (`canonical`, `og:url`, `og:image`).

## Roadmap

- [ ] Real-time online matches
- [ ] Choose the number of computer opponents and difficulty
- [ ] Saved games and statistics
- [ ] Additional board themes

## Contributing

Bug reports and pull requests are welcome. Please open an issue first for larger changes so we can agree on the approach.

## Support the project

If you enjoy Ludoka, please **[star this repo on GitHub](https://github.com/Philemon12421/Uncomplete-Ludo-app)**. It helps others find it.
