export type XPLevel = {
  level: number;
  title: string;
  minXP: number;
  maxXP: number; // minXP of the next level, or Infinity for level 10
};

export const XP_LEVELS: XPLevel[] = [
  { level: 1,  title: 'Apprentice',  minXP: 0,      maxXP: 100   },
  { level: 2,  title: 'Reader',      minXP: 100,    maxXP: 300   },
  { level: 3,  title: 'Scholar',     minXP: 300,    maxXP: 600   },
  { level: 4,  title: 'Archivist',   minXP: 600,    maxXP: 1100  },
  { level: 5,  title: 'Scribe',      minXP: 1100,   maxXP: 2000  },
  { level: 6,  title: 'Librarian',   minXP: 2000,   maxXP: 3500  },
  { level: 7,  title: 'Curator',     minXP: 3500,   maxXP: 5500  },
  { level: 8,  title: 'Sage',        minXP: 5500,   maxXP: 8500  },
  { level: 9,  title: 'Lorekeeper',  minXP: 8500,   maxXP: 13000 },
  { level: 10, title: 'Grandmaster', minXP: 13000,  maxXP: Infinity },
];

export function getXPLevel(xp: number): XPLevel {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i].minXP) return XP_LEVELS[i];
  }
  return XP_LEVELS[0];
}
