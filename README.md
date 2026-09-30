# Kansei Runners

A mobile-friendly browser game. Buy a junk car with $5,000, fix what's broken, drive it hard, and work your way up to faster cars. There's nothing to install: it runs in a phone browser with plain JavaScript and WebGL.

It's styled after **Gran Turismo 2** on the original PlayStation:
- **3D view:** rendered at low resolution with chunky pixels, 15-bit dithered color, wobbly vertex snapping and warping textures.
- **Scenery:** pixel-art textures, sprite trees and a painted sky panorama.
- **Cars:** low-poly models with glossy paint.
- **Menus:** GT-style chrome buttons, steel-blue panels and italic type.
- **Garage:** a spinning turntable showing your car.

## How to play

You start at **your cabin, deep in the forest**, shown top-down. It has a carport tent for one car, a gravel driveway in front of it for 2 more, and a mountain road out front. That's 3 parking spots, so you can own up to 3 cars.

**On the map:**
- **Select** (the yellow button next to each car) puts you in that car. The camera is locked close above and just behind the car with a wide 90° field of view, tilted enough to see its rear. Drive down the lane onto the road and go anywhere, including the side roads. Tap **🏠 Park** to go home.
- **Tap a parked car** to open it in the Garage.
- **Tap an empty spot** to open the Marketplace.
- **Tap the cabin** to sleep until tomorrow, which brings new listings.
- **📱 Phone** pulls out your phone. **▾ Put away** puts it back.

**The home road** is a 2.7 km touge loop around the mountain in front of the cabin, for free driving. It has 7 hairpins, a ridge over the summit and guardrails on the mountain sections, with side roads that end at "Road closed" barriers for now.

**Race courses** (from the phone's Touge app). Each takes about 2 minutes:
- **Kansei Pass:** ultra-winding downhill. It's 1.7 km of hairpins, sharp esses and square 90s with almost no straight road, and the corners are tight enough that passing is hard.
- **Switchback Ladder:** straight, hairpin, repeat. Nine straights joined by eight hairpins stacked down the mountain, so braking points win it.

**The loop:**
1. **Marketplace:** 6–10 used cars under $5k each day, all real late-80s cars: **1980 Volvo 242, Mercedes-Benz 190E 2.3, 1987 BMW 325i (E30), Toyota Supra Turbo (Mk3), Nissan 180SX and Nissan Skyline GTS-t (R32)**. Each has its real factory specs and a model built to its real proportions and details. The pricier ones only show up in your budget as project cars. Listings show with a price, factory specs (hp, handling, weight) and condition. Striped `??` bars are hidden problems, so tap **Inspect ($80)** before you buy.
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
| `js/data.js` | Content and balance numbers | **Cars** → `MODELS` (real specs and paint colors), **repair parts** → `COMPONENTS`, **mods** → `UPGRADES`, **races** → `RACES` and `DIFFICULTIES` |
| `js/road.js` | Road networks: the home loop and side roads, the race courses (`COURSES`), and racing lines | Reshape roads or add a course |
| `js/state.js` | Game state, save/load, car generation, pricing, performance math | New stats or economy rules |
| `js/drive.js` | Driving and racing: physics, rival AI, locked camera, HUD and tachometer, controls, wear | Race and driving mechanics |
| `js/ps1.js` | The PlayStation-style renderer: low-res buffer, dithering, vertex snapping, affine textures | Tweak the retro look (`lines`, dithering) |
| `js/textures.js` | Pixel-art textures drawn in code (road, grass, rock, rails, trees, sky, cabin, car details) | New textures |
| `js/carmodel.js` | Low-poly models of the real cars (`CARS`: real dimensions, profile, grille, lights, taillights, bumpers, wheels), glossy paint | New car models |
| `js/world3d.js` | One 3D world per road network: terrain, roads, rails, sprite forest, sky, cabin, lighting, skid marks | Scenery and props |
| `js/homeview.js` | The 3D home screen: cabin from above, parked cars, traffic, Select buttons, taps | Home screen behavior |
| `js/turntable.js` | The garage turntable | |
| `js/map.js` | Home layout (`HOME`) and parking spots (`PARKING`) | Move things at the cabin, more parking |
| `js/main.js` | Phone UI and every app, plus the flow between home, phone and driving | New apps or screens |
| `js/audio.js` | Synthesized engine, tire and impact sounds, plus the gearbox model | Sounds |
| `lib/three.module.min.js` | [three.js](https://threejs.org) r160 (MIT), vendored | |

To add a car, add a line to `MODELS` in `js/data.js` (real hp, weight, drive layout, a clean-car price and paint colors), and give it a shape in `CARS` in `js/carmodel.js` (real length, width and wheelbase, profile heights, and which grille, lights, taillights, bumpers and wheels it uses). It then shows up in the Marketplace whenever one is cheap enough to list under $5k.
