// deno-lint-ignore-file no-explicit-any ban-types

import type { InferUnion, Machine, MachineImpl } from "../core/types.ts";

/**
 * Implements the transitions and methods of a state machine.\
 * Takes a state machine declaration as type parameter.
 */
export const createMachine = <T>(
  implementation: MachineImpl<InferUnion<T>>,
): Machine<T> => {
  const _new = (state: any) => {
    const wrappedTransitions = Object.entries<Function>(
      implementation.transitions,
    ).reduce<
      Record<string, Function>
    >((acc, [name, transition]) => {
      acc[name] = (...args: any[]) => {
        const newState = transition(state, ...args);
        const resolveInstance = (resolvedState: any) => {
          implementation.onTransition?.(state, resolvedState);
          return _new(resolvedState);
        };

        return newState instanceof Promise
          ? newState.then(resolveInstance)
          : resolveInstance(newState);
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
