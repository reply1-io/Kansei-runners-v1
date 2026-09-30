// Game state, car generation, performance math, economy and save/load.
import {
  START_MONEY, MODELS, COMPONENTS, UPGRADES, SELLERS, SELLER_NOTES, COLORS,
  PROBLEM_THRESHOLD, DEAD_THRESHOLD,
} from './data.js';

const SAVE_KEY = 'kansei-runners-save-v1';

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const uid = () => Math.random().toString(36).slice(2, 10);
export const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

export const modelOf = (car) => MODELS.find((m) => m.id === car.modelId);
export const carName = (car) => `${car.year} ${modelOf(car).name}`;

export function newState() {
  return {
    money: START_MONEY,
    day: 1,
    cars: [],
    activeCarId: null,
    listings: [],
    log: [],
    stats: { races: 0, wins: 0, earned: 0, spent: 0 },
  };
}

export let state = newState();

export function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { state = Object.assign(newState(), JSON.parse(raw)); return true; }
  } catch (e) { /* ignore corrupt save */ }
  state = newState();
  return false;
}

export function resetGame() {
  state = newState();
  refreshListings();
  save();
}

export function addLog(msg) {
  state.log.unshift({ day: state.day, msg });
  state.log = state.log.slice(0, 40);
}

// ---------- Cars ----------

function problemFor(compId) {
  return pick(COMPONENTS.find((c) => c.id === compId).problems);
}

export function generateCar(model) {
  const cond = {};
  const problems = {};
  // Each component: mostly worn, with a decent chance of a major problem.
  for (const c of COMPONENTS) {
    const bad = Math.random() < 0.3;
    cond[c.id] = bad ? randInt(5, PROBLEM_THRESHOLD - 1) : randInt(45, 95);
    if (cond[c.id] < PROBLEM_THRESHOLD) problems[c.id] = problemFor(c.id);
  }
  const upgrades = {};
  for (const u of UPGRADES) upgrades[u.id] = 0;
  // Occasionally a previous owner left some mods on it.
  if (Math.random() < 0.25) upgrades.intake = 1;
  if (Math.random() < 0.12) upgrades.tires = 1;
  if (Math.random() < 0.08) upgrades.coilovers = 1;
  return {
    id: uid(),
    modelId: model.id,
    year: randInt(model.years[0], model.years[1]),
    color: pick(COLORS),
    miles: randInt(90, 260) * 1000,
    cond, problems, upgrades,
  };
}

export function avgCondition(car) {
  let s = 0;
  for (const c of COMPONENTS) s += car.cond[c.id] * c.weightInValue;
  return s;
}

function upgradeValue(car) {
  let v = 0;
  for (const u of UPGRADES) for (let i = 0; i < car.upgrades[u.id]; i++) v += u.cost[i];
  return v;
}

// Market value: condition matters a lot, major problems crater the price.
export function carValue(car) {
  const m = modelOf(car);
  const condFactor = 0.25 + 0.85 * Math.pow(avgCondition(car) / 100, 1.3);
  const nProblems = Object.keys(car.problems).length;
  const problemFactor = Math.pow(0.82, nProblems);
  const mileFactor = clamp(1.15 - car.miles / 400000, 0.6, 1.1);
  return m.price * condFactor * problemFactor * mileFactor + upgradeValue(car) * 0.45;
}

export function repairCost(car, compId) {
  const comp = COMPONENTS.find((c) => c.id === compId);
  const missing = (100 - car.cond[compId]) / 100;
  // Fixed cost for parts plus scaled labor/consumables.
  return Math.round((comp.repair * modelOf(car).parts) * (0.35 + 0.65 * missing) / 10) * 10;
}

export function upgradeCost(car, upId) {
  const u = UPGRADES.find((x) => x.id === upId);
  const lvl = car.upgrades[upId];
  if (lvl >= u.max) return null;
  return Math.round(u.cost[lvl] * (0.6 + 0.4 * modelOf(car).parts) / 10) * 10;
}

export function canRun(car) {
  if (car.cond.engine < DEAD_THRESHOLD) return 'Engine is dead — it won\'t start.';
  if (car.cond.trans < DEAD_THRESHOLD) return 'Transmission is shot — it won\'t move.';
  return null;
}

// Derived performance numbers used by the race sim and shown in the garage.
export function performance(car) {
  const m = modelOf(car);
  const u = car.upgrades;
  const c = car.cond;
  const engineHealth = c.engine < DEAD_THRESHOLD ? 0 : 0.55 + 0.45 * (c.engine / 100);
  const hp = m.hp * (1 + 0.08 * u.intake + 0.10 * u.ecu + 0.25 * u.turbo) * engineHealth;
  const weight = m.weight * (1 - 0.05 * u.weight) * (c.body < PROBLEM_THRESHOLD ? 1.03 : 1);
  const transFactor = 0.6 + 0.4 * (c.trans / 100);
  const driveGrip = { AWD: 1.08, FWD: 1.0, RWD: 0.97 }[m.drive];
  const grip = driveGrip
    * (0.72 + 0.28 * c.tires / 100) * (1 + 0.08 * u.tires)
    * (0.85 + 0.15 * c.susp / 100) * (1 + 0.05 * u.coilovers);
  const brake = (0.55 + 0.45 * c.brakes / 100) * (1 + 0.2 * u.bbk);
  const pw = hp / weight;
  const launch = m.drive === 'AWD' ? 1.1 : m.drive === 'FWD' ? 0.95 : 1;
  const stats = {
    hp: Math.round(hp),
    weight: Math.round(weight),
    drive: m.drive,
    topSpeed: 350 + 2400 * pw,              // px/s
    accel: 1800 * pw * transFactor * launch, // px/s^2
    grip,
    brake,
    turn: 2.5 * (1 + 0.06 * u.coilovers) * (0.9 + 0.1 * c.susp / 100),
  };
  // Performance index for comparing cars at a glance.
  stats.pi = Math.round(pw * 1000 * 0.9 + grip * 40 + brake * 10);
  stats.cls = stats.pi < 130 ? 'D' : stats.pi < 160 ? 'C' : stats.pi < 200 ? 'B' : stats.pi < 250 ? 'A' : 'S';
  return stats;
}

// Apply wear from a race; returns list of human-readable changes.
export function applyWear(car, wear) {
  const report = [];
  for (const c of COMPONENTS) {
    const amt = Math.round(wear[c.id] || 0);
    if (amt <= 0) continue;
    const before = car.cond[c.id];
    car.cond[c.id] = clamp(before - amt, 0, 100);
    report.push({ comp: c.name, amt });
    if (car.cond[c.id] < PROBLEM_THRESHOLD && !car.problems[c.id]) {
      car.problems[c.id] = problemFor(c.id);
      report.push({ comp: c.name, problem: car.problems[c.id] });
    }
  }
  car.miles += randInt(8, 25);
  return report;
}

export function repair(car, compId) {
  car.cond[compId] = 100;
  delete car.problems[compId];
}

// ---------- Marketplace ----------

export function refreshListings() {
  const listings = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    // Bias toward cheap cars so there is always something in a starter budget.
    const pool = i < 4 ? MODELS.filter((m) => m.price <= 14000) : MODELS;
    const model = pick(pool);
    const car = generateCar(model);
    // Sellers hide some of the mechanical problems unless you pay for an inspection.
    const hidden = ['engine', 'trans', 'susp', 'brakes'].filter(() => Math.random() < 0.45);
    const price = Math.round(carValue(car) * rand(0.8, 1.15) / 50) * 50;
    listings.push({
      id: uid(), car, price: Math.max(price, 600), hidden,
      seller: pick(SELLERS), notes: pick(SELLER_NOTES), inspected: false,
    });
  }
  listings.sort((a, b) => a.price - b.price);
  state.listings = listings;
}

export function activeCar() {
  return state.cars.find((c) => c.id === state.activeCarId) || null;
}

export function spend(n) { state.money -= n; state.stats.spent += n; }
export function earn(n) { state.money += n; state.stats.earned += n; }

export function nextDay() {
  state.day += 1;
  refreshListings();
}
