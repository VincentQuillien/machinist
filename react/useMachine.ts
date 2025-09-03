import { createMachine } from "@machinist/core";
import type { Machine, State } from "@machinist/core";
import { useState } from "react";
import type { InferUnion } from "../core/types.ts";

/**
 * Takes a machine implementation and an initial state, and returns a reactive instance.\
 * Transitions will trigger re-renders in the consuming component.
 */
export const useMachine = <T>(
  machine: Machine<T>,
  initialState: State<InferUnion<T>>,
): T => {
  const [instance, setInstance] = useState<T>(() => {
    const reactiveMachine = createMachine({
      ...machine,
      onTransition: (prevState, newState) => {
        setInstance(reactiveMachine.new(newState) as T);
        machine.onTransition?.(prevState, newState);
      },
    });
    return reactiveMachine.new(initialState) as T;
  });

  return instance;
};
