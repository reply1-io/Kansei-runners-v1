# Kansei Runners

A mobile-friendly browser game. Buy a junk car with $5,000, fix what's broken, drive it hard, and work your way up to faster cars. There's nothing to install: it runs in a phone browser with an HTML5 canvas and plain JavaScript.

## How to play

You start at **your cabin, deep in the forest**, shown top-down. It has a carport tent for one car, a gravel driveway in front of it for 2 more, and a mountain road out front. That's 3 parking spots, so you can own up to 3 cars.

**On the map:**
- **Select** (the yellow button next to each car) puts you in that car and switches to a close 3/4 chase view. Drive down the lane onto the road and go wherever you like. Tap **🏠 Park** to go home.
- **Tap a parked car** to open it in the Garage.
- **Tap an empty spot** to open the Marketplace.
- **Tap the cabin** to sleep until tomorrow, which brings new listings.
- **📱 Phone** pulls out your phone. **▾ Put away** puts it back.

**The road** is a touge: 1.1 km from the cabin to the summit, with 5 hairpins (the tightest is 9.5 m radius), grades up to 10%, and 75 m of climb. Guardrails line the mountain section. Gravity is simulated, so uphill slows you and downhill pulls you into the hairpins.

**The loop:**
1. **Marketplace:** 6–10 used cars under $5k each day, with a price, factory specs (hp, handling, weight) and condition. Striped `??` bars are hidden problems, so tap **Inspect ($80)** before you buy.
2. **Parts Shop:** buy parts for anything marked ⚠️, plus performance mods. They go in your trunk.
3. **Garage:** tap **Install** / **Install all**.
4. **Touge app:** street races on your road, **uphill** (cabin → summit) or **downhill** (summit → cabin), against 1–2 rivals:
   - **Kenta** (uphill): a stock beater can beat him.
   - **Iketani** (downhill): needs a few mods, or clean driving.
   - **Ryo & Shingo** (uphill night hillclimb): needs a properly modded car.
   - **The Ghost** (downhill): needs a serious, grip-focused build.
5. **Drive:**
   - **◀ ▶** steer
   - **GAS / BRAKE**
   - On a keyboard, use the arrow keys or WASD.
   - The HUD shows your position, gap to the rival, time, meters to go and a minimap.
6. Every drive wears the car. Throttle wears the engine and transmission, sliding wears tires, brakes wear on downhills, and guardrails and contact damage the body. A worn engine can blow. Spend your winnings on repairs and mods, or sell and move up.

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
| `js/data.js` | Content and balance numbers | **Cars** → `MODELS`, **repair parts** → `COMPONENTS`, **mods** → `UPGRADES`, **touge races** → `EVENTS` (direction, rivals, pace, entry, purse) |
| `js/road.js` | The touge, built from straights and arcs with a grade each (`MOUNTAIN` / `VALLEY` lists) | New hairpins or sections: edit the segment lists. The map, 3D world, races and AI all follow automatically |
| `js/state.js` | Game state, save/load, car generation, pricing, performance math (condition + mods → hp/grip/brakes) | New stats or economy rules |
| `js/drive.js` | Driving in 3D: car physics (grip, drift, slope gravity), rival AI, chase camera, HUD, controls, wear/failures | Race and driving mechanics |
| `js/world3d.js` | The 3D scene: terrain shaped around the road, road surface, guardrails, forest, cabin/tent/driveway, car model | Scenery and props |
| `js/map.js` | Top-down home map: layout (`HOME`), parking spots (`PARKING`), Select buttons, traffic, tap targets | Home layout, more parking spots |
| `js/main.js` | Phone UI and every app, plus the flow between the map, phone and driving | New apps or screens |
| `js/draw.js` | Shared 2D canvas helpers | |
| `lib/three.module.min.js` | [three.js](https://threejs.org) r160 (MIT), vendored so the game needs no install or network | |

For example, to add a car, add one line to `MODELS`:

```js
{ id: 'mr2', name: 'Toyoda MR-Two', years: [1991, 1995], hp: 200, weight: 1250, drive: 'RWD', price: 11000, parts: 1.0 },
```

It then shows up in the Marketplace, as long as it's wrecked enough to list under $5k.
