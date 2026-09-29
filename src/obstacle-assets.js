// Each obstacle is an independently generated transparent PNG, not a cell
// sliced from a shared sheet. Tight source bounds keep its scale consistent.
export const OBSTACLE_ASSETS = Object.freeze({
  iceFull: { file:'obstacles/ice-full-v1.png', width:1254, height:1254, crop:[107,123,1040,1010] },
  iceCracked: { file:'obstacles/ice-cracked-v1.png', width:1254, height:1254, crop:[107,123,1040,1010] },
  key: { file:'obstacles/key-v1.png', width:1254, height:1254, crop:[46,328,1164,587] },
  lock: { file:'obstacles/lock-v1.png', width:1254, height:1254, crop:[174,53,906,1141] },
  crate: { file:'obstacles/crate-v1.png', width:1254, height:1254, crop:[94,112,1073,1023] }
});
export const OBSTACLE_IMAGES = Object.freeze(Object.values(OBSTACLE_ASSETS).map(a=>a.file));
