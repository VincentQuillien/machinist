import type { State } from "./types.ts";

/**
 * Returns the current state of a state machine instance.
 */

export const getState = <T>(instance: T): State<T> => {
  return (instance as T & { _getState: () => State<T> })._getState();
};
