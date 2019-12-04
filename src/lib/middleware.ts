/* tslint:disable:no-expression-statement readonly-keyword no-mixed-interface no-object-mutation */
import { History } from 'history'
import { produceWithPatches } from 'immer'
import { parse, stringify } from 'query-string'
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

export interface StoreState<ValueState = object> {
  namespaces: {
    [name: string]: NamespaceValues<ValueState>
  }
  pushState: PushStateFunction<ValueState>
  replaceState: ReplaceStateFunction<ValueState>
  /** registers a new namespace */
  register: (
    config: Config,
    mappedConfig: MappedConfig,
    ns: string,
    initialValues?: ValueState
  ) => void
  /** will delete all namespaces and remove the history listener */
  unregister: () => void
}

export const historyManagement = (historyInstance: History) => apply => (
  set,
  get,
  api
) =>
  apply(
    (fn, type: HistoryEventType, ns?: string) => {
      // we call the `immerWithPatches` middleware
      set(
        (changes, values) => {
          if (changes.length === 0) {
            return values
          }
          if (type !== HistoryEventType.REGISTER) {
            // if namespace is not given, calculate what namespaces are affected
            const affectedNamespaces = ns
              ? [ns]
              : changes.reduce((next, change) => {
                  const {
                    path: [, namespace]
                  } = change
                  if (next.indexOf(namespace) !== -1) {
                    return [...next, namespace]
                  }
                  return next
                }, [])

            const uniqueQueries = affectedNamespaces.reduce((next, thisNs) => {
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
                if (thisNs === ns) {
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

            return {
              ...values,
              namespaces: {
                ...values.namespaces,
                ...affectedNamespaces.reduce((next, thisNs) => {
                  return {
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
        fn,
        ns
      )

      // H
    },
    get,
    api
  )

const namespaceProducer = (fn, ns?: string) => state => {
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
  state.namespaces[ns] = next
}

export const immerWithPatches = config => (set, get, api) =>
  config(
    (valueMapper, fn, ns?: string) => {
      set(currentState => {
        const [nextValues, changes] = produceWithPatches(
          namespaceProducer(fn, ns)
        )(currentState)
        return valueMapper(changes, nextValues)
      })
    },
    get,
    api
  )

export const converter = (historyInstance: History) => (set, get) => {
  const initialQueries = parse(historyInstance.location.search)
  const unregisterListener = historyInstance.listen((location, action) => {
    // don't handle our own actions
    if (
      action === 'PUSH' ||
      (action === 'REPLACE' && location.state && location.state.__g__)
    ) {
      return
    }
    const nextQueries = parse(location.search)
    const namespaces = get().namespaces
    Object.keys(namespaces).forEach(ns => {
      set(
        state => {
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
  })
  return {
    /** batch pushes the given namespaces */
    batchPushState: (ns: readonly string[], fn) => {
      set(
        state => fn(...ns.map(thisNs => state[thisNs].values)),
        HistoryEventType.PUSH
      )
    },
    /** batch replaces the given namespaces */
    batchReplaceState: (ns: readonly string[], fn) => {
      set(
        state => fn(...ns.map(thisNs => state[thisNs].values)),
        HistoryEventType.REPLACE
      )
    },
    /** here we store all data and configurations for the different namespaces */
    namespaces: {},
    /** pushes a new state for a given namespace, (will use history.pushState) */
    pushState: (ns: string, fn) =>
      set(state => fn(state.values), HistoryEventType.PUSH, ns),
    /** registers a new namespace and initializes it's configuration */
    register: (
      config: Config,
      mappedConfig: MappedConfig,
      ns: string,
      initialValues?: object
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
        return
      }
      // read initial query state:
      set(
        state => {
          state.subscribers = 1
          state.unsubscribe = () => {
            set(thisState => {
              thisState[ns].subscribers = thisState[ns].subscribers - 1
              if (thisState[ns].subscribers === 0) {
                // tslint:disable-next-line:no-delete
                delete thisState[ns]
              }
            }, HistoryEventType.REGISTER)
          }
          state.mappedConfig = mappedConfig
          state.config = config
          state.initialValues = initialValues || {}
          state.values = { ...initialValues }
          state.query = applyFlatConfigToState(
            mappedConfig,
            initialQueries,
            ns,
            state.values,
            state.initialValues
          )
        },
        HistoryEventType.REGISTER,
        ns
      )
    },
    replaceState: (ns: string, fn) =>
      set(state => fn(state.values), HistoryEventType.REPLACE, ns),
    resetPush: (ns: string) =>
      set(
        state => void (state.values = state.initialValues),
        HistoryEventType.PUSH,
        ns
      ),
    resetReplace: (ns: string) =>
      set(
        state => void (state.values = state.initialValues),
        HistoryEventType.REPLACE,
        ns
      ),
    unregister: () => {
      set(() => {
        // return a new object for namespaces
        return {}
      }, HistoryEventType.REGISTER)

      // unregister history event listener
      unregisterListener()
    }
  }
}
