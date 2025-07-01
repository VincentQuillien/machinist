import { createMachine } from "@typed-machine/core";
import type { Machine, State } from "@typed-machine/core";
import { useState } from "react";

export const useMachine = <T>(
  machine: Machine<T>,
  initialState: State<T>,
): T => {
  const [instance, setInstance] = useState<T>(() => {
    const reactiveMachine = createMachine({
      ...machine,
      onTransition: (prevState, newState) => {
        setInstance(reactiveMachine.new(newState));
        machine.onTransition?.(prevState, newState);
      },
    });
    return reactiveMachine.new(initialState);
  });

  return instance;
};
