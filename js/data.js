// Static game data: car models, components, upgrades, events, tracks.
// Brand names are fictional on purpose.

export const START_MONEY = 5000;
export const INSPECTION_COST = 80;
export const MARKET_PRICE_CAP = 5000; // every Marketplace listing is under this

export const MODELS = [
  { id: 'camra',   name: 'Toyoda Camra',        years: [1992, 1996], hp: 130, weight: 1400, drive: 'FWD', price: 3200,  parts: 0.6 },
  { id: 'accordo', name: 'Hondo Accordo',       years: [1990, 1993], hp: 140, weight: 1330, drive: 'FWD', price: 3600,  parts: 0.6 },
  { id: 'civix',   name: 'Hondo Civix EG',      years: [1992, 1995], hp: 125, weight: 1050, drive: 'FWD', price: 6000,  parts: 0.7 },
  { id: 'roadstar',name: 'Mazdo Roadstar NA',   years: [1990, 1997], hp: 115, weight: 960,  drive: 'RWD', price: 7000,  parts: 0.7 },
  { id: 'kaze86',  name: 'Toyoda Kaze 86',      years: [1984, 1987], hp: 112, weight: 950,  drive: 'RWD', price: 12000, parts: 0.9 },
  { id: 's13',     name: 'Nissaka 240S',        years: [1989, 1994], hp: 155, weight: 1250, drive: 'RWD', price: 10000, parts: 0.9 },
  { id: 'fc',      name: 'Mazdo RX-7 FC',       years: [1986, 1991], hp: 180, weight: 1220, drive: 'RWD', price: 14000, parts: 1.1 },
  { id: 's14',     name: 'Nissaka Silvio S14',  years: [1995, 1998], hp: 220, weight: 1240, drive: 'RWD', price: 18000, parts: 1.1 },
  { id: 'wrx',     name: 'Subaro Impreza WRX',  years: [1994, 2000], hp: 225, weight: 1250, drive: 'AWD', price: 16000, parts: 1.2 },
  { id: 'evo',     name: 'Mitsuba Lancer Evo',  years: [1996, 2001], hp: 276, weight: 1260, drive: 'AWD', price: 32000, parts: 1.5 },
  { id: 'r32',     name: 'Nissaka Skyliner R32',years: [1989, 1994], hp: 276, weight: 1430, drive: 'AWD', price: 45000, parts: 1.8 },
  { id: 'supremo', name: 'Toyoda Supremo MK4',  years: [1993, 1998], hp: 320, weight: 1500, drive: 'RWD', price: 60000, parts: 2.0 },
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

// Touge races, all on the road in front of the cabin (see js/road.js).
// dir: 'up' = cabin -> summit, 'down' = summit -> cabin. rivals: 1-2 AI cars.
// aiPace scales rival top speed, acceleration and cornering; 1.0 is roughly a well-driven stock 240S.
export const EVENTS = [
  { id: 'kid-up',   name: 'Local Kid',          dir: 'up',   rivals: ['Kenta'],          aiPace: 0.56, entry: 50,   purse: [650, 0],
    desc: 'The kid from down the road thinks his wagon can make it to the summit first.' },
  { id: 'iketani-down', name: 'Downhill Dare',  dir: 'down', rivals: ['Iketani'],        aiPace: 0.74, entry: 200,  purse: [1800, 0],
    desc: 'Summit to your driveway. Downhill means brakes and nerve.' },
  { id: 'ryo-up',   name: 'Night Hillclimb',    dir: 'up',   rivals: ['Ryo', 'Shingo'],  aiPace: 0.95, entry: 800,  purse: [6000, 1500],
    desc: 'Two of the valley\'s best, full throttle up all five hairpins.' },
  { id: 'king-down',name: 'Kansei Downhill King',dir: 'down', rivals: ['The Ghost'],     aiPace: 1.2, entry: 3000, purse: [30000, 0],
    desc: 'Nobody has seen his face. Beat him down the mountain and the road is yours.' },
];
