// Phone UI: home screen + apps (Marketplace, Parts, Garage, Touge, Bank, Messages), and the flow
// between the cabin map, the phone, and driving.
import { COMPONENTS, UPGRADES, RACES, DIFFICULTIES, INSPECTION_COST, PROBLEM_THRESHOLD, PAINT_COST, PAINT_COLORS, WHEEL_COLORS, HOTLAP_RECORD_BONUS } from './data.js';
import {
  state, load, save, resetGame, refreshListings, addLog, carName, modelOf, carValue,
  repairCost, upgradeCost, repair, performance, factorySpecs, canRun, applyWear, activeCar,
  spend, earn, nextDay, money, clamp, uid,
} from './state.js';
import { startDrive, fmtTime } from './drive.js';
import { PARKING, parkingAssignments } from './map.js';
import { createHomeView } from './homeview.js';
import { mountTurntable, unmountTurntable } from './turntable.js';
import { U, COURSES } from './road.js';
import { unlockAudio } from './audio.js';
import { carPhoto } from './photo.js';

const screen = document.getElementById('screen');
const modalEl = document.getElementById('modal');
const toastEl = document.getElementById('toast');
const ui = { app: 'home', tab: 'buy' };
const phoneWrap = document.getElementById('phone-wrap');
const worldEl = document.getElementById('world');
const spotsFull = () => state.cars.length >= PARKING.length;

// ---------- helpers ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function condColor(v) {
  return v < PROBLEM_THRESHOLD ? 'var(--bad)' : v < 65 ? 'var(--warn)' : 'var(--good)';
}

function bars(car, hidden = []) {
  return `<div class="bars">${COMPONENTS.map((c) => {
    const v = car.cond[c.id];
    if (hidden.includes(c.id)) {
      return `<span>${c.name}</span><div class="bar unknown"><i></i></div><span class="muted">??</span>`;
    }
    return `<span>${c.name}</span><div class="bar"><i style="width:${v}%;background:${condColor(v)}"></i></div><span>${Math.round(v)}%</span>`;
  }).join('')}</div>`;
}

function problemList(car, hidden = []) {
  const items = COMPONENTS.map((c) => {
    if (hidden.includes(c.id)) return '';
    return car.problems[c.id] ? `<li>⚠️ ${esc(car.problems[c.id])}</li>` : '';
  }).join('');
  const unknown = hidden.length ? `<li class="hidden-issue">❓ ${hidden.length} system${hidden.length > 1 ? 's' : ''} not disclosed by seller</li>` : '';
  return items || unknown ? `<ul class="problems">${items}${unknown}</ul>` : `<ul class="problems"><li style="color:var(--good)">✓ No known major problems</li></ul>`;
}

function specLine(sp, label) {
  return `<div class="specs"><span><b>${sp.hp}</b> hp</span><span><b>${sp.handling}</b> handling</span><span><b>${sp.weight}</b> kg</span><span class="muted">${label}</span></div>`;
}

// Parts in your trunk waiting to be installed on a car.
const pendingFor = (car) => state.inventory.filter((p) => p.carId === car.id);
const hasPending = (car, kind, target) => state.inventory.some((p) => p.carId === car.id && p.kind === kind && p.target === target);
function partLabel(item) {
  if (item.kind === 'repair') return COMPONENTS.find((c) => c.id === item.target).part;
  const u = UPGRADES.find((x) => x.id === item.target);
  return `${u.name} (level ${item.level})`;
}

function clsBadge(perf) {
  return `<span class="cls cls-${perf.cls}">${perf.cls} ${perf.pi}</span>`;
}

function statGrid(perf) {
  return `<div class="stats">
    <div class="stat"><b>${perf.hp}</b><small>HP</small></div>
    <div class="stat"><b>${perf.weight}</b><small>KG</small></div>
    <div class="stat"><b>${perf.drive}</b><small>Drive</small></div>
    <div class="stat"><b>${Math.round(perf.topSpeed * 0.17)}</b><small>Top MPH</small></div>
    <div class="stat"><b>${perf.grip.toFixed(2)}</b><small>Grip</small></div>
    <div class="stat"><b>${perf.brake.toFixed(2)}</b><small>Brakes</small></div>
  </div>`;
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (toastEl.hidden = true), 2200);
}

function modal(html, buttons = [{ label: 'OK', value: true, cls: 'primary' }]) {
  return new Promise((resolve) => {
    modalEl.innerHTML = `<div class="modal-card">${html}<div class="btns">${buttons
      .map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${b.label}</button>`).join('')}</div></div>`;
    modalEl.hidden = false;
    modalEl.onclick = (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      modalEl.hidden = true;
      resolve(buttons[+b.dataset.i].value);
    };
  });
}

const confirmBox = (html, yes = 'Confirm') => modal(html, [{ label: 'Cancel', value: false }, { label: yes, value: true, cls: 'primary' }]);

// ---------- screens ----------

function header(title, extra = '') {
  return `<div class="app-head"><button class="back" data-action="home">‹ Home</button><h1>${title}</h1>${extra}</div>`;
}

function renderHome() {
  const car = activeCar();
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/i, '');
  let carCard;
  if (car) {
    const perf = performance(car);
    const issues = Object.keys(car.problems).length;
    carCard = `<div class="card" data-action="open" data-arg="garage">
      <div class="row"><div class="car-swatch" style="background:${car.color}"></div>
        <div style="flex:1"><div class="small muted">DAILY / RACE CAR</div><b>${esc(carName(car))}</b></div>${clsBadge(perf)}</div>
      <div class="small" style="margin-top:8px;color:${issues ? 'var(--bad)' : 'var(--good)'}">${issues ? `⚠️ ${issues} major problem${issues > 1 ? 's' : ''}` : '✓ Ready to run'}</div>
    </div>`;
  } else {
    carCard = `<div class="hint">You've got <b>${money(state.money)}</b>, a cabin in the woods, and no car. Open <b>Marketplace</b> and find something in your budget. Cheap usually means broken — that's the point.</div>`;
  }
  const apps = [
    ['market', '🚗', 'Marketplace'], ['parts', '🔧', 'Parts Shop'], ['garage', '🏠', 'Garage'], ['races', '🏔️', 'Touge'],
    ['bank', '💵', 'Bank'], ['msgs', '💬', 'Messages'],
  ];
  return `<div class="home">
    <div class="clock">${time}</div>
    <div class="date">Day ${state.day}</div>
    ${carCard}
    <div class="apps">${apps.map(([id, ico, label]) =>
      `<button class="app-icon" data-action="open" data-arg="${id}"><span class="ico ${id}">${ico}${id === 'garage' && state.inventory.length ? `<span class="dot">${state.inventory.length}</span>` : ''}</span>${label}</button>`).join('')}
    </div>
    <div style="margin-top:28px"><button class="btn block" data-action="sleep">😴 Sleep until tomorrow</button></div>
  </div>`;
}

function renderMarket() {
  const tabs = `<div class="tabs"><button class="${ui.tab === 'buy' ? 'on' : ''}" data-action="tab" data-arg="buy">Buy</button>
    <button class="${ui.tab === 'sell' ? 'on' : ''}" data-action="tab" data-arg="sell">Sell</button></div>`;
  let body = '';
  if (ui.tab === 'buy') {
    body = state.listings.map((l) => {
      const perf = performance(l.car);
      const hidden = l.inspected ? [] : l.hidden;
      return `<div class="card">
        <img class="listing-photo" data-photo="${l.id}" alt="Photo of the ${esc(carName(l.car))} in the seller's driveway">
        <div class="row between"><h2>${esc(carName(l.car))}</h2>${clsBadge(perf)}</div>
        <div class="row between"><span class="price ${l.price > state.money ? 'cant' : ''}">${money(l.price)}</span>
          <span class="small muted">${Math.round(l.car.miles / 1000)}k mi · ${modelOf(l.car).drive}</span></div>
        ${specLine(factorySpecs(modelOf(l.car)), 'Factory specs')}
        <div class="small muted">Seller: ${esc(l.seller)}</div>
        <div class="notes">"${esc(l.notes)}"</div>
        ${bars(l.car, hidden)}
        ${problemList(l.car, hidden)}
        <div class="btns">
          ${l.inspected ? '<button class="btn" disabled>✓ Inspected</button>'
            : `<button class="btn" data-action="inspect" data-arg="${l.id}">🔍 Inspect ${money(INSPECTION_COST)}</button>`}
          <button class="btn primary" data-action="buy" data-arg="${l.id}" ${l.price > state.money || spotsFull() ? 'disabled' : ''}>${spotsFull() ? 'No room' : 'Buy'}</button>
        </div>
      </div>`;
    }).join('') || '<div class="empty"><div class="big">🕸️</div>Nothing listed today. Sleep and check tomorrow.</div>';
    const room = `Parking at the cabin: <b>${state.cars.length}/${PARKING.length}</b>${spotsFull() ? ' — full. Sell a car to make room.' : ''}`;
    body = `<div class="hint">New listings every day. Sellers don't always mention the bad stuff — an inspection reveals everything.<br>${room}</div>` + body;
  } else {
    body = state.cars.map((car) => {
      const offer = Math.round(carValue(car) * 0.85 / 50) * 50;
      return `<div class="card"><div class="row"><div class="car-swatch" style="background:${car.color}"></div>
        <div style="flex:1"><b>${esc(carName(car))}</b><div class="small muted">Private-party offer</div></div>
        <span class="price">${money(offer)}</span></div>
        ${problemList(car)}
        <div class="btns"><button class="btn danger" data-action="sell" data-arg="${car.id}">Sell for ${money(offer)}</button></div></div>`;
    }).join('') || '<div class="empty"><div class="big">🚫</div>You don\'t own any cars yet.</div>';
  }
  return `<div class="app">${header('Marketplace')}${tabs}${body}</div>`;
}

function renderParts() {
  const car = activeCar();
  if (!car) return `<div class="app">${header('Parts Shop')}<div class="empty"><div class="big">🔧</div>Buy a car first — parts need something to go on.</div></div>`;
  const picker = state.cars.length > 1
    ? `<div class="tabs">${state.cars.map((c) => `<button class="${c.id === car.id ? 'on' : ''}" data-action="pickcar" data-arg="${c.id}">${esc(modelOf(c).name.split(' ').slice(1).join(' '))}</button>`).join('')}</div>`
    : '';
  const repairs = COMPONENTS.map((c) => {
    const v = car.cond[c.id];
    const cost = repairCost(car, c.id);
    const pending = hasPending(car, 'repair', c.id);
    const label = pending ? 'In trunk' : v >= 100 ? 'New' : money(cost);
    return `<div class="list-item">
      <div class="grow"><div class="title">${c.name} <span style="color:${condColor(v)}">${Math.round(v)}%</span></div>
        <div class="sub">${c.part}</div>
        <div class="sub">${car.problems[c.id] ? `<span style="color:var(--bad)">⚠️ ${esc(car.problems[c.id])}</span>` : v >= 100 ? 'Brand new' : 'Worn but working'}</div>
      </div>
      <button class="btn ${car.problems[c.id] && !pending ? 'primary' : ''}" data-action="buypart" data-arg="${c.id}" ${pending || v >= 100 || cost > state.money ? 'disabled' : ''}>${label}</button>
    </div>`;
  }).join('');
  const ups = UPGRADES.map((u) => {
    const lvl = car.upgrades[u.id];
    const cost = upgradeCost(car, u.id);
    const pending = hasPending(car, 'mod', u.id);
    const label = pending ? 'In trunk' : cost === null ? 'MAX' : money(cost);
    return `<div class="list-item">
      <div class="grow"><div class="title">${u.name}</div><div class="sub">${u.desc}</div>
        <span class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span></div>
      <button class="btn" data-action="buymod" data-arg="${u.id}" ${pending || cost === null || cost > state.money ? 'disabled' : ''}>${label}</button>
    </div>`;
  }).join('');
  const n = pendingFor(car).length;
  return `<div class="app">${header('Parts Shop')}${picker}
    <div class="card"><div class="row"><div class="car-swatch" style="background:${car.color}"></div><b style="flex:1">${esc(carName(car))}</b>${clsBadge(performance(car))}</div>
      ${n ? `<div class="btns"><button class="btn primary" data-action="open" data-arg="garage">🏠 ${n} part${n > 1 ? 's' : ''} waiting — install in Garage</button></div>` : ''}</div>
    <div class="hint">Parts you buy go in your trunk. Install them from the <b>Garage</b>.</div>
    <div class="card"><h3 style="margin-top:0">Repair parts</h3><div class="small muted">A new part puts that system back to 100% and fixes its problem.</div>${repairs}</div>
    <div class="card"><h3 style="margin-top:0">Performance mods</h3>${ups}</div>
  </div>`;
}

function installList(car) {
  const items = pendingFor(car);
  if (!items.length) return '';
  return `<div class="install">
    <div class="row between"><b>📦 Ready to install</b>${items.length > 1 ? `<button class="btn small-btn primary" data-action="installall" data-arg="${car.id}">Install all</button>` : ''}</div>
    ${items.map((it) => `<div class="list-item"><div class="grow"><div class="title">${esc(partLabel(it))}</div></div>
      <button class="btn primary" data-action="install" data-arg="${it.id}">Install</button></div>`).join('')}
  </div>`;
}

// Paint shop inside each garage card: body colour and wheel finish, PAINT_COST each.
function paintPanel(car) {
  const body = [...new Set([...(modelOf(car).colors || []), ...PAINT_COLORS])];
  const sw = (kind, c, label, on) => `<button class="swatch ${kind === 'wheels' ? 'wheel' : ''} ${on ? 'on' : ''}" style="background:${c}" data-action="paint" data-arg="${car.id}|${kind}|${c}" aria-label="${label}" title="${label}"></button>`;
  return `<details class="paint" ${ui.paintOpen === car.id ? 'open' : ''}><summary>🎨 Paint shop · ${money(PAINT_COST)} per change</summary>
    <div class="small muted">Body</div><div class="swatches">${body.map((c) => sw('body', c, `Body ${c}`, car.color === c)).join('')}</div>
    <div class="small muted">Wheels</div><div class="swatches">${WHEEL_COLORS.map(([n, c]) => sw('wheels', c, `${n} wheels`, (car.wheelColor || '#d8dbe0') === c)).join('')}</div></details>`;
}

function renderGarage() {
  if (!state.cars.length) return `<div class="app">${header('Garage')}<div class="empty"><div class="big">🏠</div>Empty garage. Hit the Marketplace.</div></div>`;
  return `<div class="app">${header('Garage')}${state.cars.map((car) => {
    const perf = performance(car);
    const active = car.id === state.activeCarId;
    const dead = canRun(car);
    return `<div class="card">
      ${active ? '<canvas class="turntable" data-turntable aria-label="Your car on the garage turntable"></canvas>' : ''}
      <div class="row"><div class="car-swatch" style="background:${car.color}"></div>
        <div style="flex:1"><h2>${esc(carName(car))}</h2><div class="small muted">${Math.round(car.miles / 1000)}k mi · worth ~${money(carValue(car))}</div></div>
        ${clsBadge(perf)}</div>
      ${dead ? `<div class="small" style="color:var(--bad);margin-top:8px">🚫 ${dead}</div>` : ''}
      ${installList(car)}
      ${paintPanel(car)}
      ${statGrid(perf)}
      ${bars(car)}
      ${problemList(car)}
      <div class="btns">${active ? '<button class="btn" disabled>★ Selected</button>' : `<button class="btn primary" data-action="select" data-arg="${car.id}">Drive this one</button>`}
        <button class="btn" data-action="goparts" data-arg="${car.id}">🔧 Shop parts</button></div>
    </div>`;
  }).join('')}</div>`;
}

function renderRaces() {
  const car = activeCar();
  const perf = car && performance(car);
  const cards = RACES.map((race) => {
    const c = COURSES[race.course];
    const diffs = Object.entries(DIFFICULTIES).map(([key, d]) => {
      const best = state.records[`${race.id}:${key}`];
      return `<button class="diff diff-${key}" data-action="race" data-arg="${race.id}:${key}" ${!car || d.entry > state.money ? 'disabled' : ''}>
        <b>${d.label}</b><span>${money(d.entry)} → ${money(d.purse[0])}</span><small>${best ? `🏁 ${fmtTime(best)}` : '&nbsp;'}</small></button>`;
    }).join('');
    // Hot lap: no rivals, free entry, paid by lap time (best tier you beat) plus a bonus for a new record.
    const hlBest = state.records[`${race.id}:hotlap`];
    const hotlap = `<button class="diff diff-hotlap" data-action="race" data-arg="${race.id}:hotlap" ${!car ? 'disabled' : ''}>
        <b>⏱ Hot Lap</b><span>Free · up to ${money(race.hotlap[race.hotlap.length - 1][1])}</span><small>${hlBest ? `🏁 ${fmtTime(hlBest)}` : '&nbsp;'}</small></button>`;
    const tiers = race.hotlap.map(([t, r]) => `${fmtTime(t - 1).replace(/\.\d$/, '')}.x → ${money(r)}`).join(' · ');
    return `<div class="card">
      <div class="row between"><h2>${race.name}</h2><span class="small muted">${(c.road.length / 1000).toFixed(1)} km · ${c.hairpins} hairpins</span></div>
      <div class="small muted">${race.style}</div>
      <div class="notes">${race.desc}</div>
      <div class="diffs">${diffs}${hotlap}</div>
      <div class="small muted" style="margin-top:6px">Hot lap pays: ${tiers} · +${money(HOTLAP_RECORD_BONUS)} for a new record</div>
    </div>`;
  }).join('');
  const carInfo = car
    ? `<div class="card"><div class="row"><div class="car-swatch" style="background:${car.color}"></div><b style="flex:1">${esc(carName(car))}</b>${clsBadge(perf)}</div>
        ${canRun(car) ? `<div class="small" style="color:var(--bad);margin-top:6px">🚫 ${canRun(car)}</div>` : ''}</div>`
    : '<div class="hint">You need a car to race.</div>';
  return `<div class="app">${header('Touge')}
    <div class="hint">Rivals always drive a car with <b>exactly your car's numbers</b>, so it's always fair. Harder levels drive cleaner racing lines and commit harder. You start at the back: 2 rivals on Easy, 3 on Medium, 4 on Hard, 5 on Impossible. Get past and stay there. Or run a Hot Lap: no rivals, just the clock.</div>
    ${carInfo}${cards}</div>`;
}

function renderBank() {
  const s = state.stats;
  return `<div class="app">${header('Bank')}
    <div class="card" style="text-align:center"><div class="small muted">CHECKING</div><div class="price" style="font-size:40px">${money(state.money)}</div></div>
    <div class="card"><div class="stats">
      <div class="stat"><b>${s.races}</b><small>Races</small></div>
      <div class="stat"><b>${s.wins}</b><small>Wins</small></div>
      <div class="stat"><b>${state.cars.length}</b><small>Cars</small></div>
      <div class="stat"><b>${money(s.earned)}</b><small>Earned</small></div>
      <div class="stat"><b>${money(s.spent)}</b><small>Spent</small></div>
      <div class="stat"><b>${state.day}</b><small>Day</small></div>
    </div></div>
    <div class="card"><h3 style="margin-top:0">Recent activity</h3>
      ${state.log.map((l) => `<div class="list-item"><div class="grow"><div class="sub">Day ${l.day}</div>${esc(l.msg)}</div></div>`).join('') || '<div class="muted small">Nothing yet.</div>'}
    </div>
    <button class="btn danger block" data-action="reset">Start over</button>
  </div>`;
}

function renderMsgs() {
  const car = activeCar();
  const msgs = [
    ['Kenji', `Yo. Heard you finally scraped together ${money(5000)}. Don't blow it on something shiny.`],
    ['Kenji', 'Cabin\'s all yours. One spot under the tent, two on the driveway. That\'s your whole garage.'],
    ['Kenji', 'Check Marketplace. Cheap cars are cheap for a reason — pay for an inspection if the seller is being shady.'],
    ['Kenji', 'Buy parts for anything marked ⚠️ in the Parts Shop, then install them in the Garage before you run it hard. A bad engine WILL let go.'],
    ['Kenji', 'Tap Select next to a car to get in and take it up the mountain. Learn the hairpins before you race anyone.'],
    ['Kenji', 'Two roads to race: Kansei Pass (all corners) and the Switchback Ladder (straights and hairpins). Everyone runs the same numbers as you, so start on Easy and learn the lines.'],
  ];
  if (car && Object.keys(car.problems).length) msgs.push(['Kenji', `That ${modelOf(car).name}... you gonna fix it or just pray?`]);
  if (state.stats.wins >= 3) msgs.push(['Ryo', 'People are talking about you. Try Hard on the Pass. Prove it.']);
  if (state.stats.wins >= 6) msgs.push(['The Ghost', 'Impossible. Kansei Pass. Don\'t embarrass yourself.']);
  return `<div class="app">${header('Messages')}${msgs.map(([from, m]) => `<div class="msg-bubble"><small>${from}</small>${esc(m)}</div>`).join('')}</div>`;
}

const RENDER = { home: renderHome, market: renderMarket, parts: renderParts, garage: renderGarage, races: renderRaces, bank: renderBank, msgs: renderMsgs };

function render() {
  const scroll = screen.scrollTop;
  screen.innerHTML = RENDER[ui.app]();
  if (render.keepScroll) screen.scrollTop = scroll;
  render.keepScroll = false;
  document.querySelector('[data-sb-day]').textContent = `Day ${state.day}`;
  document.querySelector('[data-sb-money]').textContent = money(state.money);
  const tt = screen.querySelector('[data-turntable]');
  if (tt && !phoneWrap.hidden && activeCar()) mountTurntable(tt, activeCar()); else unmountTurntable();
  renderMapHud();
  // Marketplace listing photos render in the background, one at a time.
  for (const img of screen.querySelectorAll('img[data-photo]')) {
    const l = state.listings.find((x) => x.id === img.dataset.photo);
    if (l) carPhoto(l.car, l.id).then((url) => { if (img.isConnected) img.src = url; }).catch(() => img.remove());
  }
}

function renderMapHud() {
  document.querySelector('[data-map-day]').textContent = state.day;
  document.querySelector('[data-map-money]').textContent = money(state.money);
  document.querySelector('[data-phone-dot]').hidden = !state.inventory.length;
  document.getElementById('phone-btn').classList.toggle('pulse', !state.cars.length);
  document.querySelector('[data-map-hint]').textContent = !state.cars.length
    ? 'No car yet. Pull out your phone and check the Marketplace.'
    : state.inventory.length
      ? 'Parts are waiting in your trunk. Tap a car to install them.'
      : 'Tap Select to get in and drive · tap a car to work on it · tap the cabin to sleep';
}

// ---------- phone + map ----------

function openPhone(app) {
  if (app) ui.app = app;
  phoneWrap.hidden = false;
  screen.scrollTop = 0;
  render();
}

function closePhone() {
  phoneWrap.hidden = true;
  unmountTurntable();
  renderMapHud();
}

async function sleepAtCabin() {
  const ok = await confirmBox(`<h2>Call it a night?</h2><p>Sleep until Day ${state.day + 1}. New cars get listed on the Marketplace in the morning.</p>`, 'Sleep');
  if (!ok) return;
  nextDay();
  save();
  toast(`Day ${state.day}. Fresh listings on Marketplace.`);
  render();
}

function onMapTap(hit) {
  if (hit.type === 'cabin') return sleepAtCabin();
  if (hit.type === 'spot') return openPhone('market');
  if (hit.type === 'car') {
    state.activeCarId = hit.carId; // tapping a car pulls it into the tent as your ride
    save();
    openPhone('garage');
  }
}

const map = createHomeView({
  canvas: document.getElementById('view'),
  overlay: document.getElementById('world'),
  getCars: () => state.cars,
  getActiveId: () => state.activeCarId,
  onTap: onMapTap,
  onSelect: selectAndDrive,
  buttonsEl: document.getElementById('map-buttons'),
});
window.__kmap = map; // debug/testing hook

function go(app) {
  ui.app = app;
  if (app === 'market') ui.tab = ui.tab || 'buy';
  screen.scrollTop = 0;
  render();
}

// ---------- actions ----------

const ACTIONS = {
  home: () => go('home'),
  phone: () => openPhone(),
  closephone: () => closePhone(),
  open: (arg) => go(arg),
  tab: (arg) => { ui.tab = arg; render(); },
  sleep: () => {
    nextDay();
    save();
    toast(`Day ${state.day}. Fresh listings on Marketplace.`);
    render();
  },

  inspect: (id) => {
    const l = state.listings.find((x) => x.id === id);
    if (!l || state.money < INSPECTION_COST) return toast('Not enough cash.');
    spend(INSPECTION_COST);
    l.inspected = true;
    const found = l.hidden.filter((c) => l.car.problems[c]);
    toast(found.length ? `Inspector found ${found.length} hidden problem${found.length > 1 ? 's' : ''}!` : 'Inspection clean. Seller was honest.');
    save(); render.keepScroll = true; render();
  },

  buy: async (id) => {
    const l = state.listings.find((x) => x.id === id);
    if (!l) return;
    if (l.price > state.money) return toast('Not enough cash.');
    if (spotsFull()) return toast(`No room at the cabin (${PARKING.length} cars max). Sell one first.`);
    const warn = !l.inspected && l.hidden.length ? '<p class="small" style="color:var(--warn)">You haven\'t inspected it. Some systems are unknown.</p>' : '';
    const ok = await confirmBox(`<h2>Buy it?</h2><p>${esc(carName(l.car))} for <b>${money(l.price)}</b>.</p>${warn}`, 'Buy');
    if (!ok) return;
    spend(l.price);
    state.cars.push(l.car);
    state.listings = state.listings.filter((x) => x !== l);
    if (!state.activeCarId) state.activeCarId = l.car.id;
    addLog(`Bought ${carName(l.car)} for ${money(l.price)}`);
    save();
    const surprises = l.inspected ? [] : l.hidden.filter((c) => l.car.problems[c]).map((c) => l.car.problems[c]);
    if (surprises.length) {
      await modal(`<h2>😬 Uh oh</h2><p>Driving it home you discover:</p><ul class="problems">${surprises.map((s) => `<li>⚠️ ${esc(s)}</li>`).join('')}</ul><p class="small muted">Should've paid for the inspection.</p>`);
    } else {
      toast('Car purchased! Check Garage.');
    }
    go('garage');
  },

  sell: async (id) => {
    const car = state.cars.find((c) => c.id === id);
    if (!car) return;
    const offer = Math.round(carValue(car) * 0.85 / 50) * 50;
    if (!(await confirmBox(`<h2>Sell it?</h2><p>${esc(carName(car))} for <b>${money(offer)}</b>.</p>`, 'Sell'))) return;
    const leftover = pendingFor(car);
    const refund = Math.round(leftover.reduce((t, p) => t + p.price, 0) * 0.5);
    earn(offer + refund);
    state.stats.earned -= offer + refund; // selling isn't race earnings
    state.inventory = state.inventory.filter((p) => !leftover.includes(p));
    if (refund) toast(`Also sold ${leftover.length} uninstalled part${leftover.length > 1 ? 's' : ''} for ${money(refund)}`);
    state.cars = state.cars.filter((c) => c !== car);
    if (state.activeCarId === id) state.activeCarId = state.cars[0]?.id || null;
    addLog(`Sold ${carName(car)} for ${money(offer)}`);
    save(); if (!refund) toast('Sold!'); render();
  },

  select: (id) => { state.activeCarId = id; save(); toast('Selected.'); render.keepScroll = true; render(); },
  goparts: (id) => { state.activeCarId = id; save(); go('parts'); },

  pickcar: (id) => { state.activeCarId = id; save(); render.keepScroll = true; render(); },

  buypart: (compId) => {
    const car = activeCar();
    const cost = repairCost(car, compId);
    if (cost > state.money) return toast('Not enough cash.');
    spend(cost);
    state.inventory.push({ id: uid(), carId: car.id, kind: 'repair', target: compId, price: cost });
    const part = COMPONENTS.find((c) => c.id === compId).part;
    addLog(`Bought ${part} for ${carName(car)} (${money(cost)})`);
    toast(`${part} in your trunk — install in Garage`);
    save(); render.keepScroll = true; render();
  },

  buymod: (upId) => {
    const car = activeCar();
    const cost = upgradeCost(car, upId);
    if (cost === null || cost > state.money) return toast('Not enough cash.');
    spend(cost);
    const level = car.upgrades[upId] + 1;
    state.inventory.push({ id: uid(), carId: car.id, kind: 'mod', target: upId, level, price: cost });
    const u = UPGRADES.find((x) => x.id === upId);
    addLog(`Bought ${u.name} L${level} (${money(cost)})`);
    toast(`${u.name} in your trunk — install in Garage`);
    save(); render.keepScroll = true; render();
  },

  install: (itemId) => {
    const msg = installItem(itemId);
    if (msg) toast(msg);
    save(); render.keepScroll = true; render();
  },

  installall: (carId) => {
    const items = state.inventory.filter((p) => p.carId === carId);
    items.forEach((it) => installItem(it.id));
    toast(`Installed ${items.length} parts`);
    save(); render.keepScroll = true; render();
  },

  paint: (arg) => {
    const [carId, kind, color] = arg.split('|');
    const car = state.cars.find((c) => c.id === carId);
    if (!car) return;
    ui.paintOpen = carId;
    const cur = kind === 'body' ? car.color : (car.wheelColor || '#d8dbe0');
    if (cur === color) return toast('Already that colour.');
    if (state.money < PAINT_COST) return toast(`Paint costs ${money(PAINT_COST)}.`);
    spend(PAINT_COST);
    if (kind === 'body') car.color = color; else car.wheelColor = color;
    addLog(`Painted ${carName(car)}'s ${kind === 'body' ? 'body' : 'wheels'}`);
    toast(`${kind === 'body' ? 'Resprayed' : 'Wheels refinished'} · −${money(PAINT_COST)}`);
    save(); render.keepScroll = true; render();
  },

  race: async (arg) => {
    const [raceId, diffKey] = arg.split(':');
    const race = RACES.find((r) => r.id === raceId);
    if (diffKey === 'hotlap') return startHotLap(race);
    const diff = { ...DIFFICULTIES[diffKey], ...race.levels[diffKey] };
    const ev = { ...race, key: `${raceId}:${diffKey}`, diffLabel: diff.label, entry: diff.entry, purse: diff.purse, rivals: diff.rivals };
    const car = activeCar();
    if (!car) return;
    const dead = canRun(car);
    if (dead) return modal(`<h2>Not happening</h2><p>${dead}</p><p class="small muted">Buy parts in the Parts Shop, then install them in the Garage.</p>`);
    if (ev.entry > state.money) return toast('Can\'t cover the entry fee.');
    const nProb = Object.keys(car.problems).length;
    const risky = nProb ? `<p class="small" style="color:var(--warn)">⚠️ Your car has ${nProb} major problem${nProb > 1 ? 's' : ''}. Things might break.</p>` : '';
    const ok = await confirmBox(`<h2>${ev.name} · ${diff.label}</h2><p>${ev.style} vs ${ev.rivals.map(esc).join(', ')}, same car numbers as yours. You start behind them. Entry fee <b>${money(ev.entry)}</b>, win <b>${money(ev.purse[0])}</b>.</p>${risky}
      <p class="small muted">Controls: ◀ ▶ steer, GAS, BRAKE, HANDBRAKE. Keyboard: arrows/WASD, space = handbrake.</p>`, 'Race!');
    if (!ok) return;
    spend(ev.entry);
    runDrive('race', car, ev, diff);
  },

  reset: async () => {
    if (!(await confirmBox('<h2>Start over?</h2><p>This wipes your save.</p>', 'Wipe it'))) return;
    resetGame();
    go('home');
  },
};

phoneWrap.addEventListener('click', (e) => { if (e.target === phoneWrap) closePhone(); });
// Browsers only allow sound after a tap.
document.addEventListener('pointerdown', unlockAudio, { passive: true });

// Full screen (Android / desktop browsers; iPhone Safari has no full-screen API for pages, so the
// button hides there and "Add to Home Screen" is the way to play without the browser bars).
const fsEl = document.documentElement;
const canFullscreen = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen) && (document.fullscreenEnabled || document.webkitFullscreenEnabled);
if (!canFullscreen || window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) document.body.classList.add('no-fullscreen');
const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
let fsOptOut = false; // set when you leave full screen with the button, so we stop pulling you back in
function enterFullscreen() {
  if (!canFullscreen || fsOptOut || isFullscreen()) return;
  try {
    Promise.resolve((fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl, { navigationUI: 'hide' }))
      .then(() => screen.orientation?.lock?.('portrait')).catch(() => {});
  } catch (err) { /* not allowed here (e.g. inside a frame without permission) */ }
}
function toggleFullscreen() {
  if (isFullscreen()) {
    fsOptOut = true;
    try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (err) { /* ignore */ }
  } else { fsOptOut = false; enterFullscreen(); }
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-fullscreen]')) { e.stopPropagation(); toggleFullscreen(); return; }
  enterFullscreen(); // the game goes full screen on your first tap (where the browser allows it)
}, true);

document.body.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.closest('#modal')) return;
  const fn = ACTIONS[el.dataset.action];
  if (fn) fn(el.dataset.arg);
});

function installItem(itemId) {
  const it = state.inventory.find((p) => p.id === itemId);
  if (!it) return null;
  const car = state.cars.find((c) => c.id === it.carId);
  state.inventory = state.inventory.filter((p) => p !== it);
  if (!car) return null;
  if (it.kind === 'repair') {
    const fixed = car.problems[it.target];
    repair(car, it.target);
    const name = COMPONENTS.find((c) => c.id === it.target).name;
    addLog(`Installed ${COMPONENTS.find((c) => c.id === it.target).part} on ${carName(car)}`);
    return fixed ? `Fixed: ${fixed}` : `${name} is like new`;
  }
  car.upgrades[it.target] = Math.max(car.upgrades[it.target], it.level);
  const u = UPGRADES.find((x) => x.id === it.target);
  addLog(`Installed ${u.name} L${it.level} on ${carName(car)}`);
  return `${u.name} installed!`;
}

// ---------- driving (cruise + touge races) ----------

// Where each owned car is parked, in meters, for the 3D view.
function parkedInMeters() {
  return parkingAssignments(state.cars, state.activeCarId)
    .filter((x) => x.car)
    .map(({ spot, car }) => ({ car, x: spot.x * U, z: spot.y * U }));
}

// Hot lap: just you and the clock. Free to enter.
async function startHotLap(race) {
  const car = activeCar();
  if (!car) return;
  const dead = canRun(car);
  if (dead) return modal(`<h2>Not happening</h2><p>${dead}</p>`);
  const key = `${race.id}:hotlap`;
  const ev = { ...race, key, diffLabel: 'Hot Lap', entry: 0, purse: [], rivals: [], isHotLap: true, best: state.records[key] };
  const tiers = race.hotlap.map(([t, r]) => `<li>Under ${fmtTime(t)} → <b>${money(r)}</b></li>`).join('');
  const ok = await confirmBox(`<h2>${ev.name} · ⏱ Hot Lap</h2><p>No rivals: just you against the clock. Free to enter.</p>
    <ul class="tiers">${tiers}<li>New personal record → <b>+${money(HOTLAP_RECORD_BONUS)}</b></li></ul>
    <p class="small muted">${ev.best ? `Your record: ${fmtTime(ev.best)}` : 'No record yet.'} Apex markers still pay +$50.</p>`, 'Go!');
  if (!ok) return;
  runDrive('race', car, ev, { label: 'Hot Lap', rivals: [], line: 1, mistakeEvery: 1e9, commit: 1, brake: 1 });
}

function runDrive(mode, car, ev, difficulty) {
  enterFullscreen();
  const all = parkedInMeters();
  const mine = all.find((p) => p.car.id === car.id);
  phoneWrap.hidden = true;
  worldEl.hidden = true;
  map.stop();
  document.getElementById('race').hidden = false;
  try {
    startDrive({
      canvas: document.getElementById('view'),
      hud: document.getElementById('hud'),
      car, perf: performance(car), mode, event: ev, difficulty,
      // Rivals get your car's numbers as if it were healthy (a sick engine is still your problem).
      rivalBase: performance({ ...car, cond: { ...car.cond, engine: 100, trans: 100 } }),
      parked: all.filter((p) => p !== mine),
      spot: mine,
      onExit: (res) => (mode === 'race' ? finishRace(car, ev, res) : finishCruise(car, res)),
    });
  } catch (err) {
    console.error(err);
    backToCabin();
    modal('<h2>Can\'t start driving</h2><p>This browser couldn\'t start 3D graphics (WebGL). Try another browser.</p>');
  }
}

function backToCabin() {
  document.getElementById('race').hidden = true;
  worldEl.hidden = false;
  map.start();
  ui.app = 'home';
  closePhone();
}

function wearList(report) {
  return report.map((r) => r.problem
    ? `<li>⚠️ ${esc(r.comp)}: ${esc(r.problem)}</li>`
    : `<li style="color:var(--muted)">${esc(r.comp)} −${r.amt}%</li>`).join('');
}

async function selectAndDrive(carId) {
  const car = state.cars.find((c) => c.id === carId);
  if (!car) return;
  const dead = canRun(car);
  if (dead) {
    await modal(`<h2>It won't go</h2><p>${esc(carName(car))}: ${dead}</p><p class="small muted">Buy parts in the Parts Shop, then install them in the Garage.</p>`);
    return;
  }
  runDrive('cruise', car);
  state.activeCarId = car.id; // after parking it goes under the tent
  save();
}

async function finishCruise(car, res) {
  const report = applyWear(car, res.wear);
  addLog(`Took the ${modelOf(car).name} for a drive`);
  save();
  backToCabin();
  if (res.engineBlown) {
    await modal(`<h2>💥 Engine's done</h2><p>Your buddy towed it home. The engine needs replacing before it runs again.</p><ul class="problems">${wearList(report)}</ul>`);
  } else if (report.some((r) => r.problem)) {
    await modal(`<h2>Parked</h2><p>Something gave out on that drive:</p><ul class="problems">${wearList(report)}</ul>`);
  } else {
    toast('Parked under the tent.');
  }
}

async function finishRace(car, ev, res) {
  state.stats.races += 1;
  const report = applyWear(car, res.wear);
  let payout = 0;
  let title;
  let lapReward = 0, recordBonus = 0;
  if (res.dnf) {
    title = res.engineBlown ? '💥 DNF — Engine' : 'DNF';
  } else if (ev.isHotLap) {
    title = '⏱ Hot Lap';
    for (const [t, r] of ev.hotlap) if (res.time < t) lapReward = r;
    const prev = state.records[ev.key];
    if (prev && res.time < prev) recordBonus = HOTLAP_RECORD_BONUS;
    payout = lapReward + recordBonus;
  } else {
    payout = ev.purse[res.place - 1] || 0;
    title = ['', '🥇 1st', '🥈 2nd', '🥉 3rd'][res.place];
    if (res.place === 1) state.stats.wins += 1;
  }
  const prevBest = state.records[ev.key];
  const newBest = !res.dnf && (!prevBest || res.time < prevBest);
  if (newBest) state.records[ev.key] = res.time;
  if (payout) earn(payout);
  // Apex bonuses and contact fines from the race itself.
  const bonus = res.bonus || 0;
  if (bonus > 0) earn(bonus); else if (bonus < 0) spend(-bonus);
  addLog(`${ev.name} (${ev.diffLabel}): ${res.dnf ? 'DNF' : `P${res.place}`}${payout ? ` (+${money(payout)})` : ''}`);
  nextDay();
  save();

  await modal(`<div class="result-place">${title}</div>
    <p style="text-align:center" class="muted">${ev.name} · ${ev.diffLabel}${res.dnf ? '' : ` · ${fmtTime(res.time)}${newBest ? ' · 🏁 new best' : ''}`}</p>
    <div class="stats four"><div class="stat"><b>${money(-ev.entry)}</b><small>Entry</small></div>
      <div class="stat"><b style="color:var(--good)">${money(payout)}</b><small>${ev.isHotLap ? `Lap ${money(lapReward)}${recordBonus ? ` + record ${money(recordBonus)}` : ''}` : 'Prize'}</small></div>
      <div class="stat"><b style="color:${bonus < 0 ? 'var(--bad)' : 'var(--good)'}">${money(bonus)}</b><small>Apex ${res.apexHits || 0}/${res.apexTotal || 0} · Hits ${res.contacts || 0}</small></div>
      <div class="stat"><b>${money(payout + bonus - ev.entry)}</b><small>Net</small></div></div>
    <h3 class="small muted" style="margin:14px 0 4px">WEAR &amp; TEAR</h3>
    <ul class="problems">${wearList(report) || '<li style="color:var(--muted)">Barely a scratch.</li>'}</ul>`,
  [{ label: 'Back to the cabin', value: true, cls: 'primary' }]);
  backToCabin();
}

// ---------- boot ----------

if (!load()) {
  refreshListings();
  save();
}
render();
map.start();
setInterval(() => { if (ui.app === 'home' && modalEl.hidden && !phoneWrap.hidden) render(); }, 30000);
