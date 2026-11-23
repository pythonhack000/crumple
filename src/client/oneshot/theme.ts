import type { Material } from '../../shared/ball-art';

/** One palette for the canvas and the React overlay: ballpoint pen on a notebook page. */
export const COLORS = {
  paper: 0xfbfaf6,
  rule: 0xd4e2f3,
  margin: 0xf3c6c0,
  ink: 0x22408f,
  inkSoft: 0x8a9cc8,
  coral: 0xf2553a,
  white: 0xffffff,
} as const;

export const FONT_HAND = 'Kalam, "Bradley Hand", cursive';

export const MATERIAL_COLORS: Record<Material, string> = {
  paper: '#fbfaf6',
  rubber: '#f2553a',
  tin: '#b9c1cd',
  glass: '#cfe6f6',
};

export const MATERIAL_LABELS: Record<Material, string> = {
  paper: 'Paper',
  rubber: 'Rubber',
  tin: 'Tin',
  glass: 'Glass',
};
