/* tslint:disable:no-expression-statement readonly-array */
import { History } from 'history'
import LocationState = History.LocationState

import { stringify } from 'query-string'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import create, { StoreApi, UseStore } from 'zustand'
// tslint:disable-next-line:no-submodule-imports
import shallow from 'zustand/shallow'
import {
  converter,
  historyManagement,
  immerWithPatches,
  StoreState
} from './middleware'
import { Serializer } from './serializers'
import { createQueryObject, flattenConfig } from './utils'

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

export const geschichte = (historyInstance: History<LocationState>) => {
  return create(
    immerWithPatches(
      historyManagement(historyInstance)(converter(historyInstance))
    )
  )
}

export const factoryParameters = <T = object>(
  config: Config,
  // tslint:disable-next-line:no-object-literal-type-assertion
  initialValues: T = {} as T,
  ns: string = DEFAULT_NAMESPACE
) => {
  const flatConfig = flattenConfig(config)
  const useQuery = () => {
    const [useStore, api] = useContext(StoreContext) as [
      UseStore<StoreState<T>>,
      StoreApi<StoreState<T>>
    ]

    const callback = useCallback(
      // tslint:disable-next-line:no-shadowed-variable
      ({ register, pushState, replaceState }) => ({
        pushState,
        register,
        replaceState
      }),
      [useStore]
    )
    const { register, pushState, replaceState } = useStore(callback)

    useMemo(() => {
      register(config, flatConfig, ns, initialValues)
    }, [])

    const initialNamespaceValues = useStore(state => state.namespaces[ns])
    // initial state
    const [innerValues, setInnerValues] = useState(initialNamespaceValues)

    // subscribe to updates
    useEffect(() => {
      const unsubscribe = api.subscribe<{
        readonly values: T
        readonly initialValues: T
      }>(
        state => {
          if (state) {
            setInnerValues({ ...innerValues, ...state })
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
        innerValues.unsubscribe()
      }
    }, [setInnerValues])

    return useMemo(
      () => ({
        createQueryString: (values?: object) =>
          stringify(
            createQueryObject(
              flatConfig,
              ns,
              values || innerValues.values,
              innerValues.initialValues
            )
          ),
        initialValues: innerValues.initialValues,
        pushState: (state: (state: T) => void) => pushState(ns, state),
        replaceState: (state: (state: T) => void) => replaceState(ns, state),
        values: innerValues.values
      }),
      [innerValues, pushState, replaceState]
    )
  }

  const createQueryString = (values: T) =>
    stringify(createQueryObject<T>(flatConfig, ns, values, initialValues))

  return { useQuery, createQueryString }
}
