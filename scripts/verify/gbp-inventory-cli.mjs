import process from 'node:process';

export class InventoryInputError extends Error {}

export function parseArgs(argv) {
  const values = { root: process.cwd(), manifest: 'scripts/verify/gbp-inventory.manifest.json' };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if ((key !== '--root' && key !== '--manifest') || !value) {
      throw new InventoryInputError('usage: gbp-inventory.mjs [--root PATH] [--manifest PATH]');
    }
    values[key.slice(2)] = value;
  }
  return values;
}
