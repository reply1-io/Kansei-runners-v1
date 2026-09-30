# Kansei Runners

A mobile-friendly browser game. Buy a junk car with $5,000, fix what's broken, drive it hard, and work your way up to faster cars. There's nothing to install: it runs in a phone browser with an HTML5 canvas and plain JavaScript.

## How to play

You start at **your cabin, deep in the forest**, shown top-down. It has a carport tent for one car, a gravel driveway in front of it for 2 more, and a mountain road out front. That's 3 parking spots, so you can own up to 3 cars.

**On the map:**
- **Select** (the yellow button next to each car) puts you in that car. The camera is locked behind the car, almost straight down, with just enough tilt to see its rear. Drive down the lane onto the road and go anywhere, including the side roads. Tap **🏠 Park** to go home.
- **Tap a parked car** to open it in the Garage.
- **Tap an empty spot** to open the Marketplace.
- **Tap the cabin** to sleep until tomorrow, which brings new listings.
- **📱 Phone** pulls out your phone. **▾ Put away** puts it back.

**The road** is a 2.7 km touge loop around the mountain, with no straights:
- From the cabin it climbs the west face through 4 switchback hairpins (the tightest is 9.5 m radius) and sweeps up to the ridge.
- It runs the ridge over the summit (about 60 m up), drops down the east face through 3 more hairpins, and comes back through the valley past your cabin.
- Guardrails line the mountain sections. Gravity is simulated, so uphill slows you and downhill pulls you into the hairpins.
- **Side roads** branch off at the summit (lookout), the east face (old logging road) and the valley (road to town). They're drivable gravel for now and end at a "Road closed" barrier, ready to be opened up later.

**The loop:**
1. **Marketplace:** 6–10 used cars under $5k each day, with a price, factory specs (hp, handling, weight) and condition. Striped `??` bars are hidden problems, so tap **Inspect ($80)** before you buy.
2. **Parts Shop:** buy parts for anything marked ⚠️, plus performance mods. They go in your trunk.
3. **Garage:** tap **Install** / **Install all**.
4. **Touge app:** street races on your loop against 1–2 rivals:
   - **Kenta:** uphill, cabin → summit
   - **Iketani:** downhill, summit → east face → cabin
   - **Ryo & Shingo:** the full loop at night
   - **The Ghost:** downhill at midnight
5. **Rivals race hard.** They always get **the same power-to-weight as your car**, so you can't buy your way past them with power:
   - They drive a computed racing line (wide, apex, wide) and pull the handbrake through the tightest hairpins.
   - They follow closely and try to go around you.
   - Later rivals are better drivers on stickier tires with stronger brakes, so tires, coilovers and brakes are the mods that matter.
   - Expect to need a few tries.
6. **Drive:**
   - **◀ ▶** steer
   - **GAS**, **BRAKE** and **HAND BRAKE**; pull the handbrake to swing the rear around hairpins.
   - On a keyboard, use arrows/WASD, with space for the handbrake.
   - 🔊 toggles sound (engine, tire squeal, impacts). Night races are lit by headlights.
7. Every drive wears the car. Throttle wears the engine and transmission, sliding wears tires, brakes wear on downhills, and guardrails and contact damage the body. A worn engine can blow. Spend your winnings on repairs and mods, or sell and move up.

Progress saves automatically in the browser (localStorage).

## Running it

It's plain HTML/CSS/JS ES modules with no build step. Browsers won't load modules from `file://`, so serve the folder:

```bash
python3 -m http.server 8000
```

- **Computer:** open http://localhost:8000
- **Phone:** connect to the same Wi-Fi, then open `http://<your-computer's-IP>:8000`
- **Hosted:** any static host works (GitHub Pages, Netlify and so on). Point it at the repo root.

## Code layout: where to add things

| File | What's in it | Add… |
|---|---|---|
| `js/data.js` | Content and balance numbers | **Cars** → `MODELS`, **repair parts** → `COMPONENTS`, **mods** → `UPGRADES`, **touge races** → `EVENTS` (route, night, rivals, rival skill/tires/brakes, entry, purse) |
| `js/road.js` | The road network: the loop (`LOOP`, a list of arcs with a grade each), side roads (`BRANCH_DEFS`), race routes (`ROUTES`), and the racing line the rivals drive | Reshape the loop or add side roads. The map, 3D world, races and AI all follow automatically |
| `js/state.js` | Game state, save/load, car generation, pricing, performance math (condition + mods → hp/grip/brakes) | New stats or economy rules |
| `js/drive.js` | Driving in 3D: car physics (grip, drift, handbrake, slope gravity), rival AI on the racing line, locked camera, HUD, controls, wear/failures | Race and driving mechanics |
| `js/audio.js` | Synthesized engine, tire squeal and impact sounds (Web Audio, no sound files) | Sounds |
| `js/world3d.js` | The 3D scene: terrain shaped around the roads, road surfaces, guardrails, barriers, forest, cabin/tent/driveway, day/night lighting, skid marks, car model with headlights | Scenery and props |
| `js/map.js` | Top-down home map: layout (`HOME`), parking spots (`PARKING`), Select buttons, traffic, tap targets | Home layout, more parking spots |
| `js/main.js` | Phone UI and every app, plus the flow between the map, phone and driving | New apps or screens |
| `js/draw.js` | Shared 2D canvas helpers | |
| `lib/three.module.min.js` | [three.js](https://threejs.org) r160 (MIT), vendored so the game needs no install or network | |

For example, to add a car, add one line to `MODELS`:

```js
{ id: 'mr2', name: 'Toyoda MR-Two', years: [1991, 1995], hp: 200, weight: 1250, drive: 'RWD', price: 11000, parts: 1.0 },
```

It then shows up in the Marketplace, as long as it's wrecked enough to list under $5k.
