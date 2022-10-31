/* tslint:disable:no-expression-statement readonly-keyword no-mixed-interface no-object-mutation readonly-array */
import { Patch, produceWithPatches } from 'immer'
import memoizeOne from 'memoize-one'
import { GetState, State, StoreApi } from 'zustand'
// tslint:disable-next-line:no-submodule-imports
import shallow from 'zustand/shallow'
import {
  Config,
  DEFAULT_NAMESPACE,
  HistoryManagement,
  MappedConfig,
  RouterOptions,
} from './store'
import {
  applyDiffWithCreateQueriesFromPatch,
  applyFlatConfigToState,
} from './utils'

export enum HistoryEventType {
  PUSH,
  REPLACE,
  REGISTER,
}

export interface GenericObject {
  [key: string]: any
}

export interface NamespaceValues<ValueState extends object> {
  /** the amount of elements currently subscribed to the namespaces values */
  subscribers: number
  values: ValueState
  initialValues: ValueState
  mappedConfig: MappedConfig
  config: Config
  query: Record<string, string>
  unsubscribe: () => boolean
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

export interface InnerNamespace<T extends object> {
  [ns: string]: NamespaceValues<T>
}

interface RegistryPayload<ValueState> {
  unsubscribe: () => boolean
  values: ValueState
  initialValues: ValueState
}

export interface StoreState<ValueState extends object> extends State {
  readonly updateFromQuery: (query: string) => void
  readonly batchReplaceState: (
    ns: readonly string[],
    fn: (...valueState: ValueState[]) => void,
    routerOptions?: RouterOptions
  ) => Promise<unknown>
  readonly batchPushState: (
    ns: readonly string[],
    fn: (...valueState: ValueState[]) => void,
    routerOptions?: RouterOptions
  ) => Promise<unknown>
  namespaces: InnerNamespace<ValueState>
  readonly pushState: PushStateFunction<ValueState>
  readonly replaceState: ReplaceStateFunction<ValueState>
  /** registers a new namespace */
  readonly register: (
    config: Config,
    mappedConfig: MappedConfig,
    ns: string,
    initialValues: ValueState,
    query: Record<string, string>,
    values: ValueState
  ) => RegistryPayload<ValueState>
  /** will delete all namespaces and remove the history listener */
  readonly unregister: () => void
  readonly resetPush: (ns: string, routerOptions?: RouterOptions) => void
  readonly resetReplace: (ns: string, routerOptions?: RouterOptions) => void
  readonly initialQueries: () => object
}

type NamespaceProducerFunction<T extends object> = (
  state: NamespaceValues<T>
) => void
type InnerNamespaceProducerFunction<T extends object> = (
  state: InnerNamespace<T>
) => InnerNamespace<T> | void

export type NamespaceProducer<T extends object> = (
  stateProducer: NamespaceProducerFunction<T>,
  eventType: HistoryEventType,
  ns?: string,
  routerOptions?: RouterOptions
) => Promise<unknown>
export type GenericConverter<T extends object> = (
  stateProducer: InnerNamespaceProducerFunction<T>,
  eventType: HistoryEventType,
  ns?: string,
  routerOptions?: RouterOptions
) => Promise<unknown>

export type ImmerProducer<T extends object> = (
  stateMapper: (changes: Patch[], values: StoreState<T>) => StoreState<T>,
  fn: NamespaceProducerFunction<T> & InnerNamespaceProducerFunction<T>,
  eventType: HistoryEventType,
  ns?: string
) => void

export declare type StateCreator<T extends object> = (
  set: NamespaceProducer<T> & GenericConverter<T>,
  get: GetState<StoreState<T>>,
  api: StoreApi<StoreState<T>>
) => StoreState<T>

export const historyManagement =
  <T extends State>(historyInstance: HistoryManagement) =>
  (apply: StateCreator<T>) =>
  (
    set: ImmerProducer<T>,
    get: GetState<StoreState<T>>,
    api: StoreApi<StoreState<T>>
  ) =>
    apply(
      (
        fn: NamespaceProducerFunction<T> | InnerNamespaceProducerFunction<T>,
        type: HistoryEventType,
        ns?: string,
        options?: RouterOptions
      ) => {
        return new Promise<unknown>((resolve, reject) => {
          set(
            (changes: Patch[], values: StoreState<T>) => {
              if (changes.length === 0) {
                resolve(null)
                return values
              }
              if (type !== HistoryEventType.REGISTER) {
                // if namespace is not given, calculate what namespaces are affected
                const affectedNamespaces: string[] = ns
                  ? [ns]
                  : changes.reduce((next: string[], change: Patch) => {
                      const {
                        path: [, namespace],
                      } = change

                      if (next.indexOf(namespace as string) === -1) {
                        return [...next, namespace as string]
                      }
                      return next
                    }, [])

                const uniqueQueries: {
                  [key: string]: any
                } = affectedNamespaces.reduce((next, thisNs) => {
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
                      values.namespaces[thisNs].initialValues
                    ),
                  }
                }, {})

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

                historyInstance[method](queryObject, options)
                  .then(resolve)
                  .catch(reject)

                // We save the current state of `query` for all affected namespaces
                return {
                  ...values,
                  namespaces: {
                    ...values.namespaces,
                    ...affectedNamespaces.reduce(
                      (next: any, thisNs: string) => {
                        return {
                          ...next,
                          [thisNs]: {
                            ...values.namespaces[thisNs],
                            query: uniqueQueries[thisNs],
                          },
                        }
                      },
                      {}
                    ),
                  },
                }
              }
              resolve(null)
              return values
            },
            fn as NamespaceProducerFunction<T> &
              InnerNamespaceProducerFunction<T>,
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
  <T extends object>(
    fn: NamespaceProducerFunction<T> & InnerNamespaceProducerFunction<T>,
    ns?: string
  ) =>
  (state: StoreState<T>) => {
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
    const next = {}
    fn(next)
    state.namespaces[ns] = next as NamespaceValues<T>
  }

export type ImmerStateCreator<T extends object> = (
  fn: ImmerProducer<T>,
  get: GetState<StoreState<T>>,
  api: StoreApi<StoreState<T>>
) => StoreState<T>

export type SetImmerState<T> = (
  stateProducer: (state: T) => T,
  debugMiddlewareKey: string
) => void

export const immerWithPatches =
  <T extends object>(config: ImmerStateCreator<T>) =>
  (
    set: SetImmerState<StoreState<T>>,
    get: GetState<StoreState<T>>,
    api: StoreApi<StoreState<T>>
  ) =>
    config(
      (valueMapper, fn, type: HistoryEventType, ns?: string) => {
        return set((currentState) => {
          const [nextValues, changes] = produceWithPatches(
            namespaceProducer(fn, ns)
            // FIXME: Not sure why this is not working properly with the types
          )(currentState as any)
          return valueMapper(changes, nextValues as StoreState<T>)
        }, `action_${HistoryEventType[type]}`)
      },
      get,
      api
    )

const parseSearchString = (search: string) =>
  Object.fromEntries(new URLSearchParams(search).entries())

export const converter =
  <T extends object>(historyInstance: HistoryManagement) =>
  (
    set: NamespaceProducer<T> & GenericConverter<T>,
    get: GetState<StoreState<T>>,
    api: StoreApi<StoreState<T>>
  ): StoreState<T> => {
    const memoizedGetInitialQueries = memoizeOne(parseSearchString)

    const updateFromQuery = (search: string) => {
      const nextQueries = memoizedGetInitialQueries(search)
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
            {},
            outerState.initialValues,
            false
          )
          // We might have already the correct state applied that match the query parameters
          if (!shallow(get().namespaces[ns].query, thisNextQueries)) {
            set(
              (state: NamespaceValues<T>) => {
                state.query = applyFlatConfigToState(
                  state.mappedConfig,
                  nextQueries,
                  ns,
                  state.values,
                  state.initialValues
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
        (state: NamespaceValues<T>) =>
          void (state.values = state.initialValues),
        event,
        ns,
        routerOptions
      )

    return {
      /** batch pushes the given namespaces */
      batchPushState: (
        ns: readonly string[],
        fn: (...valueState: T[]) => void,
        routerOptions
      ) => {
        return set(
          (state: InnerNamespace<T>) =>
            void fn(...ns.map((thisNs) => (state[thisNs] || {}).values)),
          HistoryEventType.PUSH,
          undefined,
          routerOptions
        )
      },
      /** batch replaces the given namespaces */
      batchReplaceState: (
        ns: readonly string[],
        fn: (...valueState: T[]) => void,
        routerOptions
      ) => {
        return set(
          (state: InnerNamespace<T>) =>
            void fn(...ns.map((thisNs) => (state[thisNs] || {}).values)),
          HistoryEventType.REPLACE,
          undefined,
          routerOptions
        )
      },
      /** the initial queries when the script got executed first (usually on page load). */
      initialQueries: () =>
        memoizedGetInitialQueries(historyInstance.initialSearch()),
      /** here we store all data and configurations for the different namespaces */
      namespaces: {},
      /** pushes a new state for a given namespace, (will use history.pushState) */
      pushState: (ns: string, fn: (values: T) => void, routerOptions) =>
        (set as NamespaceProducer<T>)(
          (state) => fn(state.values),
          HistoryEventType.PUSH,
          ns,
          routerOptions
        ),
      /** registers a new namespace and initializes it's configuration */
      register: (
        config: Config,
        mappedConfig: MappedConfig,
        ns: string,
        initialValues: T,
        query: Record<string, string>,
        values: T
      ) => {
        const current = get().namespaces[ns]
        const defaultsEqual = current?.initialValues === initialValues
        if (current !== undefined) {
          set(
            (state) => {
              state.subscribers = state.subscribers + 1
              if (!defaultsEqual) {
                state.initialValues = initialValues
                state.query = applyFlatConfigToState(
                  state.mappedConfig,
                  memoizedGetInitialQueries(historyInstance.initialSearch()),
                  ns,
                  state.values,
                  initialValues
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
              ;(set as GenericConverter<T>)((thisState: InnerNamespace<T>) => {
                // it's possible that the state namespace has been cleared by the provider
                if (!thisState[ns]) {
                  return
                }
                thisState[ns].subscribers = thisState[ns].subscribers - 1
                if (thisState[ns].subscribers === 0) {
                  // tslint:disable-next-line:no-delete
                  delete thisState[ns]
                }
              }, HistoryEventType.REGISTER)
              return !get().namespaces[ns]
            }
            state.mappedConfig = mappedConfig
            state.config = config
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
      replaceState: (ns: string, fn: (values: T) => void, routerOptions) =>
        (set as NamespaceProducer<T>)(
          (state) => fn(state.values),
          HistoryEventType.REPLACE,
          ns,
          routerOptions
        ),
      resetPush: (ns: string, routerOptions) =>
        reset(ns, HistoryEventType.PUSH, routerOptions),
      resetReplace: (ns: string, routerOptions) =>
        reset(ns, HistoryEventType.REPLACE, routerOptions),
      /** cleans up this instance */
      unregister: () => {
        ;(set as GenericConverter<T>)(() => {
          // return a new object for namespaces
          return {}
        }, HistoryEventType.REGISTER)
      },
      updateFromQuery,
    }
  }
