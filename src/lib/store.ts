/* tslint:disable:no-expression-statement readonly-array no-shadowed-variable */
import { History } from 'history'
import LocationState = History.LocationState

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
  if (process.env.NODE_ENV === 'development') {
    // tslint:disable-next-line:no-submodule-imports
    const { devtools } = require('zustand/middleware')
    return create(devtools(middleware))
  }
  return create(middleware)
}

export const factoryParameters = <T = object>(
  config: Config,
  // tslint:disable-next-line:no-object-literal-type-assertion
  defaultInitialValues: T = {} as T,
  ns: string = DEFAULT_NAMESPACE
) => {
  const flatConfig = flattenConfig(config)

  const initBlank = (initialQueries: object) => {
    // thisValues will be mutated by applyFlatConfigToState, that's why we init it with a copy of
    // the initial state.
    const thisValues = { ...defaultInitialValues }
    const thisQuery = applyFlatConfigToState(
      flatConfig,
      initialQueries,
      ns,
      thisValues,
      defaultInitialValues
    )
    return {
      initialValues: defaultInitialValues,
      query: thisQuery,
      values: thisValues
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
        defaultInitialValues,
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
        state => ({
          initialValues: state.namespaces[ns].initialValues,
          values: state.namespaces[ns].values
        }),
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

  const createQueryString = (values: T) =>
    stringify(
      createQueryObject<T>(flatConfig, ns, values, defaultInitialValues)
    )

  return { useQuery, createQueryString }
}
