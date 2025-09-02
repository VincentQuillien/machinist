import { createMachine, getState } from "@machinist/core";
import { act, renderHook } from "@testing-library/react-hooks";
import { assertEquals } from "jsr:@std/assert";

import { useMachine } from "./useMachine.ts";

type Active = {
  status: "active";

  lock(reason: string): Locked;
  delete(reason: string): Deleted;
};

type Locked = {
  status: "locked";
  reason: string;

  unlock(): Active;
  delete(reason: string): Deleted;
};

type Deleted = {
  status: "deleted";
  reason: string;
};

type User = Active | Locked | Deleted;

Deno.test("useMachine", () => {
  const userMachine = createMachine<User>({
    transitions: {
      lock: (prev, reason) => ({
        ...prev,
        status: "locked",
        reason,
      }),
      delete: (prev, reason) => ({
        ...prev,
        status: "deleted",
        reason,
      }),
      unlock: (prev) => ({
        ...prev,
        status: "active",
      }),
    },
  });

  const { result } = renderHook(() =>
    useMachine(userMachine, { status: "active" })
  );
  const initialUser = result.current;
  act(() => {
    if (initialUser.status === "active") {
      initialUser.lock("some reason");
    }
  });
  assertEquals(
    getState(result.current),
    { reason: "some reason", status: "locked" },
  );
});
