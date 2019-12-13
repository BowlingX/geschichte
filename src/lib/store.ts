/* tslint:disable:no-expression-statement readonly-array no-shadowed-variable */
import { History } from 'history'
import LocationState = History.LocationState
import produce, { Draft } from 'immer'
import memoizeOne from 'memoize-one'
import { stringify } from 'query-string'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import { create, StateCreator, StoreApi, UseStore } from 'zustand'
// tslint:disable-next-line:no-submodule-imports
import shallow from 'zustand/shallow'
import {
  converter,
  historyManagement,
  immerWithPatches,
  StoreState
} from './middleware'
import { Serializer } from './serializers'
import {
  applyFlatConfigToState,
  createQueryObject,
  flattenConfig
} from './utils'

export const DEFAULT_NAMESPACE = 'default'

export const StoreContext = createContext<
  [UseStore<StoreState<any>>, StoreApi<StoreState<any>>] | null
>(null)

export interface Parameter {
  readonly name: string
  readonly serializer: Serializer
}

export interface MappedParameter extends Parameter {
  readonly path: readonly string[]
}

export interface Config {
  readonly [propName: string]: Config | (() => Parameter)
}

export interface MappedConfig {
  readonly [queryParameter: string]: MappedParameter
}

export const geschichte = <T = object>(
  historyInstance: History<LocationState>
) => {
  const thisStore = converter<T>(historyInstance)
  const storeWithHistory = historyManagement<T>(historyInstance)(thisStore)

  const middleware = (immerWithPatches<T>(
    storeWithHistory
  ) as unknown) as StateCreator<StoreState<T>>
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    // tslint:disable-next-line:no-submodule-imports
    const { devtools } = require('zustand/middleware')
    return create(devtools(middleware, 'geschichte'))
  }
  return create(middleware)
}

type InitialValuesProvider<T = object> = T | (() => T)

export const factoryParameters = <T = {}>(
  config: Config,
  // tslint:disable-next-line:no-object-literal-type-assertion
  defaultInitialValues: InitialValuesProvider<T> = {} as T,
  ns: string = DEFAULT_NAMESPACE
) => {
  const flatConfig = flattenConfig(config)

  const initBlank = (initialQueries: object) => {
    // thisValues will be mutated by applyFlatConfigToState, that's why we init it with a copy of
    // the initial state.
    // tslint:disable-next-line:no-let
    let thisQuery = {}
    const initialValues =
      (typeof defaultInitialValues === 'function')
        ? (defaultInitialValues as () => T)()
        : defaultInitialValues
    // We produce a new state here instead of mutating defaultInitialValues.
    // Otherwise it's possible that it get's reused across executions and that will yield to readonly errors.
    const values = produce(initialValues, (draft: Draft<T>) => {
      thisQuery = applyFlatConfigToState(
        flatConfig,
        initialQueries,
        ns,
        draft as T,
        initialValues as T
      )
    })
    return {
      initialValues,
      query: thisQuery,
      values
    }
  }

  const memInitBlank = memoizeOne(initBlank)

  const useQuery = () => {
    const [useStore, api] = useContext(StoreContext) as [
      UseStore<StoreState<T>>,
      StoreApi<StoreState<T>>
    ]

    const {
      register,
      pushState,
      replaceState,
      resetPush,
      resetReplace,
      initialQueries
    } = useStore(
      ({
        register,
        pushState,
        replaceState,
        resetPush,
        resetReplace,
        initialQueries
      }) => ({
        initialQueries,
        pushState,
        register,
        replaceState,
        resetPush,
        resetReplace
      }),
      shallow
    )

    const initialRegisterState = useMemo(() => {
      const namespaceData = api.getState().namespaces[ns] || {}
      const { values, query, initialValues } = namespaceData
      if (values) {
        return {
          initialValues,
          query,
          values
        }
      }
      return memInitBlank(initialQueries)
    }, [api])

    const [currentState, setCurrentState] = useState({
      initialValues: initialRegisterState.initialValues,
      values: initialRegisterState.values
    })

    useEffect(() => {
      const unregister = register(
        config,
        flatConfig,
        ns,
        initialRegisterState.initialValues,
        initialRegisterState.query,
        initialRegisterState.values
      )

      const unsubscribe = api.subscribe<{
        readonly values: T
        readonly initialValues: T
      }>(
        state => {
          if (state) {
            setCurrentState(state)
          }
        },
        state =>
          state.namespaces[ns] && {
            initialValues: state.namespaces[ns].initialValues,
            values: state.namespaces[ns].values
          },
        shallow
      )

      return () => {
        unsubscribe()
        unregister()
      }
    }, [])

    const values = currentState.values
    const initialValues = currentState.initialValues

    const createQuery = useCallback(
      (values: T) => {
        return createQueryObject(flatConfig, ns, values, initialValues)
      },
      [initialValues]
    )

    return useMemo(
      () => ({
        createQuery: (customValues?: T) => createQuery(customValues || values),
        createQueryString: (customValues?: T) =>
          stringify(createQuery(customValues || values)),
        initialValues,
        pushState: (state: (state: T) => void) => pushState(ns, state),
        replaceState: (state: (state: T) => void) => replaceState(ns, state),
        resetPush: () => resetPush(ns),
        resetReplace: () => resetReplace(ns),
        values
      }),
      [
        values,
        initialValues,
        pushState,
        replaceState,
        resetPush,
        resetReplace,
        createQuery
      ]
    )
  }

  const createQueryString = (values: T) => {
    const initialValues =
      typeof defaultInitialValues === 'function'
        ? (defaultInitialValues as () => T)()
        : defaultInitialValues
    stringify(createQueryObject<T>(flatConfig, ns, values, initialValues))
  }

  return { useQuery, createQueryString }
}
