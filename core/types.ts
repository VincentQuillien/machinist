// deno-lint-ignore-file no-explicit-any ban-types

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void ? I
  : never;

type GetParams<T, TFunctionKey extends string> = T extends {
  [K in TFunctionKey]: (...args: infer Params) => any;
} ? [prev: State<T>, ...Params]
  : never;

type GetReturn<T, TFunctionKey extends string> = T extends {
  [K in TFunctionKey]: (...args: any[]) => infer R;
} ? R extends Promise<infer R> ? Promise<State<R>> : State<R>
  : never;

export type MachineImpl<
  T,
  TFunctions = UnionToIntersection<Functions<T>>,
  TTransitions = Transitions<T, TFunctions>,
  TMethods = Omit<TFunctions, keyof TTransitions>,
> =
  & {
    transitions: {
      [K in keyof TTransitions]: (
        ...args: GetParams<T, K & string>
      ) => GetReturn<T, K & string>;
    };
  }
  & (keyof TMethods extends never ? {} : {
    methods: {
      [K in keyof TMethods]: (
        ...args: GetParams<T, K & string>
      ) => TMethods[K] extends (...args: any[]) => infer R ? R : never;
    };
  })
  & {
    onTransition?: (prev: State<T>, next: State<T>) => void;
  };

type Functions<T> = {
  [Key in keyof T as T[Key] extends (...args: any[]) => any ? Key : never]:
    T[Key];
};
type Transitions<T, TFunctions> = {
  [
    Key in keyof TFunctions as TFunctions[Key] extends
      (...args: any[]) => T | Promise<T> ? Key
      : never
  ]: TFunctions[Key];
};

/**
 * Extracts the type of the state from the machine, removing transitions and methods.
 */
export type State<T> = {
  [Key in keyof T as T[Key] extends Function ? never : Key]: T[Key];
};

type ExtractMember<
  T,
  U,
  Member = T extends any ? (U extends State<T> ? T : never) : never,
> = [Member] extends [never] ? T : Member;

export type InferUnion<T> = string extends keyof T ? T[string] : T;

/**
 * State machine implementation
 */
export type Machine<T, TUnion = InferUnion<T>> = {
  new: <TState extends State<TUnion>>(
    initialState: TState,
  ) => ExtractMember<TUnion, TState>;
} & MachineImpl<TUnion>;

/**
 * Declares a state machine and infers the discriminated union of states.
 */
export type DeclareMachine<
  T extends { base?: any; states: any; discriminant: string },
  TRecord = {
    [K in keyof T["states"]]:
      & T["states"][K]
      & { [Discriminant in T["discriminant"]]: K }
      & T["base"];
  },
  TUnion = TRecord[keyof TRecord],
> = TRecord & { [union: string]: TUnion };
