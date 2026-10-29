/** Schema migrations, keyed by the schemaVersion they migrate FROM. */

export const CURRENT_SCHEMA_VERSION = 1;

/** @type {Record<number, (state: object) => object>} */
export const migrations = {
  // 1: (s) => ({ ...s, schemaVersion: 2, ... }),
};

/**
 * Run every pending migration in order.
 * @param {object} state  parsed state with a numeric schemaVersion <= CURRENT_SCHEMA_VERSION
 * @returns {object}
 */
export function migrate(state) {
  let s = state;
  while (s.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const step = migrations[s.schemaVersion];
    if (!step) throw new Error(`No migration from schemaVersion ${s.schemaVersion}`);
    s = step(s);
  }
  return s;
}
