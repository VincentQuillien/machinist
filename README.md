<h1 style="text-align: center;">typed-machine</h1>

### Type-driven finite state machines

Describe state machines with types, letting them drive implementation and usage.

### Usage

Use a
[discriminated union](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
to describe the possible states of the machine, and the transitions between
them:

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

With only type-level declarations we know everything about our state machine:

- A user always has a name and an age
- It can be in one of three states: `active`, `locked`, or `banned`.
- A `active` user can be locked, a `locked` user can either be unlocked or
  banned.
- A `banned` user cannot transition to any other state, it's in a final state.

Since all states have a common `status` discriminant, we can use it to narrow
the type of a user and access its state-specific properties and available
transitions:

```ts
if (user.status === "active") {
  // user has been narrowed, the compiler knows `lock` is available
  user.lock("Can't verify identity");
}
// else we can't call `lock`
```

> [!IMPORTANT]
> The instances of the machines are **immutable**, transitions return new
> instances and don't mutate the original one.\
> Than means you can chain transitions and keep the original instance unchanged:
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

Keeping the implementation separate allows to keep the declaration high-level
and readable, without drowning the signal in implementation details.\
You can still navigate from the declaration to the implementation(s) (and vice
versa) with your editor's "Go to definition" feature.

To spawn new instances of the machine call the `new` method with the initial
state:

```ts
const activeUser = userMachine.new({
  name: "Alice",
  age: 25,
  status: "active",
});

const lockedUser = userMachine.new({
  name: "Bob",
  age: 30,
  status: "locked",
  lockReason: "reason",
});
```

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
as a general implementation target and possible alternative to classes.

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

### FAQ

#### - Why immutable?

Correctly infering the new type of an instance after a transition is easier if
it returns a new instance, rather than mutating the original one.\
Immutability also makes it easier to historicize and compare previous states
(like done in the `onTransition` callback).

#### - Am I stuck with the library after adoption?

The library encourages you to design your machines in pure type-level without
any external dependencies, only the implementation is library-specific.\
You can remove the dependency later and keep the type definitions as well as the
logic from the transitions.\
With a bundle size of <1KB, and an API surface of two functions and one type it
is meant to make itself as small as possible in your domain layer.
