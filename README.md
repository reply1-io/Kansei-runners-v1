# Kansei Runners

A mobile-friendly browser game. Buy a junk car with $5,000, fix what's broken, drive it hard, and work your way up to faster cars. There's nothing to install: it runs in a phone browser with plain JavaScript and WebGL.

It's styled after **Gran Turismo 2** on the original PlayStation:
- **3D view:** rendered at low resolution with chunky pixels, 15-bit dithered color, wobbly vertex snapping and warping textures.
- **Scenery:** pixel-art textures, sprite trees and a painted sky panorama.
- **Cars:** low-poly models with glossy paint.
- **Menus:** GT-style chrome buttons, steel-blue panels and italic type.
- **Garage:** a spinning turntable showing your car.

**Look:** PlayStation-era graphics (Gran Turismo 2 style) seen through a Sony VX1000 / VHS camcorder: slight fisheye, colour fringing and bleed, still tape grain, scanlines, vignette and a ▶ PLAY / tape-counter display. Dense pine forest over rolling hills, with boulders, ponds and waterfalls in open glades, and a ring of snow-capped mountains on the horizon. (`setVhs(false)` in `js/ps1.js` turns the camcorder effect off.)

## How to play

You start at **your cabin, deep in the forest**, shown top-down. It has a carport tent for one car, a gravel driveway in front of it for 2 more, and a mountain road out front. That's 3 parking spots, so you can own up to 3 cars.

**On the map:**
- **Select** (the yellow button next to each car) puts you in that car. The camera is locked high up behind the car with a wide 90° field of view, looking down the road over the treetops; it turns exactly with the car and never swings on its own. The car sits just above the pedals so most of the screen is the road ahead. Trees near the road are kept short so they do not hide the next bend. Drive down the lane onto the road and go anywhere, including the side roads, which lead to the race courses. Tap **🏠 Park** to go home.
- **Cockpit camera:** tap **👁** (or press **C**) to drive from the driver's seat. You see the hood in your car's colour, the dash, the A-pillars, the mirror and a right-hand-drive steering wheel that turns with yours. Tap **🎥** to go back to the chase camera. The game remembers your choice.
- **Tap a parked car** to open it in the Garage.
- **Tap an empty spot** to open the Marketplace.
- **Tap the cabin** to sleep until tomorrow, which brings new listings.
- **📱 Phone** pulls out your phone. **▾ Put away** puts it back.

**The home road** is a 2.7 km touge loop around the mountain in front of the cabin, for free driving. It has 7 hairpins, a ridge over the summit and no guardrails (run wide and you're in the dirt, then the trees), with four side roads. **Everything is one connected map:** each side road is a real road out to a race course, passing under a wooden arch with the course's name and running straight onto the course's start line. Free drive any course from end to end; the far end of each course is closed off, so turn around and drive back. The minimap shows the roads around you.

| Side road | Leads to |
|---|---|
| Summit Lookout | Kansei Pass |
| Cliff Road | Switchback Ladder |
| Road to Town | Kuroiwa Canyon |
| Old Logging Road | Yamabiko Mountain Road |
| Circuit Road | Tsukuba Circuit (meets the back straight) |
| Drift Park Road | Meihan Drift |

**Race courses** (from the phone's Touge app). Each one is different:
- **Kansei Pass** (about 1:45): ultra-winding downhill. It's 1.7 km of hairpins, sharp esses and square 90s with almost no straight road, and the corners are tight enough that passing is hard.
- **Switchback Ladder** (about 2 minutes): straight, hairpin, repeat, 2.8 km down the face. A stack of three hairpins, a run of flowing S-bends across the face, a **one-lane** stretch along the cliff, a second stack of four hairpins (one leg has a fast kink in it), then S-bends to the finish. Braking points win it.
- **Kuroiwa Canyon** (4 to 5 minutes): 8.9 km of **wide** road (two 5.6 m lanes) with long flowing sweepers, S-bends and only **two hairpins**. It climbs into the mountain, runs 2 km through a natural rock canyon with walls nearly 40 m high, then drops out the other side.
- **Yamabiko Mountain Road** (about 5 minutes): 4.3 km of **narrow** road (two 3.3 m lanes, dashed centre line) with tight esses, square 90s and nine hairpins. It climbs, drops, climbs again and drops to the finish, about 145 m from top to bottom.

The two long courses pay **double** purses.

**Tracks:**
- **Tsukuba Circuit** (3 laps, about 1:10 a lap in an E30): modelled on Tsukuba TC2000, 2.04 km clockwise. The main straight, the fast 1st corner, the S-curve, the 1st hairpin, the long Dunlop left under the yellow footbridge, 80R, the 2nd hairpin, the long back straight and the sweeping final corner. 12 m wide, with red and white kerbs, wide grass run-off, tyre walls, a pit building and a grandstand. Races pay **1.5×**; the Hot Lap is one lap from a standing start.
- **Meihan Drift** (in the style of Meihan Sportsland): a tight, hilly 1 km drift park with concrete walls right at the edge, two hairpins, a downhill esse and a long sweeper. **Drift Attack** instead of a race: 2 laps, no rivals, scored on drifting.

**Drift scoring:** while the car is 12° to 100° sideways at speed on the tarmac, points flow in (angle × speed × combo). Linked drifts build the combo up to ×5; straighten up for more than 1.2 s and the chain is banked. Touch a wall or spin out and you lose the chain. Drift Attack pays $250 / $500 / $1,000 / $2,000 at 3,000 / 8,000 / 15,000 / 24,000 points, plus $500 for a new personal best. Clean grip driving scores about 2,500; a rough drifting bot scores about 13,000.

**The loop:**
1. **Marketplace:** 6–10 used cars under $5k each day, all real cars: **1980 Volvo 242, Mercedes-Benz 190E 2.3, 1987 BMW 325i (E30), Toyota Supra Turbo (Mk3), Nissan 180SX, Nissan Skyline GTS-t (R32) and 1999 Honda Civic Si hatch (FWD)**. Each has its real factory specs, and a model built from its real dimensions (length, width, height, wheelbase, overhangs, track, tire size and pillar positions). The pricier ones only show up in your budget as project cars. Each listing shows a price, factory specs (hp, handling, weight) and condition. Striped `??` bars are hidden problems, so tap **Inspect ($80)** before you buy.
2. **Parts Shop:** buy parts for anything marked ⚠️, plus performance mods. They go in your trunk.
   - **Drift Tires** ($700, one set): a slide is easier to start and hold. Power oversteer comes on readily, rotation carries on longer, less speed is scrubbed while sideways, and past about 40° of angle the slide is caught instead of spinning (helpful with all-or-nothing touch steering). They cost 8% outright grip, so once you own a set you can swap between drift and street tires for free in the Garage.
3. **Garage:** tap **Install** / **Install all**. Each car also has a **paint shop**: respray the body or refinish the wheels, $100 per change.
4. **Touge app:** pick a course and a difficulty: **Easy, Medium, Hard or Impossible**. Every race is free to enter and every difficulty is always open. Winning pays **$750 / $1,500 / $3,000 / $5,000** (Easy to Impossible; double on Kuroiwa Canyon and Yamabiko) and 2nd pays a fifth of that, on top of apex bonuses. Your best time for each shows on its button.
5. **Hot Lap:** each course also has a free Hot Lap with no rivals. The tiers ($250 / $500 / $1,000 / $2,000) are:

| Course | $250 | $500 | $1,000 | $2,000 |
|---|---|---|---|---|
| Kansei Pass | 1:41 | 1:34 | 1:29 | 1:25 |
| Switchback Ladder | 1:52 | 1:44 | 1:39 | 1:35 |
| Kuroiwa Canyon | 4:07 | 3:50 | 3:39 | 3:29 |
| Yamabiko | 4:18 | 4:00 | 3:48 | 3:37 |
| Tsukuba Circuit (1 lap) | 1:11 | 1:06 | 1:03 | 1:00 |
 You get the best tier you beat, plus **$500 every time you beat your own hot-lap record**. Apex markers still pay.
6. **Rivals are always fair.** They drive a car with **exactly your car's numbers** (power-to-weight, grip, brakes). Difficulty only changes how well they drive:
   - **Easy** rivals mostly keep to their lane, brake early and make mistakes, so the other lane is open to pass.
   - Each level up drives a cleaner racing line, which uses the whole road and closes the doors. They also commit harder in corners, brake later, and run wide less often.
   - Measured rival times (average of all rivals), Easy / Medium / Hard / Impossible: **Kansei Pass** about 1:41 / 1:34 / 1:29 / 1:24.5, **Switchback Ladder** about 1:51 / 1:43 / 1:37 / 1:30, **Kuroiwa Canyon** about 4:08 / 3:49 / 3:40 / 3:22, **Yamabiko** about 4:17 / 3:58 / 3:49 / 3:30 (about the same percentage faster than a flawless drive on each course). A flawless drive in an E30 is about 1:43 on the Pass, 1:53 on the Ladder, 4:10 in the Canyon and 4:20 on Yamabiko, so rivals keep your power-to-weight but get **extra grip and braking** that grows with the level: you win by out-braking them into corners, getting past and holding them off.
   - **Apex bonus:** every corner has a gold marker on the inside of its apex. Clip it for **+$50**. The running total shows under the minimap, and the result screen pays it out.
   - **Dirt cut-throughs:** each apex has a patch of packed dirt on the inside. Clip it to cut the corner a little when a rival is defending the inside.
   - **Rivals make mistakes on every level** (Impossible too, just rarely): they run wide and lose speed, opening a gap. Contact never shoves you forward.
   - **Rivals never drive the same line twice.** Each race they drift around the racing line in their own way, so gaps open in different places.
   - **Impossible fights back:** get 50 m clear of a rival and it finds extra power to chase you down, until it's back within 15 m.
   - You start at the back of the grid: **2 rivals on Easy, 3 on Medium, 4 on Hard and 5 on Impossible**, and have to get past. They pull the handbrake through the tightest hairpins, give you racing room when you're alongside, and go for gaps themselves.
7. **Drive:**
   - **◀ ▶** steer
   - **GAS**, **BRAKE** and **HANDBRAKE**. The handbrake works like a hydraulic one: it locks the rear wheels, so the rear steps out and the car rotates into the turn (quicker the faster you go) while the fronts keep steering. The rotation carries on for a moment after you let go, so catch the slide with steering and throttle. It only costs a little speed. Dirt shoulders are only slightly looser than the road.
   - On a keyboard, use arrows/WASD, with space for the handbrake.
   - Slide or spin the tires for 2 seconds and you'll see light tire smoke.
   - 🔊 toggles sound (engine, tire squeal, impacts).
8. Every drive wears the car. Throttle wears the engine and transmission, sliding wears tires, brakes wear on downhills, and hitting the trees or other cars damages the body. Bumping another car doesn't slow either of you down. A worn engine can blow. Spend your winnings on repairs and mods, or sell and move up.

Progress saves automatically in the browser (localStorage).

## Running it

It's plain HTML/CSS/JS ES modules with no build step. Browsers won't load modules from `file://`, so serve the folder:

```bash
python3 -m http.server 8000
```

- **Computer:** open http://localhost:8000
- **Phone:** connect to the same Wi-Fi, then open `http://<your-computer's-IP>:8000`
- **Hosted:** any static host works (GitHub Pages, Netlify and so on). Point it at the repo root.

### Full screen

- **Android / desktop:** the game goes full screen on your first tap (and again when you start driving). The **⛶** button (top right at home, next to 🔊 in a race) toggles it; if you turn it off, it stays off until you tap ⛶ again.
- **iPhone / any phone, best option:** open the hosted game in the browser (Safari: Share → **Add to Home Screen**; Chrome: ⋮ → **Add to Home screen** / **Install app**). Launched from its icon, it runs full screen with no browser bars (it ships a web app manifest and icons). iPhone Safari doesn't allow web pages to go full screen any other way, so the ⛶ button hides there.

## Code layout: where to add things

| File | What's in it | Add… |
|---|---|---|
| `js/data.js` | Content and balance numbers | **Cars** → `MODELS` (real specs and paint colors), **repair parts** → `COMPONENTS`, **mods** → `UPGRADES`, **races** → `RACES` and `DIFFICULTIES` |
| `js/road.js` | The map: the home loop, the roads out to the courses, the race courses (`COURSES`) placed around it, road width and canyon sections per point, and racing lines | Reshape roads, move or add a course |
| `js/state.js` | Game state, save/load, car generation, pricing, performance math | New stats or economy rules |
| `js/drive.js` | Driving and racing: physics, rival AI, chase camera, HUD and tachometer, controls, wear | Race and driving mechanics |
| `js/ps1.js` | The PlayStation-style renderer: low-res buffer, dithering, vertex snapping, affine textures | Tweak the retro look (`lines`, dithering) |
| `js/textures.js` | Pixel-art textures drawn in code (road, grass, rock, trees, sky, cabin, car details) | New textures |
| `js/carmodel.js` | Low-poly models of the real cars (`CARS`: real dimensions, profile, grille, lights, taillights, bumpers, wheels), glossy paint | New car models |
| `js/world3d.js` | The one 3D world for the whole map: roads, canyon walls, arches, sky, cabin, lighting, skid marks, and the ground, sprite forest and boulders, which are streamed in 320 m tiles as the camera gets near | Scenery and props |
| `js/homeview.js` | The 3D home screen: cabin from above, parked cars, traffic, Select buttons, taps | Home screen behavior |
| `js/turntable.js` | The garage turntable | |
| `js/map.js` | Home layout (`HOME`) and parking spots (`PARKING`) | Move things at the cabin, more parking |
| `js/main.js` | Phone UI and every app, plus the flow between home, phone and driving | New apps or screens |
| `js/audio.js` | Turbo flutter on lift-off (factory turbos: Supra, 180SX, R32; or any car with a turbo kit). Synthesized engine (exhaust-pulse loops rendered in code at 4 rpm points and crossfaded by rpm; 4- or 6-cylinder per car), intake, tire and impact sounds, plus the gearbox model | Sounds |
| `lib/three.module.min.js` | [three.js](https://threejs.org) r160 (MIT), vendored | |

To add a car, add a line to `MODELS` in `js/data.js` (real hp, weight, drive layout, a clean-car price and paint colors), and give it a shape in `CARS` in `js/carmodel.js` (real length, width, height, wheelbase, front overhang, track and tire size; the side profile as distances behind the front axle; and which grille, lights, taillights, bumpers and wheels it uses). It then shows up in the Marketplace whenever one is cheap enough to list under $5k.
