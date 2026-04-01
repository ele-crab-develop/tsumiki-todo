// Physics world — wider to accommodate left/right staging areas
export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 760;

// Block dimensions
export const BLOCK_WIDTH = 180;
export const PX_PER_HOUR = 40;
export const MIN_BLOCK_HEIGHT = 24;

// 16-hour daily limit
export const MAX_HOURS = 16;

// Ground
export const GROUND_Y = WORLD_HEIGHT - 30;
export const GROUND_THICKNESS = 60;

// Stacking area (center zone)
export const STACKING_LEFT = 200;
export const STACKING_RIGHT = 600;

// Limit line
export const LIMIT_LINE_Y = GROUND_Y - MAX_HOURS * PX_PER_HOUR;

// Staging zones (left and right of stacking area)
export const STAGING_LEFT_CENTER = 100;
export const STAGING_RIGHT_CENTER = 700;

// Wall thickness
export const WALL_THICKNESS = 20;

// Staging shelf (divides staging area from stacking area)
export const STAGING_SHELF_Y = 120;
export const STAGING_SPAWN_Y = 60;

export function hoursToHeight(hours: number): number {
  return Math.max(hours * PX_PER_HOUR, MIN_BLOCK_HEIGHT);
}

/** Compute x position for new blocks in staging zones */
export function stagingX(index: number): number {
  // Alternate left and right
  return index % 2 === 0 ? STAGING_LEFT_CENTER : STAGING_RIGHT_CENTER;
}
