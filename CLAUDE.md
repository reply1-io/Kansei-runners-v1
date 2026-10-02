# Kansei Runners: notes for working on this repo

- **Map rule:** every road lives inside the Ring Road (`RING` in `js/road.js`), which runs round the
  outside of the whole map with the rock wall just outside it. When adding roads or courses, place them
  inside the ring and keep them well clear of it (the ring sits `RING_MARGIN` m outside everything else
  and is rebuilt from the inner roads, so check its links still find a route: `ALL_ROADS` should
  contain all four `ring-*` links). Newer courses (`NEW_DEFS`: Kagami, Tengu, Hayate) are laid out
  after the ring, so they don't move it: each branches off an existing road and ends on the ring.
  Keep them 60 m+ clear of every other road (lakes under bridges need room) and away from the wall.
- Road segments can carry `bridge: 'red' | 'stone' | 'timber'`: world3d.js builds the bridge and
  carves a lake under it, and drive.js puts the rail at the road's edge.
- The game runs with no build step: serve the folder (`python3 -m http.server 8123`) and open it.
