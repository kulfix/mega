import type { ReadNight } from './types.js';

// Signature only, so § 2 compiles against it from the start. The reader is #2.
export const readNight: ReadNight = () => {
  throw new Error('readNight: not implemented yet (#2)');
};
