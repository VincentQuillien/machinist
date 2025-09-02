<h1 style="text-align: center;">Machinist</h1>

### Type-driven finite state machines

Describe state machines with types, letting them drive implementation and usage.

### Installation

```bash
deno add jsr:@machinist/core
pnpm add jsr:@machinist/core
yarn add jsr:@machinist/core

# npm
npx jsr add @machinist/core

# bun
bunx jsr add @machinist/core
```

### Usage

First describe the machine with its states and transitions at the type level,
using a
[discriminated union](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions):

```ts
type BaseUser = {
  age: number;
  name: string;
};

type ActiveUser = BaseUser & {
  status: "active";

  lock(reason: string): LockedUser;
};

type LockedUser = BaseUser & {
  status: "locked";
  lockReason: string;

  unlock(): ActiveUser;
  ban(): BannedUser;
};

type BannedUser = BaseUser & {
  status: "banned";
  bannedAt: Date;
};

type User = ActiveUser | LockedUser | BannedUser;
```

Transitions are methods that return a new state of the machine. Here an `active`
user can only transition to a `locked` state, while a `banned` user is in a
final state meaning it can't transition to any other state.

Since we're working with a discriminated union we can narrow the type of a user
based on its `status`, and have the compiler only accept valid transitions for
this state:

```ts
if (user.status === "active") {
  // user has been narrowed, the compiler knows `lock` is available
  user.lock("reason");
}
// else we can't call `lock`
```

> [!IMPORTANT]
> The instances of the machines are **immutable**, transitions return new
> instances and leave the original one unchanged.
>
> ```ts
> const bannedUser = activeUser.lock("reason").ban();
> // activeUser !== bannedUser
> ```

### Implementation

To implement the transitions call the `createMachine` function with the machine
as type argument:

```ts
const userMachine = createMachine<User>({
  transitions: {
    lock: (user, reason) => ({ ...user, status: "locked", lockReason: reason }),
    unlock: (user) => ({ ...user, status: "active" }),
    ban: (user) => ({ ...user, status: "banned", bannedAt: new Date() }),
  },
});
```

Transitions take the current state as first parameter, followed by the
parameters declared in the types. They return the new state according to the
destination type of the transition.

Finally to spawn new instances of the machine call the `new` method with the
initial state:

```ts
const activeUser = userMachine.new({
  status: "active",
  name: "Alice",
  age: 25,
});

const lockedUser = userMachine.new({
  status: "locked",
  name: "Bob",
  age: 30,
  lockReason: "reason",
});
```

# 

Keeping the implementation separate allows the declaration to remain high-level
and readable, without drowning the signal in implementation details. It also
allows for multiple implementations of the same machine declaration.\
You can still jump between the declaration and the implementations with your
editor's symbols navigation (Go to Type Definition/Go to Implementation).

#### Methods

Methods that aren't transitions (that don't transition to a state of the
machine) are implemented under `methods`:

```ts
type BannedUser = BaseUser & {
  //...
  daysSinceBan: () => number;
};

const userMachine = createMachine<User>({
  transitions: {
    //...
  },
  methods: {
    daysSinceBan: (user) =>
      (Date.now() - user.bannedAt.getTime()) / (1000 * 60 * 60 * 24),
  },
});

userMachine.new({
  name: "Charlie",
  age: 35,
  status: "banned",
  bannedAt: new Date("2021-01-01"),
}).daysSinceBan(); // 123
```

That means `createMachine` is useful beyond just state machines, and can be used
as a general implementation target just like classes (the main difference being
`this` replaced by the first parameter of the method).

#### onTransition callback

With `onTransition` you can listen to every transition happening in the machine,
and run side-effects depending on the previous and new state:

```ts
createMachine<User>({
  transitions: {
    //...
  },
  onTransition: (from, to) => {
    console.log(`Transition from ${from.status} to ${to.status}`);
    if (from.status === "locked" && to.status === "active") {
      console.log(
        `User ${to.name} unlocked. Previous reason "${from.lockReason}" does not apply anymore.`,
      );
    }
  },
});
```

### React

`@machinist/react` exports everything that's in `core`, plus a `useMachine`
hook.\
It takes a machine implementation and an initial state, and returns a reactive
instance that will rerender the component on changes.

```tsx
import { useMachine } from "@machinist/react";
import { userMachine } from "./userMachine";

const Component = () => {
  const user = useMachine(userMachine, initialState);

  return (
    <>
      <div>Name: {user.name}</div>
      {user.status === "locked" && (
        <button onClick={user.unlock}>
          Unlock
        </button>
      )}
      {/* ... */}
    </>
  );
};
```

It is conceptually similar to `useReducer`, but with the additional benefits of
the compiler checking if the transition is valid for the current state.

To support additional frameworks PRs are welcome!

### Type helper

Declaring discriminated unions can be a bit verbose and unwieldy: every member
is its own type declaration that needs to be exported, that needs the same
discriminant key name as the others (e.g. `status`), to extend the common base
type (if any), and finally to be added to the final union.

The library provides a type helper `DeclareMachine` to simplify this process:

```ts
import { createMachine, type DeclareMachine } from "@machinist/core";

export type User = DeclareMachine<{
  base: {
    name: string;
    age: number;
  };
  discriminant: "status";
  states: {
    active: {
      lock(reason: string): User["locked"];
    };
    locked: {
      lockReason: string;

      unlock(): User["active"];
      ban(): User["banned"];
    };
    banned: {
      bannedAt: Date;
    };
  };
}>;

const userMachine = createMachine<User>({/* ... */});
```

For every member it will add the properties from `base`, as well as the
discriminant with the provided name (e.g. locked -> `status: "locked"`).\
The resulting type is a map that indexes each member by its discriminant (e.g.
`User["locked"]`), while the union itself is indexed under `string` (e.g.
`User[string]`).\
It has the benefits of only having to declare and export a single type, reducing
boilerplate, and preventing inconsistencies.

### FAQ

#### - Why are transitions immutable?

Correctly infering the new type of an instance after a transition is easier if
it returns a new instance, rather than mutating the original one.\
Immutability also makes it easier to historicize and compare previous states
(like done in the `onTransition` callback).

#### - What's the difference with XState?

The main difference is that `XState` is event-driven while `machinist` is not.\
With `XState` the caller dispatches an event that will be interpreted by the
machine, to potentially trigger a transition. If the machine doesn't define a
transition for the current state and event, then the event is silently dropped.

On the other hand with `machinist` the caller directly invokes the transition
like a normal method, and it's up to the same caller to ensure that the machine
is in a valid state before doing so.\
Thanks to discriminated unions the compiler can automatically narrow the type of
the state inside of the condition, and list every valid transitions for the
current state. That means no phantom events, the type of the new state is
statically known, and the caller is naturally nudged toward also handling the
case where the machine is not in the desired state (e.g. not rendering the ban
button if the user is already in the banned state).

The other obvious difference is that `machinist` is a small library exporting
two functions, while `XState` has a much larger API surface and bundle size. The
latter also provides more functionality and has excellent documentation,
tooling, and community support.
