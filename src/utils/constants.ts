// Physics world dimensions
export const WORLD_WIDTH = 600;
export const WORLD_HEIGHT = 800;

// Block dimensions
export const BLOCK_WIDTH = 180;
export const PX_PER_HOUR = 40; // 1 hour = 40px height
export const MIN_BLOCK_HEIGHT = 24;

// 16-hour daily limit
export const MAX_HOURS = 16;
export const LIMIT_LINE_Y = WORLD_HEIGHT - 30 - MAX_HOURS * PX_PER_HOUR; // from ground up

// Ground
export const GROUND_Y = WORLD_HEIGHT - 30;
export const GROUND_THICKNESS = 60;

// Wall thickness
export const WALL_THICKNESS = 20;

export function hoursToHeight(hours: number): number {
  return Math.max(hours * PX_PER_HOUR, MIN_BLOCK_HEIGHT);
}
