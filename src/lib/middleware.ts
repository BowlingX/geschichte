import { Immutable, Patch, produceWithPatches } from 'immer'
import { StoreApi } from 'zustand'
import { shallow } from 'zustand/shallow'
import {
  Config,
  Context,
  HistoryManagement,
  MappedConfig,
  RouterOptions,
} from './store.js'
import {
  applyDiffWithCreateQueriesFromPatch,
  applyFlatConfigToState,
  formatNamespace,
} from './utils.js'
import isDeepEqual from 'fast-deep-equal'

export enum HistoryEventType {
  PUSH,
  REPLACE,
  REGISTER,
}

export interface GenericObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface NamespaceValues<ValueState extends object> {
  /** the amount of elements currently subscribed to the namespaces values */
  subscribers: number
  values: ValueState
  initialValues: ValueState
  managedKeys: string[]
  mappedConfig: MappedConfig
  config: Config
  query: Record<string, string>
  unsubscribe: () => void
}

export type PushStateFunction<T> = (
  ns: string,
  valueCreator: (state: T) => void,
  routerOptions?: RouterOptions
) => Promise<unknown>
export type ReplaceStateFunction<T> = (
  ns: string,
  valueCreator: (state: T) => void,
  routerOptions?: RouterOptions
) => Promise<unknown>

export type InnerNamespace<V extends Record<string, unknown>> = Record<
  string,
  NamespaceValues<V>
>

interface RegistryPayload<ValueState> {
  unsubscribe: () => void
  values: ValueState
  initialValues: ValueState
}

export interface StoreState<
  ThisValue extends Record<string, unknown>,
  Namespaces extends InnerNamespace<ThisValue> = InnerNamespace<ThisValue>,
  C extends Context = Context
> {
  readonly updateFromQuery: (query: string | URLSearchParams) => void
  /**
   * Registers a transition promise. While a transition is pending, mutating operations
   * like pushState/replaceState and their batch variants will wait for the promise
   * to resolve before applying their changes. This is primarily used by adapters
   * (e.g., nextjs) to wait for route transitions to complete so that updateFromQuery
   * can sync state prior to applying new mutations.
   */
  readonly transition: (promise: Promise<unknown>) => void
  readonly batchReplaceState: <Keys extends readonly (keyof Namespaces)[]>(
    ns: Keys,
    fn: (
      ...args: {
        [K in keyof Keys]: Keys[K] extends keyof Namespaces
          ? Namespaces[Keys[K]]['values'] | undefined
          : never
      }
    ) => void,
    routerOptions?: RouterOptions
  ) => Promise<unknown>
  readonly batchPushState: <Keys extends readonly (keyof Namespaces)[]>(
    ns: Keys,
    fn: (
      ...args: {
        [K in keyof Keys]: Keys[K] extends keyof Namespaces
          ? Namespaces[Keys[K]]['values'] | undefined
          : never
      }
    ) => void,
    routerOptions?: RouterOptions
  ) => Promise<unknown>
  namespaces: Namespaces
  readonly pushState: PushStateFunction<Namespaces[keyof Namespaces]['values']>
  readonly replaceState: ReplaceStateFunction<
    Namespaces[keyof Namespaces]['values']
  >
  /** registers a new namespace */
  readonly register: <N extends keyof Namespaces>(
    config: Config,
    mappedConfig: MappedConfig,
    ns: N,
    initialValues: Namespaces[N]['values'],
    query: Record<string, string>,
    values: Namespaces[N]['values']
  ) => RegistryPayload<Namespaces[N]['values']>
  /** will delete all namespaces and remove the history listener */
  readonly unregister: () => void
  readonly resetPush: (ns: string, routerOptions?: RouterOptions) => void
  readonly resetReplace: (ns: string, routerOptions?: RouterOptions) => void
  readonly initialQueries: () => Record<string, string>
  readonly context: C | undefined
}

type NamespaceProducerFunction<
  V extends Record<string, unknown>,
  T extends InnerNamespace<V>
> = (state: T[keyof T]) => void
type InnerNamespaceProducerFunction<
  V extends Record<string, unknown>,
  T extends InnerNamespace<V>
> = (state: T) => T | void

export type NamespaceProducer<
  V extends Record<string, unknown>,
  T extends InnerNamespace<V>
> = (
  stateProducer: NamespaceProducerFunction<V, T>,
  eventType: HistoryEventType,
  ns?: keyof T,
  routerOptions?: RouterOptions
) => Promise<unknown>
export type GenericConverter<
  V extends Record<string, unknown>,
  T extends InnerNamespace<V>
> = (
  stateProducer: InnerNamespaceProducerFunction<V, T>,
  eventType: HistoryEventType,
  ns?: keyof T,
  routerOptions?: RouterOptions
) => Promise<unknown>

export type ImmerProducer<
  V extends Record<string, unknown>,
  T extends InnerNamespace<V>
> = (
  stateMapper: (changes: Patch[], values: StoreState<V, T>) => StoreState<V, T>,
  fn: NamespaceProducerFunction<V, T> & InnerNamespaceProducerFunction<V, T>,
  eventType: HistoryEventType,
  ns?: keyof T
) => void

export declare type StateCreator<
  V extends Record<string, unknown>,
  T extends InnerNamespace<V>
> = (
  set: NamespaceProducer<V, T> & GenericConverter<V, T>,
  get: StoreApi<StoreState<V, T>>['getState'],
  api: StoreApi<StoreState<V, T>>
) => StoreState<V, T>

export const historyManagement =
  <
    V extends Record<string, unknown>,
    T extends InnerNamespace<V>,
    C extends Context
  >(
    historyInstance: HistoryManagement<V, T, C>
  ) =>
  (apply: StateCreator<V, T>) =>
  (
    set: ImmerProducer<V, T>,
    get: StoreApi<StoreState<V, T>>['getState'],
    api: StoreApi<StoreState<V, T>>
  ) =>
    apply(
      (
        fn:
          | NamespaceProducerFunction<V, T>
          | InnerNamespaceProducerFunction<V, T>,
        type: HistoryEventType,
        ns?: keyof T,
        options?: RouterOptions
      ) => {
        return new Promise<unknown>((resolve, reject) => {
          set(
            (changes: Patch[], values: StoreState<V, T>) => {
              if (changes.length === 0) {
                resolve(null)
                return values
              }
              if (type !== HistoryEventType.REGISTER) {
                // if namespace is not given, calculate what namespaces are affected
                const affectedNamespaces: string[] = ns
                  ? [ns as string]
                  : changes.reduce((next: string[], change: Patch) => {
                      const {
                        path: [, namespace],
                      } = change

                      if (next.indexOf(namespace as string) === -1) {
                        return [...next, namespace as string]
                      }
                      return next
                    }, [])

                const uniqueQueries = affectedNamespaces.reduce(
                  (next, thisNs) => {
                    const { config, query: currentQuery } =
                      get().namespaces[thisNs]
                    return {
                      ...next,
                      [thisNs]: applyDiffWithCreateQueriesFromPatch(
                        config,
                        thisNs,
                        currentQuery,
                        changes,
                        values.namespaces[thisNs].values,
                        values.namespaces[thisNs].initialValues,
                        historyInstance.context
                      ),
                    }
                  },
                  {} as Record<string, Record<string, unknown>>
                )

                const method =
                  type === HistoryEventType.PUSH ? 'push' : 'replace'

                const otherQueries = Object.keys(values.namespaces).reduce(
                  (next, thisNs) => {
                    if (affectedNamespaces.indexOf(thisNs) !== -1) {
                      return next
                    }
                    return {
                      ...next,
                      ...values.namespaces[thisNs].query,
                    }
                  },
                  {}
                )

                const reducedQueries = Object.keys(uniqueQueries).reduce(
                  (next, thisNs) => ({ ...next, ...uniqueQueries[thisNs] }),
                  {}
                )

                const queryObject = Object.freeze({
                  ...otherQueries,
                  ...reducedQueries,
                })

                historyInstance[method](queryObject, values.namespaces, options)
                  .then(resolve)
                  .catch(reject)

                // We save the current state of `query` for all affected namespaces
                return {
                  ...values,
                  namespaces: {
                    ...values.namespaces,
                    ...affectedNamespaces.reduce((next, thisNs: string) => {
                      return {
                        ...next,
                        [thisNs]: {
                          ...values.namespaces[thisNs],
                          query: uniqueQueries[thisNs],
                        },
                      }
                    }, {}),
                  },
                }
              }
              resolve(null)
              return values
            },
            fn as NamespaceProducerFunction<V, T> &
              InnerNamespaceProducerFunction<V, T>,
            type,
            ns
          )
        })
        // H
      },
      get,
      api
    )

/**
 * If a namespace is given, will forward the mutation instead of updating
 * the whole state. Initializes the namespace if it does not exist yet
 */
const namespaceProducer =
  <V extends Record<string, unknown>, T extends InnerNamespace<V>>(
    fn: NamespaceProducerFunction<V, T> & InnerNamespaceProducerFunction<V, T>,
    ns?: keyof T
  ) =>
  (state: StoreState<V, T>) => {
    if (!ns) {
      const result = fn(state.namespaces)
      // if no namespaces is given, we support return values
      if (result) {
        state.namespaces = result
      }
      return
    }
    if (state.namespaces[ns]) {
      fn(state.namespaces[ns])
      return
    }
    const next = {} as T[keyof T]
    fn(next)
    state.namespaces[ns] = next as T[keyof T]
  }

export type ImmerStateCreator<
  V extends Record<string, unknown>,
  T extends InnerNamespace<V>
> = (
  fn: ImmerProducer<V, T>,
  get: StoreApi<StoreState<V, T>>['getState'],
  api: StoreApi<StoreState<V, T>>
) => StoreState<V, T>

export type SetImmerState<T> = (
  stateProducer: (state: T) => T,
  debugMiddlewareKey: string
) => void

export const immerWithPatches =
  <V extends Record<string, unknown>, T extends InnerNamespace<V>>(
    config: ImmerStateCreator<V, T>
  ) =>
  (
    set: SetImmerState<StoreState<V, T>>,
    get: StoreApi<StoreState<V, T>>['getState'],
    api: StoreApi<StoreState<V, T>>
  ) =>
    config(
      (valueMapper, fn, type: HistoryEventType, ns?: keyof T) => {
        return set((currentState) => {
          const [nextValues, changes] = produceWithPatches(
            namespaceProducer(fn, ns)
          )(currentState as Immutable<StoreState<V, T>>)
          return valueMapper(changes, nextValues)
        }, `action_${HistoryEventType[type]}`)
      },
      get,
      api
    )

const parseSearchString = (search: string | URLSearchParams) =>
  typeof search === 'string'
    ? Object.fromEntries(new URLSearchParams(search).entries())
    : Object.fromEntries(search.entries())

export const converter =
  <
    V extends Record<string, unknown>,
    T extends InnerNamespace<V>,
    C extends Context
  >(
    historyInstance: HistoryManagement<V, T, C>
  ) =>
  (
    set: NamespaceProducer<V, T> & GenericConverter<V, T>,
    get: StoreApi<StoreState<V, T>>['getState']
  ): StoreState<V, T> => {
    // Transition handling: when set by an adapter, calls to set from public API
    // will be delayed until the transition promise resolves.
    let transitionPromise: Promise<unknown> | null = null
    const awaitIfTransition = <R>(cb: () => Promise<R>): Promise<R> =>
      transitionPromise ? transitionPromise.then(cb) : cb()
    const registerTransition = (p: Promise<unknown>) => {
      transitionPromise = p.finally(() => {
        // Only clear if this promise is still the active one
        if (transitionPromise === p) {
          transitionPromise = null
        }
      })
    }
    const updateFromQuery = (search: string | URLSearchParams) => {
      const nextQueries = parseSearchString(search)
      const namespaces = get().namespaces
      Object.keys(namespaces).forEach((ns) => {
        // It's possible that the ns got cleared while we are applying the new state.
        // here we explicitly get the reference to the ns, `namespaces` is too weak.
        if (get().namespaces[ns]) {
          const outerState = get().namespaces[ns]
          const thisNextQueries = applyFlatConfigToState(
            outerState.mappedConfig,
            nextQueries,
            ns,
            {} as V,
            outerState.initialValues,
            false,
            historyInstance.context
          )
          // We might have already the correct state applied that match the query parameters
          if (!shallow(get().namespaces[ns].query, thisNextQueries)) {
            set(
              (state) => {
                state.query = applyFlatConfigToState(
                  state.mappedConfig,
                  nextQueries,
                  ns,
                  state.values,
                  state.initialValues,
                  true,
                  historyInstance.context
                )
              },
              HistoryEventType.REGISTER,
              ns
            )
          }
        }
      })
    }

    const reset = (
      ns: string,
      event: HistoryEventType,
      routerOptions?: RouterOptions
    ) =>
      set(
        (state) => void (state.values = state.initialValues),
        event,
        ns,
        routerOptions
      )
    return {
      context: historyInstance.context,
      transition: registerTransition,
      /** batch pushes the given namespaces */
      batchPushState: <Keys extends readonly (keyof T)[]>(
        ns: Keys,
        fn: (
          ...valueStateA: {
            [K in keyof Keys]: Keys[K] extends keyof T
              ? T[Keys[K]]['values'] | undefined
              : never
          }
        ) => void,
        routerOptions?: RouterOptions
      ) =>
        awaitIfTransition(() =>
          set(
            (state) =>
              void fn(
                // @ts-expect-error cannot infer
                ...ns.map((thisNs) => (state[thisNs] || {}).values)
              ),
            HistoryEventType.PUSH,
            undefined,
            routerOptions
          )
        ),
      /** batch replaces the given namespaces */
      batchReplaceState: <Keys extends readonly (keyof T)[]>(
        ns: Keys,
        fn: (
          ...valueStateA: {
            [K in keyof Keys]: Keys[K] extends keyof T
              ? T[Keys[K]]['values'] | undefined
              : never
          }
        ) => void,
        routerOptions?: RouterOptions
      ) =>
        awaitIfTransition(() =>
          set(
            (state: T) =>
              // @ts-expect-error cannot infer
              void fn(...ns.map((thisNs) => (state[thisNs] || {}).values)),
            HistoryEventType.REPLACE,
            undefined,
            routerOptions
          )
        ),
      /** the initial queries when the script got executed first (usually on page load). */
      initialQueries: () => parseSearchString(historyInstance.initialSearch()),
      /** here we store all data and configurations for the different namespaces */
      namespaces: {} as T,
      /** pushes a new state for a given namespace, (will use history.pushState) */
      pushState: (
        ns: string,
        fn: (values: T[keyof T]['values']) => void,
        routerOptions
      ) =>
        awaitIfTransition(() =>
          set(
            (state) => fn(state.values),
            HistoryEventType.PUSH,
            ns,
            routerOptions
          )
        ),
      /** registers a new namespace and initializes it's configuration */
      register: <N extends keyof T>(
        config: Config,
        mappedConfig: MappedConfig,
        ns: N,
        initialValues: T[N]['values'],
        query: Record<string, string>,
        values: T[N]['values']
      ) => {
        const current = get().namespaces[ns]
        const defaultsEqual = isDeepEqual(current?.initialValues, initialValues)
        if (current !== undefined) {
          set(
            (state) => {
              state.subscribers = state.subscribers + 1
              if (!defaultsEqual) {
                state.initialValues = initialValues
                state.query = applyFlatConfigToState(
                  state.mappedConfig,
                  parseSearchString(historyInstance.initialSearch()),
                  ns as string,
                  state.values,
                  initialValues,
                  true,
                  historyInstance.context
                )
              }
            },
            HistoryEventType.REGISTER,
            ns
          )
          return {
            initialValues: get().namespaces[ns].initialValues,
            unsubscribe: get().namespaces[ns].unsubscribe,
            values: get().namespaces[ns].values,
          }
        }
        // read initial query state:
        set(
          (state) => {
            state.subscribers = 1
            state.unsubscribe = () => {
              ;(set as GenericConverter<V, T>)((thisState) => {
                // it's possible that the state namespace has been cleared by the provider
                if (!thisState[ns]) {
                  return
                }
                thisState[ns].subscribers = thisState[ns].subscribers - 1
                if (thisState[ns].subscribers === 0) {
                  // Delay the removal of subscribers, as we may have direct remounting components after
                  requestAnimationFrame(() => {
                    ;(set as GenericConverter<V, T>)((inner) => {
                      if (inner[ns]?.subscribers === 0) {
                        delete inner[ns]
                      }
                    }, HistoryEventType.REGISTER)
                  })
                }
              }, HistoryEventType.REGISTER)
            }
            state.mappedConfig = mappedConfig
            state.config = config
            state.managedKeys = Object.keys(mappedConfig).map((key) =>
              formatNamespace(key, ns as string)
            )
            state.initialValues = initialValues
            state.values = values
            state.query = query
          },
          HistoryEventType.REGISTER,
          ns
        )
        return {
          initialValues,
          unsubscribe: get().namespaces[ns].unsubscribe,
          values,
        }
      },
      replaceState: (
        ns: string,
        fn: (values: T[keyof T]['values']) => void,
        routerOptions
      ) =>
        awaitIfTransition(() =>
          set(
            (state) => fn(state.values),
            HistoryEventType.REPLACE,
            ns,
            routerOptions
          )
        ),
      resetPush: (ns: string, routerOptions) =>
        reset(ns, HistoryEventType.PUSH, routerOptions),
      resetReplace: (ns: string, routerOptions) =>
        reset(ns, HistoryEventType.REPLACE, routerOptions),
      /** cleans up this instance */
      unregister: () => {
        set(() => {
          // return a new object for namespaces
          return {}
        }, HistoryEventType.REGISTER)
      },
      updateFromQuery,
    }
  }
