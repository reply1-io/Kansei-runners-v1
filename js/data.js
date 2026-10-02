// Static game data: cars, components, upgrades, races.

export const START_MONEY = 5000;
export const INSPECTION_COST = 80;
export const MARKET_PRICE_CAP = 5000; // every Marketplace listing is under this

// body: which low-poly body style the car uses (see js/// The cars you can find for under $5k. Specs are the real factory numbers (hp, kg, layout); `price` is
// what a clean one is worth in-game, so the pricier ones only show up in your budget as project cars.
// The 3D model for each is in js/carmodel.js (by id). `colors` are period-correct paint colors.
export const MODELS = [
  { id: 'volvo242', name: 'Volvo 242',                 years: [1980, 1980], hp: 107, weight: 1250, drive: 'RWD', cyl: 4, price: 4200,  parts: 0.6,
    colors: ['#c9b58a', '#2f4a36', '#8fa9c4', '#8c1f1c', '#e8e4d8', '#3a3a3a'] },
  { id: 'civic',    name: 'Honda Civic Si Hatch',      years: [1999, 1999], hp: 160, weight: 1120, drive: 'FWD', cyl: 4, price: 6000,  parts: 0.7,
    colors: ['#1f4fa0', '#efefe9', '#b0161c', '#141414', '#b6b9bd', '#c9a21a'] },
  { id: 'mb190e',   name: 'Mercedes-Benz 190E 2.3',    years: [1985, 1990], hp: 130, weight: 1200, drive: 'RWD', cyl: 4, price: 5500,  parts: 0.8,
    colors: ['#b9bcc0', '#1c2433', '#e9e6dc', '#5a1d22', '#6f7f86', '#161616'] },
  { id: 'e30',      name: 'BMW 325i',                  years: [1987, 1987], hp: 168, weight: 1230, drive: 'RWD', cyl: 6, price: 7000,  parts: 0.8,
    colors: ['#f2f2ee', '#b3231e', '#141414', '#1d3a6b', '#9aa3a8', '#2c4a3b'] },
  { id: 'supra',    name: 'Toyota Supra Turbo (Mk3)',  years: [1987, 1992], hp: 230, weight: 1600, drive: 'RWD', cyl: 6, turbo: true, price: 8000,  parts: 1.1,
    colors: ['#f0f0ec', '#b4161b', '#141414', '#27427a', '#8f959b'] },
  { id: 's180sx',   name: 'Nissan 180SX',              years: [1991, 1994], hp: 202, weight: 1220, drive: 'RWD', cyl: 4, turbo: true, price: 9000,  parts: 0.9,
    colors: ['#f2f2ee', '#a81a1e', '#141414', '#3c4a8a', '#b8bcc2'] },
  { id: 'r32',      name: 'Nissan Skyline GTS-t (R32)', years: [1989, 1993], hp: 212, weight: 1340, drive: 'RWD', cyl: 6, turbo: true, price: 11000, parts: 1.0,
    colors: ['#5e6267', '#f2f2ee', '#141414', '#7a1418', '#2b3d63'] },
];

export const COMPONENTS = [
  { id: 'engine', part: 'Engine rebuild kit', name: 'Engine',       repair: 1600, weightInValue: 0.35,
    problems: ['Blown head gasket', 'Low compression', 'Spun rod bearing', 'Burning oil'] },
  { id: 'trans',  part: 'Clutch & gearbox rebuild', name: 'Transmission', repair: 900,  weightInValue: 0.2,
    problems: ['Slipping clutch', 'Grinding 3rd gear', 'Pops out of gear', 'Worn synchros'] },
  { id: 'susp',   part: 'Shocks, springs & bushings', name: 'Suspension',   repair: 550,  weightInValue: 0.15,
    problems: ['Blown shocks', 'Worn bushings', 'Bent control arm', 'Sagging springs'] },
  { id: 'brakes', part: 'Pads & rotors', name: 'Brakes',       repair: 320,  weightInValue: 0.1,
    problems: ['Warped rotors', 'Metal-on-metal pads', 'Leaking caliper', 'Spongy pedal'] },
  { id: 'tires',  part: 'Set of 4 tires', name: 'Tires',        repair: 380,  weightInValue: 0.05,
    problems: ['Bald tires', 'Dry-rotted tires', 'Mismatched tires', 'Bulging sidewall'] },
  { id: 'body',   part: 'Body panels & rust repair', name: 'Body',         repair: 650,  weightInValue: 0.15,
    problems: ['Rusted rocker panels', 'Crumpled fender', 'Cracked bumper', 'Rust in the floor'] },
];

// Below this condition a component is a "major problem".
export const PROBLEM_THRESHOLD = 35;
// Below this the car will not run.
export const DEAD_THRESHOLD = 8;

export const UPGRADES = [
  { id: 'intake',  name: 'Intake + Exhaust', desc: '+8% power per level',       max: 3, cost: [450, 900, 1600] },
  { id: 'ecu',     name: 'ECU Tune',         desc: '+10% power per level',      max: 2, cost: [800, 1800] },
  { id: 'turbo',   name: 'Turbo Kit',        desc: '+25% power/level, more engine wear', max: 3, cost: [3500, 6500, 11000] },
  { id: 'tires',   name: 'Performance Tires',desc: '+8% grip per level',        max: 3, cost: [600, 1200, 2200] },
  { id: 'coilovers',name:'Coilovers',        desc: '+5% grip, sharper turn-in', max: 2, cost: [1200, 2600] },
  { id: 'bbk',     name: 'Big Brake Kit',    desc: '+20% braking per level',    max: 2, cost: [900, 2000] },
  { id: 'weight',  name: 'Weight Reduction', desc: '-5% weight per level',      max: 3, cost: [500, 1300, 3000] },
];

export const SELLERS = [
  'Dale (moving out of state)', 'Kenji', 'My uncle\'s car', 'Brenda — widow sale', 'Tuner shop clearout',
  'College kid', 'Tony\'s Auto', 'Retired mechanic', 'Guy who "knows cars"', 'Estate sale', 'Mike R.', 'Anon',
];

export const SELLER_NOTES = [
  'Runs and drives. Just needs a little TLC.',
  'Daily driven until last week. No lowballers, I know what I have.',
  'Mechanic special. Cash only.',
  'Was going to project it, lost interest.',
  'Minor issues, nothing major (probably).',
  'Clean title. AC blows cold-ish.',
  'Starts every time!! Mostly.',
  'Wife says it has to go.',
  'Selling as-is, no returns.',
  'Garage kept. Some surface rust.',
];

// Paint shop: body colours on top of each model's factory colours, and wheel finishes. $PAINT_COST each.
export const PAINT_COST = 100;
export const PAINT_COLORS = ['#f2f2ee', '#141414', '#b3231e', '#e8a317', '#1f4fa0', '#2c6e49', '#6a2c91', '#ff6b1a', '#9aa3a8', '#4a5560', '#00a6a6', '#f4c2c2'];
export const WHEEL_COLORS = [['Silver', '#d8dbe0'], ['Gunmetal', '#5a6068'], ['Black', '#2a2a2a'], ['Gold', '#d4a640'], ['Bronze', '#9c6b3c'], ['White', '#ffffff']];
export const COLORS = ['#e8e8e8', '#d63031', '#0984e3', '#2d3436', '#fdcb6e', '#00b894', '#6c5ce7', '#e17055', '#b2bec3', '#fab1a0'];

// Race courses (geometry in js/road.js): two short touge courses (~2 minutes), two long ones (4-5
// minutes, paying double: `purseScale`), a circuit (`laps`), each at four difficulties; and a drift
// park (`mode: 'drift'`), scored on drifting and paid by score (`drift`: [score, reward] tiers).
// Rivals ALWAYS drive a car with exactly your car's numbers (power-to-weight, grip, brakes), so it's
// always fair. Difficulty only changes how well they drive:
//   line:    how close to the ideal racing line they drive (0 = keeps to one lane, 1 = perfect line
//            using the whole road, which also leaves you the least room to pass)
//   commit:  how much of the car's grip they dare to use in corners
//   brake:   how late and hard they brake
//   mistakeEvery: roughly how often (seconds) one of them runs wide or brakes early, opening a door
// commit/brake are per course, calibrated against a test driver: rivals ride their line perfectly,
// so these land lower than 1.0 to put each level where a human driver actually is.
// You start behind them (2 on Easy up to 5 on Impossible) and have to get past.
export const RACES = [
  { id: 'pass', course: 'pass', name: 'Kansei Pass', style: 'Ultra-winding downhill',
    desc: 'Hairpin after hairpin, sharp esses and square 90s, almost no straight road. Line is everything, and passing is hard.',
    hotlap: [[101, 250], [94, 500], [89, 1000], [85, 2000]],
    levels: { easy: { commit: 1.16, brake: 1.35 }, medium: { commit: 1.33, brake: 1.6 }, hard: { commit: 1.47, brake: 1.85 }, impossible: { commit: 1.66, brake: 2.1 } } },
  { id: 'ladder', course: 'ladder', name: 'Switchback Ladder', style: 'Straight, hairpin, repeat',
    desc: 'Flat out down a straight, stand on the brakes, swing it around a hairpin, again and again. In between: flowing S-bends across the face and a one-lane stretch along the cliff. Braking points win this one.',
    hotlap: [[112, 250], [104, 500], [99, 1000], [95, 2000]],
    levels: { easy: { commit: 1.07, brake: 1.3 }, medium: { commit: 1.33, brake: 1.9 }, hard: { commit: 1.62, brake: 2.7 }, impossible: { commit: 2.0, brake: 3.6 } } },
  { id: 'canyon', course: 'canyon', name: 'Kuroiwa Canyon', style: 'Wide, fast and flowing', purseScale: 2,
    desc: 'A wide road of long sweepers up into the mountain and through a rock canyon, with just two hairpins. Carry your speed and commit.',
    hotlap: [[247, 250], [230, 500], [219, 1000], [209, 2000]],
    levels: { easy: { commit: 1.1, brake: 1.3 }, medium: { commit: 1.31, brake: 1.62 }, hard: { commit: 1.58, brake: 2.0 }, impossible: { commit: 2.02, brake: 2.57 } } },
  { id: 'yamabiko', course: 'yamabiko', name: 'Yamabiko Mountain Road', style: 'Long, narrow and steep', purseScale: 2,
    desc: 'A narrow back road that climbs and drops over the mountains: tight esses, hairpins and blind crests for five minutes straight.',
    hotlap: [[258, 250], [240, 500], [228, 1000], [217, 2000]],
    levels: { easy: { commit: 1.16, brake: 1.35 }, medium: { commit: 1.33, brake: 1.6 }, hard: { commit: 1.47, brake: 1.85 }, impossible: { commit: 1.72, brake: 2.2 } } },
  { id: 'tsukuba', course: 'tsukuba', name: 'Tsukuba Circuit', style: 'Circuit race · 3 laps', laps: 3, purseScale: 1.5,
    desc: 'A proper racetrack, modelled on Tsukuba TC2000: the main straight, the 1st corner, the S-curve, two hairpins, the long Dunlop left under the footbridge, 80R, the back straight and the fast final corner. Wide, with kerbs and run-off.',
    hotlap: [[71, 250], [66, 500], [63, 1000], [60, 2000]],
    levels: { easy: { commit: 1.12, brake: 1.3 }, medium: { commit: 1.38, brake: 1.7 }, hard: { commit: 1.6, brake: 2.08 }, impossible: { commit: 1.95, brake: 2.6 } } },
  { id: 'meihan', course: 'meihan', name: 'Meihan Drift', style: 'Drift attack · 2 laps', mode: 'drift', laps: 2,
    desc: 'A tight, hilly drift park in the style of Meihan Sportsland, with concrete walls right at the edge. No rivals: get sideways and stay sideways. Points for angle and speed; link drifts to build the combo up to x5. Touch a wall or spin and you lose the chain.',
    drift: [[3000, 250], [8000, 500], [15000, 1000], [24000, 2000]] },
];

// Hot lap: no rivals, just you against the clock. Each race's `hotlap` lists [time in seconds, reward]:
// finish under that time to earn it (you get the best tier you beat, e.g. 1:40.x on the Pass pays $250).
// Beat your own hot-lap record and you get HOTLAP_RECORD_BONUS on top.
export const HOTLAP_RECORD_BONUS = 500;

export const DIFFICULTIES = {
  easy:       { label: 'Easy',       line: 0.65, mistakeEvery: 20, rivals: ['Kenta', 'Itsuki'],    purse: [750, 150] },
  medium:     { label: 'Medium',     line: 0.8,  mistakeEvery: 28, rivals: ['Iketani', 'Kenji', 'Shingo'],   purse: [1500, 300] },
  hard:       { label: 'Hard',       line: 0.97, mistakeEvery: 40, rivals: ['Ryo', 'Keisuke', 'Nakazato', 'Kyoichi'],     purse: [3000, 600] },
  impossible: { label: 'Impossible', line: 1.0,  mistakeEvery: 55, equalPair: true, catchUp: true, rivals: ['The Ghost', 'Bunta', 'Takumi', 'Sudo', 'Akiyama'], purse: [5000, 1000] },
};
