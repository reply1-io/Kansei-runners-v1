// Static game data: car models, components, upgrades, events, tracks.
// Brand names are fictional on purpose.

export const START_MONEY = 5000;
export const INSPECTION_COST = 80;
export const MARKET_PRICE_CAP = 5000; // every Marketplace listing is under this

// body: which low-poly body style the car uses (see js/carmodel.js); wing: 0 none, 1 lip, 2 tall.
export const MODELS = [
  { id: 'camra',   name: 'Toyoda Camra',        years: [1992, 1996], hp: 130, weight: 1400, drive: 'FWD', price: 3200,  parts: 0.6, body: 'sedan' },
  { id: 'accordo', name: 'Hondo Accordo',       years: [1990, 1993], hp: 140, weight: 1330, drive: 'FWD', price: 3600,  parts: 0.6, body: 'sedan' },
  { id: 'civix',   name: 'Hondo Civix EG',      years: [1992, 1995], hp: 125, weight: 1050, drive: 'FWD', price: 6000,  parts: 0.7, body: 'hatch' },
  { id: 'roadstar',name: 'Mazdo Roadstar NA',   years: [1990, 1997], hp: 115, weight: 960,  drive: 'RWD', price: 7000,  parts: 0.7, body: 'roadster' },
  { id: 'kaze86',  name: 'Toyoda Kaze 86',      years: [1984, 1987], hp: 112, weight: 950,  drive: 'RWD', price: 12000, parts: 0.9, body: 'hatch' },
  { id: 's13',     name: 'Nissaka 240S',        years: [1989, 1994], hp: 155, weight: 1250, drive: 'RWD', price: 10000, parts: 0.9, body: 'coupe' },
  { id: 'fc',      name: 'Mazdo RX-7 FC',       years: [1986, 1991], hp: 180, weight: 1220, drive: 'RWD', price: 14000, parts: 1.1, body: 'fastback' },
  { id: 's14',     name: 'Nissaka Silvio S14',  years: [1995, 1998], hp: 220, weight: 1240, drive: 'RWD', price: 18000, parts: 1.1, body: 'coupe', wing: 1 },
  { id: 'wrx',     name: 'Subaro Impreza WRX',  years: [1994, 2000], hp: 225, weight: 1250, drive: 'AWD', price: 16000, parts: 1.2, body: 'rally', wing: 1 },
  { id: 'evo',     name: 'Mitsuba Lancer Evo',  years: [1996, 2001], hp: 276, weight: 1260, drive: 'AWD', price: 32000, parts: 1.5, body: 'rally', wing: 2 },
  { id: 'r32',     name: 'Nissaka Skyliner R32',years: [1989, 1994], hp: 276, weight: 1430, drive: 'AWD', price: 45000, parts: 1.8, body: 'coupe', wing: 1 },
  { id: 'supremo', name: 'Toyoda Supremo MK4',  years: [1993, 1998], hp: 320, weight: 1500, drive: 'RWD', price: 60000, parts: 2.0, body: 'gt', wing: 2 },
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
    levels: { easy: { commit: 0.72, brake: 0.38 }, medium: { commit: 0.75, brake: 0.4 }, hard: { commit: 0.75, brake: 0.46 }, impossible: { commit: 0.8, brake: 0.55 } } },
  { id: 'ladder', course: 'ladder', name: 'Switchback Ladder', style: 'Straight, hairpin, repeat',
    desc: 'Flat out down a straight, stand on the brakes, swing it around a hairpin, do it again. Nine times. Braking points win this one.',
    levels: { easy: { commit: 0.84, brake: 0.37 }, medium: { commit: 1.0, brake: 0.41 }, hard: { commit: 1.0, brake: 0.51 }, impossible: { commit: 1.0, brake: 0.63 } } },
];

export const DIFFICULTIES = {
  easy:       { label: 'Easy',       line: 0.3,  mistakeEvery: 12, rivals: ['Kenta', 'Itsuki'],    entry: 50,   purse: [500, 100] },
  medium:     { label: 'Medium',     line: 0.6,  mistakeEvery: 18, rivals: ['Iketani', 'Kenji'],   entry: 150,  purse: [1200, 250] },
  hard:       { label: 'Hard',       line: 0.85, mistakeEvery: 26, rivals: ['Ryo', 'Keisuke'],     entry: 400,  purse: [3500, 700] },
  impossible: { label: 'Impossible', line: 1.0,  mistakeEvery: 40, rivals: ['The Ghost', 'Bunta'], entry: 1000, purse: [12000, 2000] },
};
