const HACKER_PALETTE = {
  GREEN: "#00FF00",
  CYAN: "#00FFFF",
  BRIGHT_GREEN: "#39FF14",
  DARK_GREEN: "#003D00",
  BLACK: "#000000",
  RED: "#FF0000",
  PURPLE: "#9D00FF",
};

export const getRandomHackerColor = (): string => {
  const colors = Object.values(HACKER_PALETTE).filter(
    (c) => c !== HACKER_PALETTE.BLACK,
  );
  return colors[Math.floor(Math.random() * colors.length)];
};

export const getGlitchChar = (): string => {
  const chars = ["▓", "▒", "░", "█", "▀", "█", "►", "◄", "▲", "▼"];
  return chars[Math.floor(Math.random() * chars.length)];
};

export const hackerColors = HACKER_PALETTE;

