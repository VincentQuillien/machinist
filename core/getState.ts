import type { State } from "./types.ts";

export const getState = <T>(instance: T): State<T> => {
  return (instance as T & { _getState: () => State<T> })._getState();
};
