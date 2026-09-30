// Home layout: a cabin in a clearing deep in the forest, a carport tent, a two-car driveway, and the
// mountain road out front. Positions are in map units (1 unit = U meters, see road.js); the 3D home view
// (homeview.js) and the 3D world (world3d.js) are both built from this.

// ---- Layout (world units). Tweak positions here. ----
export const HOME = {
  focus: { x: 170, y: 215, w: 520, h: 600 },         // what the camera always keeps in view
  clearing: { x: 455, y: 430, rx: 300, ry: 225 },
  cabin: { x: 440, y: 250, w: 200, h: 150 },
  porch: { x: 470, y: 400, w: 140, h: 44 },
  chimney: { x: 588, y: 268, s: 24 },
  tent: { x: 288, y: 292, w: 84, h: 110 },
  driveway: { x: 248, y: 406, w: 164, h: 96 },
  lane: { x: 294, w: 72, y0: 496, y1: 690 },           // gravel lane from driveway to the road
  firepit: { x: 548, y: 530, r: 18 },
  woodpile: { x: 652, y: 292, w: 26, h: 84 },
  // The road itself comes from js/road.js (the touge); the lane meets it at (330, 675).
};

// Where owned cars park (backed in, facing the road). Spot 0 is under the tent (your selected car).
// btn: where that car's Select button sits, relative to the car.
export const PARKING = [
  { x: 330, y: 350, label: 'Tent', btn: { dx: -78, dy: 0 } },
  { x: 290, y: 454, label: 'Driveway', btn: { dx: -62, dy: 0 } },
  { x: 370, y: 454, label: 'Driveway', btn: { dx: 70, dy: 0 } },
];
export const PARK_HEADING = Math.PI / 2; // facing the road

// Park the selected car under the tent and the rest on the driveway.
export function parkingAssignments(cars, activeId) {
  const ordered = [...cars].sort((a, b) => (b.id === activeId) - (a.id === activeId));
  return PARKING.map((spot, i) => ({ spot, index: i, car: ordered[i] || null }));
}
