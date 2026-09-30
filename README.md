# Kansei Runners

A mobile game about buying a junk car with $5,000, fixing what's broken, driving it hard, and working your way up.

Your phone is your whole world. It has these apps:

| App | What it does |
|---|---|
| 🚗 **Marketplace** | Used cars that refresh daily. Sellers hide problems, so pay $80 to inspect before you buy. You can also sell cars here. |
| 🔧 **Parts** | Replace worn or broken components (engine, transmission, suspension, brakes, tires, body) and buy performance upgrades. |
| 🏠 **Garage** | Your cars, their stats and condition, and which one you're driving. |
| 🏁 **Races** | Four events, from the Parking Lot Meet to the Kansei Invitational. You pay an entry fee and win prize money. |
| 💵 **Bank** | Your money, stats and activity log. |
| 💬 **Messages** | Tips from Kenji, plus rivals who call you out as you win. |

## The loop

1. Buy whatever car your budget allows. Cheap cars are cheap for a reason.
2. Fix the major problems (⚠️). A bad engine can blow mid-race and your transmission can pop out of gear.
3. Race. Driving hard wears parts: throttle wears the engine and transmission, sliding wears tires, grass wears suspension, and walls and contact damage the body.
4. Spend your winnings on repairs and mods, or flip the car for something faster.

## Running it

It's plain HTML/CSS/JavaScript (ES modules) with no build step.

```bash
python3 -m http.server 8000
# open http://localhost:8000 (or http://<your-computer-ip>:8000 on your phone, same Wi-Fi)
```

Controls: on-screen ◀ ▶ / GAS / BRAKE on touch, or arrows/WASD on keyboard. Progress saves to localStorage.

## Code layout

- `js/data.js`: cars, components, upgrades, events, tracks (balance lives here)
- `js/state.js`: game state, car generation, value/repair pricing, performance math, save/load
- `js/race.js`: top-down race (car physics, AI speed profiles, wear, failures, rendering)
- `js/main.js`: phone UI and app screens

## Ideas for next steps

- Wrap with [Capacitor](https://capacitorjs.com/) to ship to iOS/Android stores
- Haggling with sellers, scams, and test drives before buying
- Mechanic skill tree (cheaper DIY repairs, better inspections)
- More tracks, night races, drift scoring events, pink-slip races
- Car sprites and sound (engine note from RPM, tire squeal)
