# Kansei Runners: notes for working on this repo

- **Map rule:** every road lives inside the Ring Road (`RING` in `js/road.js`), which runs round the
  outside of the whole map with the rock wall just outside it. When adding roads or courses, place them
  inside the ring and keep them well clear of it (the ring sits `RING_MARGIN` m outside everything else
  and is rebuilt from the inner roads, so check its links still find a route: `ALL_ROADS` should
  contain all four `ring-*` links).
- The game runs with no build step: serve the folder (`python3 -m http.server 8123`) and open it.
