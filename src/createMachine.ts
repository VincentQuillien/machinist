// deno-lint-ignore-file no-explicit-any ban-types

import type { Machine, MachineImpl } from "../src/types.ts";

export const createMachine = <T>(
  implementation: MachineImpl<T>,
): Machine<T> => {
  const _new = (state: any) => {
    const wrappedTransitions = Object.entries<Function>(
      implementation.transitions,
    ).reduce<
      Record<string, Function>
    >((acc, [name, transition]) => {
      acc[name] = (...args: any[]) => {
        const newState = transition(state, ...args);
        implementation.onTransition?.(state, newState);
        return _new(newState);
      };

      return acc;
    }, {});

    const wrappedMethods = "methods" in implementation
      ? Object.entries<Function>(implementation.methods)
        .reduce<
          Record<string, Function>
        >((acc, [name, method]) => {
          acc[name] = (...args: any[]) => method(state, ...args);
          return acc;
        }, {})
      : {};

    const _getState = () => state;

    return { ...wrappedTransitions, ...wrappedMethods, ...state, _getState };
  };

  return { ...implementation, new: _new } as Machine<T>;
};
