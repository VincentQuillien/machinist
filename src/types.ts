// deno-lint-ignore-file no-explicit-any ban-types

type States<T, Discriminant extends keyof T> = {
  [K in T[Discriminant] & string]: Extract<T, { [_ in Discriminant]: K }>;
};
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
} ? State<R>
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
    Key in keyof TFunctions as TFunctions[Key] extends (...args: any[]) => T
      ? Key
      : never
  ]: TFunctions[Key];
};

export type State<T> = {
  [Key in keyof T as T[Key] extends Function ? never : Key]: T[Key];
};

type ExtractMember<
  T,
  U,
  Member = T extends any ? (U extends State<T> ? T : never) : never,
> = [Member] extends [never] ? T : Member;

export type Machine<T> = {
  new: <TState extends State<T>>(
    initialState: TState,
  ) => ExtractMember<T, TState>;
} & Omit<MachineImpl<T>, "onTransition">;
