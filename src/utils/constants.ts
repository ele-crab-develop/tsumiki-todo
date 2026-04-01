// Physics world dimensions
export const WORLD_WIDTH = 600;
export const WORLD_HEIGHT = 880;

// Block dimensions
export const BLOCK_WIDTH = 180;
export const PX_PER_HOUR = 40; // 1 hour = 40px height
export const MIN_BLOCK_HEIGHT = 24;

// 16-hour daily limit
export const MAX_HOURS = 16;

// Ground
export const GROUND_Y = WORLD_HEIGHT - 30;
export const GROUND_THICKNESS = 60;

// Limit line (16h worth of stacking from ground up)
export const LIMIT_LINE_Y = GROUND_Y - MAX_HOURS * PX_PER_HOUR;

// Staging area at top — shelf where new blocks appear
export const STAGING_SHELF_Y = LIMIT_LINE_Y - 10;
export const STAGING_SPAWN_Y = STAGING_SHELF_Y - 30; // blocks spawn above shelf

// Wall thickness
export const WALL_THICKNESS = 20;

export function hoursToHeight(hours: number): number {
  return Math.max(hours * PX_PER_HOUR, MIN_BLOCK_HEIGHT);
}

export function stagingX(index: number): number {
  // Position blocks in a row, wrapping if needed
  const cols = 3;
  const col = index % cols;
  const gap = (WORLD_WIDTH - 40) / cols;
  return 40 + gap / 2 + col * gap;
}
