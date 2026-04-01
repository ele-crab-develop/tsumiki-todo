const BLOCK_COLORS = [
  '#FF6B6B', // coral red
  '#4ECDC4', // teal
  '#45B7D1', // sky blue
  '#96CEB4', // sage green
  '#FFEAA7', // soft yellow
  '#DDA0DD', // plum
  '#98D8C8', // mint
  '#F7DC6F', // gold yellow
  '#BB8FCE', // lavender
  '#F0B27A', // peach
  '#85C1E9', // light blue
  '#82E0AA', // light green
  '#F1948A', // salmon
  '#D7BDE2', // light purple
  '#A3E4D7', // aqua
];

export function randomColor(): string {
  return BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
}

export const GOLD_COLOR = '#FFD700';
export const GOLD_GRADIENT = 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)';
