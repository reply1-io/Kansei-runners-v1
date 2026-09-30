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
  { id: 'supra',    name: 'Toyota Supra Turbo (Mk3)',  years: [1987, 1992], hp: 230, weight: 1600, drive: 'RWD', cyl: 6, price: 8000,  parts: 1.1,
    colors: ['#f0f0ec', '#b4161b', '#141414', '#27427a', '#8f959b'] },
  { id: 's180sx',   name: 'Nissan 180SX',              years: [1991, 1994], hp: 202, weight: 1220, drive: 'RWD', cyl: 4, price: 9000,  parts: 0.9,
    colors: ['#f2f2ee', '#a81a1e', '#141414', '#3c4a8a', '#b8bcc2'] },
  { id: 'r32',      name: 'Nissan Skyline GTS-t (R32)', years: [1989, 1993], hp: 212, weight: 1340, drive: 'RWD', cyl: 6, price: 11000, parts: 1.0,
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

export const COLORS = ['#e8e8e8', '#d63031', '#0984e3', '#2d3436', '#fdcb6e', '#00b894', '#6c5ce7', '#e17055', '#b2bec3', '#fab1a0'];

// Two race courses (geometry in js/road.js), each ~2 minutes, each at four difficulties.
// Rivals ALWAYS drive a car with exactly your car's numbers (power-to-weight, grip, brakes), so it's
// always fair. Difficulty only changes how well they drive:
//   line:    how close to the ideal racing line they drive (0 = keeps to one lane, 1 = perfect line
//            using the whole road, which also leaves you the least room to pass)
//   commit:  how much of the car's grip they dare to use in corners
//   brake:   how late and hard they brake
//   mistakeEvery: roughly how often (seconds) one of them runs wide or brakes early, opening a door
// commit/brake are per course, calibrated against a test driver: rivals ride their line perfectly,
// so these land lower than 1.0 to put each level where a human driver actually is.
// You start behind two of them and have to get past.
export const RACES = [
  { id: 'pass', course: 'pass', name: 'Kansei Pass', style: 'Ultra-winding downhill',
    desc: 'Hairpin after hairpin, sharp esses and square 90s, almost no straight road. Line is everything, and passing is hard.',
    levels: { easy: { commit: 0.84, brake: 0.66 }, medium: { commit: 0.865, brake: 0.68 }, hard: { commit: 0.95, brake: 0.9 }, impossible: { commit: 1.0, brake: 1.0 } } },
  { id: 'ladder', course: 'ladder', name: 'Switchback Ladder', style: 'Straight, hairpin, repeat',
    desc: 'Flat out down a straight, stand on the brakes, swing it around a hairpin, do it again. Nine times. Braking points win this one.',
    levels: { easy: { commit: 0.88, brake: 0.64 }, medium: { commit: 1.0, brake: 0.64 }, hard: { commit: 1.0, brake: 0.775 }, impossible: { commit: 1.0, brake: 1.0 } } },
];

export const DIFFICULTIES = {
  easy:       { label: 'Easy',       line: 0.65, mistakeEvery: 24, rivals: ['Kenta', 'Itsuki'],    entry: 50,   purse: [500, 100] },
  medium:     { label: 'Medium',     line: 0.8,  mistakeEvery: 36, rivals: ['Iketani', 'Kenji'],   entry: 150,  purse: [1200, 250] },
  hard:       { label: 'Hard',       line: 0.97, mistakeEvery: 90, rivals: ['Ryo', 'Keisuke'],     entry: 400,  purse: [3500, 700] },
  impossible: { label: 'Impossible', line: 1.0,  mistakeEvery: 1e9, equalPair: true, rivals: ['The Ghost', 'Bunta'], entry: 1000, purse: [12000, 2000] },
};
