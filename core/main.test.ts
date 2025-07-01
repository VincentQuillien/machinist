import { assertEquals, assertObjectMatch } from "jsr:@std/assert";
import { assertType, type IsExact } from "jsr:@std/testing/types";
import { assertSpyCalls, spy } from "jsr:@std/testing/mock";
import { difference } from "jsr:@std/datetime/difference";

import { createMachine } from "./createMachine.ts";
import type { State } from "./types.ts";
import { getState } from "./getState.ts";

type BaseUser = {
  name: string;
  age: number;
};

type UserPending = BaseUser & {
  status: "pending";

  validate(email: string): UserValidated;
};

type UserValidated = BaseUser & {
  status: "validated";
  email: string;

  changeEmail(): UserPending;
  delete(reason: string): UserDeleted;
  lock(days: number): UserLocked;
};

type UserLocked = BaseUser & {
  status: "locked";
  days: number;
  lockStart: Date;
  email: string;

  unlock(): UserValidated;
  delete(reason: string): UserDeleted;
  getRemainingDays(): number;
};

type UserDeleted = BaseUser & {
  status: "deleted";
  deletionReason: string;
  deletionDate: Date;
  email: string;

  changeReason(reason: string): UserDeleted;
};

type User = UserPending | UserValidated | UserLocked | UserDeleted;

Deno.test("machine", async (t) => {
  const userMachine = createMachine<User>({
    transitions: {
      validate: (prev, email) => ({ ...prev, status: "validated", email }),
      changeEmail: ({ ...prev }) => ({ ...prev, status: "pending" }),
      changeReason: (prev, reason) => ({ ...prev, deletionReason: reason }),
      delete: (prev, reason) => ({
        ...prev,
        status: "deleted",
        deletionReason: reason,
        deletionDate: new Date(),
      }),
      lock: (prev, days) => ({
        ...prev,
        status: "locked",
        days,
        lockStart: new Date(),
      }),
      unlock: (prev) => ({ ...prev, status: "validated" }),
    },
    methods: {
      getRemainingDays: (state) => {
        const daysSinceLock = difference(state.lockStart, new Date()).days ?? 0;
        return Math.max(0, state.days - daysSinceLock);
      },
    },
  });

  await t.step("transitions", () => {
    const userPending = userMachine.new({
      name: "John",
      age: 32,
      status: "pending",
    });
    assertType<IsExact<typeof userPending, UserPending>>(true);
    assertEquals(getState(userPending), {
      age: 32,
      name: "John",
      status: "pending",
    });

    const userValidated = userPending.validate("john@domain.org");
    assertType<IsExact<typeof userValidated, UserValidated>>(true);
    assertEquals(getState(userValidated), {
      age: 32,
      email: "john@domain.org",
      name: "John",
      status: "validated",
    });

    const userPendingAgain = userValidated.changeEmail();
    assertType<IsExact<typeof userPendingAgain, UserPending>>(true);
    assertObjectMatch(
      getState(userPendingAgain),
      {
        age: 32,
        name: "John",
        status: "pending",
      } satisfies State<UserPending>,
    );

    const userLocked = userValidated.lock(7);
    assertType<IsExact<typeof userLocked, UserLocked>>(true);
    assertEquals(getState(userLocked), {
      ...getState(userValidated),
      status: "locked",
      lockStart: new Date(),
      days: 7,
    });

    const userDeleted = userLocked.delete("Competitor is better");
    assertType<IsExact<typeof userDeleted, UserDeleted>>(true);
    assertObjectMatch(
      getState(userDeleted),
      {
        status: "deleted",
        deletionDate: new Date(),
        deletionReason: "Competitor is better",
        name: "John",
        email: "john@domain.org",
        age: 32,
      } satisfies State<UserDeleted>,
    );

    const userNewDeletionReason = userDeleted.changeReason("Price is too high");
    assertType<IsExact<typeof userNewDeletionReason, UserDeleted>>(true);
    assertObjectMatch(
      getState(userNewDeletionReason),
      {
        ...getState(userDeleted),
        deletionReason: "Price is too high",
      } satisfies State<UserDeleted>,
    );
  });

  await t.step("async transitions", async () => {
    const asyncUserMachine = createMachine<
      | User
      | (BaseUser & {
        status: "pending strict validation";
        strictValidate: (email: string) => Promise<UserValidated>;
      })
    >({
      transitions: {
        ...userMachine.transitions,
        strictValidate: async (prev, email) => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return { ...prev, status: "validated", email };
        },
      },
      methods: userMachine.methods,
    });
    const userPending = asyncUserMachine.new({
      name: "John",
      age: 32,
      status: "pending strict validation",
    });

    const userValidated = await userPending.strictValidate("john@domain.org");
    assertType<IsExact<typeof userValidated, UserValidated>>(true);
    assertEquals(getState(userValidated), {
      age: 32,
      email: "john@domain.org",
      name: "John",
      status: "validated",
    });
  });

  await t.step("methods", () => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const userLocked = userMachine.new({
      status: "locked",
      days: 10,
      lockStart: threeDaysAgo,
      name: "John",
      age: 32,
      email: "john@domain.org",
    });

    assertEquals(userLocked.getRemainingDays(), 7);
  });

  await t.step("onTransition", () => {
    const onUserUnlocked = spy();
    const onUserDeleted = spy();

    createMachine<User>({
      ...userMachine,
      onTransition: (prev, next) => {
        if (prev.status === "locked" && next.status === "validated") {
          onUserUnlocked();
        }
        if (prev.status !== "deleted" && next.status === "deleted") {
          onUserDeleted();
        }
      },
    }).new({
      status: "locked",
      days: 10,
      lockStart: new Date(),
      name: "John",
      age: 32,
      email: "",
    }).unlock().delete("Reason");

    assertSpyCalls(onUserUnlocked, 1);
    assertSpyCalls(onUserDeleted, 1);
  });
});
