/* tslint:disable:no-expression-statement readonly-keyword no-mixed-interface no-object-mutation readonly-array */
import { History } from 'history'
import { Patch, produceWithPatches } from 'immer'
import memoizeOne from 'memoize-one'
import { parse, stringify } from 'query-string'
import { GetState, State, StoreApi } from 'zustand'
import { Config, MappedConfig } from './store'
import {
  applyDiffWithCreateQueriesFromPatch,
  applyFlatConfigToState
} from './utils'

export enum HistoryEventType {
  PUSH,
  REPLACE,
  REGISTER
}

export interface GenericObject {
  [key: string]: any
}

export interface NamespaceValues<ValueState> {
  /** the amount of elements currently subscribed to the namespaces values */
  subscribers: number
  values: ValueState
  initialValues: ValueState
  mappedConfig: MappedConfig
  config: Config
  query: object
  unsubscribe: () => void
}

export type PushStateFunction<T> = (
  ns: string,
  valueCreator: (state: T) => void
) => void
export type ReplaceStateFunction<T> = (
  ns: string,
  valueCreator: (state: T) => void
) => void

export interface InnerNamespace<T> {
  [ns: string]: NamespaceValues<T>
}
export interface StoreState<ValueState = object> {
  updateFromQuery: (query: string) => void
  batchReplaceState: (
    ns: readonly string[],
    fn: (...valueState: ValueState[]) => void
  ) => void
  batchPushState: (
    ns: readonly string[],
    fn: (...valueState: ValueState[]) => void
  ) => void
  namespaces: InnerNamespace<ValueState>
  pushState: PushStateFunction<ValueState>
  replaceState: ReplaceStateFunction<ValueState>
  /** registers a new namespace */
  register: (
    config: Config,
    mappedConfig: MappedConfig,
    ns: string,
    initialValues: ValueState,
    query: object,
    values: ValueState
  ) => () => void
  /** will delete all namespaces and remove the history listener */
  unregister: () => void
  resetPush: (ns: string) => void
  resetReplace: (ns: string) => void
  initialQueries: () => object
}

type NamespaceProducerFunction<T> = (state: NamespaceValues<T>) => void
type InnerNamespaceProducerFunction<T> = (
  state: InnerNamespace<T>
) => InnerNamespace<T> | void

export type NamespaceProducer<T> = (
  stateProducer: NamespaceProducerFunction<T>,
  eventType: HistoryEventType,
  ns?: string
) => void
export type GenericConverter<T> = (
  stateProducer: InnerNamespaceProducerFunction<T>,
  eventType: HistoryEventType,
  ns?: string
) => void

export type ImmerProducer<T> = (
  stateMapper: (changes: Patch[], values: StoreState<T>) => StoreState<T>,
  fn: NamespaceProducerFunction<T> & InnerNamespaceProducerFunction<T>,
  eventType: HistoryEventType,
  ns?: string
) => void

export declare type StateCreator<T extends State> = (
  set: NamespaceProducer<T> & GenericConverter<T>,
  get: GetState<StoreState<T>>,
  api: StoreApi<StoreState<T>>
) => StoreState<T>

export const historyManagement = <T>(historyInstance: History) => (
  apply: StateCreator<T>
) => (
  set: ImmerProducer<T>,
  get: GetState<StoreState<T>>,
  api: StoreApi<StoreState<T>>
) =>
  apply(
    (
      fn: NamespaceProducerFunction<T> | InnerNamespaceProducerFunction<T>,
      type: HistoryEventType,
      ns?: string
    ) => {
      // we call the `immerWithPatches` middleware
      return set(
        (changes: Patch[], values: StoreState<T>) => {
          if (changes.length === 0) {
            return values
          }
          if (type !== HistoryEventType.REGISTER) {
            // if namespace is not given, calculate what namespaces are affected
            const affectedNamespaces: string[] = ns
              ? [ns]
              : changes.reduce((next: string[], change: Patch) => {
                  const {
                    path: [, namespace]
                  } = change

                  if (next.indexOf(namespace as string) === -1) {
                    return [...next, namespace as string]
                  }
                  return next
                }, [])

            const uniqueQueries: {
              [key: string]: any
            } = affectedNamespaces.reduce((next, thisNs) => {
              const { config, query: currentQuery } = get().namespaces[thisNs]
              return {
                ...next,
                [thisNs]: applyDiffWithCreateQueriesFromPatch(
                  config,
                  thisNs,
                  currentQuery,
                  changes,
                  values.namespaces[thisNs].values,
                  values.namespaces[thisNs].initialValues
                )
              }
            }, {})

            const method = type === HistoryEventType.PUSH ? 'push' : 'replace'

            const otherQueries = Object.keys(values.namespaces).reduce(
              (next, thisNs) => {
                if (affectedNamespaces.indexOf(thisNs) !== -1) {
                  return next
                }
                return {
                  ...next,
                  ...values.namespaces[thisNs].query
                }
              },
              {}
            )

            const reducedQueries = Object.keys(uniqueQueries).reduce(
              (next, thisNs) => ({ ...next, ...uniqueQueries[thisNs] }),
              {}
            )

            const query = stringify({
              ...otherQueries,
              ...reducedQueries
            })
            historyInstance[method]({
              search: query === '' ? '' : `?${query}`,
              state: { __g__: true }
            })

            // We safe the current state of `query` for all affected namespaces
            return {
              ...values,
              namespaces: {
                ...values.namespaces,
                ...affectedNamespaces.reduce((next: any, thisNs: string) => {
                  return {
                    ...next,
                    [thisNs]: {
                      ...values.namespaces[thisNs],
                      query: uniqueQueries[thisNs]
                    }
                  }
                }, {})
              }
            }
          }
          return values
        },
        fn as NamespaceProducerFunction<T> & InnerNamespaceProducerFunction<T>,
        type,
        ns
      )
      // H
    },
    get,
    api
  )

/**
 * If a namespace is given, will forward the mutation instead of updating
 * the whole state. Initializes the namespace if it does not exist yet
 */
const namespaceProducer = <T>(
  fn: NamespaceProducerFunction<T> & InnerNamespaceProducerFunction<T>,
  ns?: string
) => (state: StoreState<T>) => {
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

export declare type ImmerStateCreator<T extends State> = (
  fn: ImmerProducer<T>,
  get: GetState<StoreState<T>>,
  api: StoreApi<StoreState<T>>
) => StoreState<T>

export declare type SetImmerState<T> = (
  stateProducer: (state: T) => T,
  debugMiddlewareKey: string
) => void

export const immerWithPatches = <T>(config: ImmerStateCreator<T>) => (
  set: SetImmerState<StoreState<T>>,
  get: GetState<StoreState<T>>,
  api: StoreApi<StoreState<T>>
) =>
  config(
    (valueMapper, fn, type: HistoryEventType, ns?: string) => {
      return set((currentState: StoreState<T>) => {
        const [nextValues, changes] = produceWithPatches(
          namespaceProducer(fn, ns)
          // @ts-ignore
          // FIXME: Need to check why this causes an error
        )(currentState)
        return valueMapper(changes, nextValues)
      }, `action_${HistoryEventType[type]}`)
    },
    get,
    api
  )

const parseSearchString = (search: string) => parse(search)

export const converter = <T extends GenericObject>(
  historyInstance: History
) => (
  set: NamespaceProducer<T> & GenericConverter<T>,
  get: GetState<StoreState<T>>,
  api: StoreApi<StoreState<T>>
): StoreState<T> => {
  const memoizedGetInitialQueries = memoizeOne(parseSearchString)

  const updateFromQuery = (search: string) => {
    const nextQueries = memoizedGetInitialQueries(search)
    const namespaces = get().namespaces
    Object.keys(namespaces).forEach(ns => {
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
    })
  }

  const unregisterListener = historyInstance.listen((location, action) => {
    // don't handle our own actions
    if (
      (action === 'REPLACE' || action === 'PUSH') &&
      location.state &&
      location.state.__g__
    ) {
      return
    }
    updateFromQuery(location.search)
  })

  const reset = (ns: string, event: HistoryEventType) =>
    set(
      (state: NamespaceValues<T>) => void (state.values = state.initialValues),
      event,
      ns
    )

  return {
    /** batch pushes the given namespaces */
    batchPushState: (
      ns: readonly string[],
      fn: (...valueState: T[]) => void
    ) => {
      set(
        (state: InnerNamespace<T>) =>
          void fn(...ns.map(thisNs => (state[thisNs] || {}).values)),
        HistoryEventType.PUSH
      )
    },
    /** batch replaces the given namespaces */
    batchReplaceState: (
      ns: readonly string[],
      fn: (...valueState: T[]) => void
    ) => {
      set(
        (state: InnerNamespace<T>) =>
          void fn(...ns.map(thisNs => (state[thisNs] || {}).values)),
        HistoryEventType.REPLACE
      )
    },
    /** the initial queries when the script got executed first (usually on page load). */
    initialQueries: () =>
      memoizedGetInitialQueries(historyInstance.location.search),
    /** here we store all data and configurations for the different namespaces */
    namespaces: {},
    /** pushes a new state for a given namespace, (will use history.pushState) */
    pushState: (ns: string, fn: (values: T) => void) =>
      (set as NamespaceProducer<T>)(
        state => fn(state.values),
        HistoryEventType.PUSH,
        ns
      ),
    /** registers a new namespace and initializes it's configuration */
    register: (
      config: Config,
      mappedConfig: MappedConfig,
      ns: string,
      initialValues: T,
      query: object,
      values: T
    ) => {
      const current = get().namespaces[ns]
      if (current !== undefined) {
        set(
          state => {
            state.subscribers = state.subscribers + 1
          },
          HistoryEventType.REGISTER,
          ns
        )
        return current.unsubscribe
      }
      // read initial query state:
      set(
        state => {
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

      return get().namespaces[ns].unsubscribe
    },
    replaceState: (ns: string, fn: (values: T) => void) =>
      (set as NamespaceProducer<T>)(
        state => fn(state.values),
        HistoryEventType.REPLACE,
        ns
      ),
    resetPush: (ns: string) => reset(ns, HistoryEventType.PUSH),
    resetReplace: (ns: string) => reset(ns, HistoryEventType.REPLACE),
    /** cleans up this instance */
    unregister: () => {
      ;(set as GenericConverter<T>)(() => {
        // return a new object for namespaces
        return {}
      }, HistoryEventType.REGISTER)
      // unregister history event listener
      unregisterListener()
    },
    updateFromQuery
  }
}
