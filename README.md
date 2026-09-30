# Kansei Runners

A mobile-friendly browser game. Buy a junk car with $5,000, fix what's broken, drive it hard, and work your way up to faster cars. There's nothing to install: it runs in a phone browser with an HTML5 canvas and plain JavaScript.

## How to play

You start at **your cabin, deep in the forest**. It has a carport tent that fits one car, a gravel driveway in front of the tent with room for 2 more, and a winding 2-lane road out front. That's 3 parking spots, so you can own up to 3 cars.

- **Tap a parked car** to pull it under the tent as your ride and open it in the Garage.
- **Tap an empty spot** to open the Marketplace.
- **Tap the cabin** to sleep until tomorrow, which brings new Marketplace listings.
- **Tap 📱 Phone** to pull out your phone. **▾ Put away** puts it back.

1. **Open the Marketplace** on your phone. 6–10 used cars under $5k are listed each day, each with a price, factory specs (hp, handling, weight) and condition bars.
2. **Inspect before you buy ($80).** Striped bars marked `??` are systems the seller didn't disclose. Buy without inspecting and you find out what's wrong on the drive home.
3. **Open the Parts Shop** and buy parts for anything marked ⚠️: an engine rebuild kit, pads & rotors, a set of 4 tires, and so on. Performance mods are sold here too. Everything you buy goes in your trunk.
4. **Open the Garage** and tap **Install** (or **Install all**). This is where the car gets fixed and upgraded.
5. **Open Races** and pick an event. The Parking Lot Meet is the starter race. You race 2 AI cars, and 1st and 2nd place get paid.
6. **Drive:**
   - **◀ ▶** (bottom left) steer
   - **GAS / BRAKE** (bottom right)
   - On a keyboard, use the arrow keys or WASD.
   - Stay on the tarmac: grass slows you down and walls damage the car.
7. **Repeat.** Every race wears the car. Throttle wears the engine and transmission, sliding wears tires, grass wears suspension, and contact damages the body. A worn engine can blow mid-race, which is a DNF. Spend your winnings on repairs and mods, or sell the car (Marketplace → Sell) and move up.

Other things on the phone:
- **Sleep** (home screen) advances a day and refreshes the Marketplace.
- **Bank** shows your stats and history, and has **Start over**.
- **Messages** has tips from Kenji.

Progress saves automatically in the browser (localStorage), so refreshing won't lose it.

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
| `js/data.js` | All content and balance numbers | **Cars** → `MODELS`, **repair parts** → `COMPONENTS`, **mods** → `UPGRADES`, **races** → `EVENTS`, **tracks** → `TRACKS` (a list of control points, smoothed automatically) |
| `js/state.js` | Game state, save/load, car generation, pricing, performance math (condition + mods → hp/grip/brakes) | New stats or economy rules |
| `js/race.js` | Top-down race: car physics, AI speed profiles, wear, mid-race failures, rendering, touch controls | Race mechanics |
| `js/main.js` | Phone UI (home screen and every app), plus wiring between the map, phone and races | New apps or screens |
| `js/map.js` | Home map: cabin, tent, driveway, road, forest, traffic, tap targets. The `HOME` layout and `PARKING` spots are at the top | Move or add scenery and parking spots (more spots = more cars you can own) |
| `js/draw.js` | Shared canvas helpers: top-down car, seeded random, smooth paths | Shared drawing code |

For example, to add a car, add one line to `MODELS`:

```js
{ id: 'mr2', name: 'Toyoda MR-Two', years: [1991, 1995], hp: 200, weight: 1250, drive: 'RWD', price: 11000, parts: 1.0 },
```

It then shows up in the Marketplace, as long as it's wrecked enough to list under $5k.
