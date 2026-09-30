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

**The home road** is a 2.7 km touge loop around the mountain in front of the cabin, for free driving. It has 7 hairpins, a ridge over the summit and guardrails on the mountain sections, with side roads that end at "Road closed" barriers for now.

**Race courses** (from the phone's Touge app). Each takes about 2 minutes:
- **Kansei Pass:** ultra-winding downhill. It's 1.7 km of hairpins, sharp esses and square 90s with almost no straight road, and the corners are tight enough that passing is hard.
- **Switchback Ladder:** straight, hairpin, repeat. Nine straights joined by eight hairpins stacked down the mountain, so braking points win it.

**The loop:**
1. **Marketplace:** 6–10 used cars under $5k each day, with a price, factory specs (hp, handling, weight) and condition. Striped `??` bars are hidden problems, so tap **Inspect ($80)** before you buy.
2. **Parts Shop:** buy parts for anything marked ⚠️, plus performance mods. They go in your trunk.
3. **Garage:** tap **Install** / **Install all**.
4. **Touge app:** pick a course and a difficulty: **Easy, Medium, Hard or Impossible**. Your best time for each shows on its button.
5. **Rivals are always fair.** They drive a car with **exactly your car's numbers** (power-to-weight, grip, brakes). Difficulty only changes how well they drive:
   - **Easy** rivals mostly keep to their lane, brake early and make mistakes, so the other lane is open to pass.
   - Each level up drives a cleaner racing line, which uses the whole road and closes the doors. They also commit harder in corners, brake later, and run wide less often.
   - **Impossible** runs the ideal line and almost never slips. It's beatable, but you need near-perfect lines and a clean pass.
   - You start behind two rivals and have to get past. They pull the handbrake through the tightest hairpins, give you racing room when you're alongside, and go for gaps themselves.
6. **Drive:**
   - **◀ ▶** steer
   - **GAS**, **BRAKE** and **HAND BRAKE**; pull the handbrake to swing the rear around hairpins.
   - On a keyboard, use arrows/WASD, with space for the handbrake.
   - 🔊 toggles sound (engine, tire squeal, impacts).
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
| `js/data.js` | Content and balance numbers | **Cars** → `MODELS`, **repair parts** → `COMPONENTS`, **mods** → `UPGRADES`, **races** → `RACES` (per-course rival calibration) and `DIFFICULTIES` (line quality, mistakes, rivals, entry, purse) |
| `js/road.js` | Road networks: the home loop (`LOOP`, arcs with a grade each) and side roads (`BRANCH_DEFS`), the race courses (`COURSES`: Kansei Pass is generated from corner blocks with a fixed seed; Switchback Ladder is a list of straights and hairpins), and racing lines (`lineVariant`) | Reshape roads or add a course. The 3D world, races and AI follow automatically |
| `js/state.js` | Game state, save/load, car generation, pricing, performance math (condition + mods → hp/grip/brakes) | New stats or economy rules |
| `js/drive.js` | Driving in 3D on any road network: car physics (grip, drift, handbrake, slope gravity), rival AI (racing line, commitment, mistakes, racing room, passing), locked camera, HUD, controls, wear/failures | Race and driving mechanics |
| `js/audio.js` | Synthesized engine, tire squeal and impact sounds (Web Audio, no sound files) | Sounds |
| `js/world3d.js` | One 3D scene per road network, built on first use: terrain shaped around the roads, road surfaces, guardrails, barriers, forest, cabin/tent/driveway, day/night lighting, skid marks, car model with headlights | Scenery and props |
| `js/map.js` | Top-down home map: layout (`HOME`), parking spots (`PARKING`), Select buttons, traffic, tap targets | Home layout, more parking spots |
| `js/main.js` | Phone UI and every app, plus the flow between the map, phone and driving | New apps or screens |
| `js/draw.js` | Shared 2D canvas helpers | |
| `lib/three.module.min.js` | [three.js](https://threejs.org) r160 (MIT), vendored so the game needs no install or network | |

For example, to add a car, add one line to `MODELS`:

```js
{ id: 'mr2', name: 'Toyoda MR-Two', years: [1991, 1995], hp: 200, weight: 1250, drive: 'RWD', price: 11000, parts: 1.0 },
```

It then shows up in the Marketplace, as long as it's wrecked enough to list under $5k.
