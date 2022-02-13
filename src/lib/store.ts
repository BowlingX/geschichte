/* tslint:disable:no-expression-statement readonly-array no-shadowed-variable */
import produce, { Draft, enablePatches } from 'immer'
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
import create, {
  GetState,
  Mutate,
  SetState,
  State,
  StateCreator,
  StoreApi,
  UseBoundStore
} from 'zustand'
// tslint:disable-next-line:no-submodule-imports
import { subscribeWithSelector } from 'zustand/middleware'

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

enablePatches()

export const DEFAULT_NAMESPACE = 'default'
export const StoreContext = createContext<UseBoundStore<
  StoreState<any>
> | null>(null)

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

export type RouterOptions = Record<string, any>

export interface HistoryManagement {
  /** the initial search string (e.g. ?query=test), contains the questionsmark */
  readonly initialSearch: () => string
  readonly push: (next: string, options?: RouterOptions) => void
  readonly replace: (next: string, options?: RouterOptions) => void
}

export const useGeschichte = <T extends State>(
  historyInstance: HistoryManagement
) => {
  const thisStore = converter<T>(historyInstance)
  const storeWithHistory = historyManagement<T>(historyInstance)(thisStore)

  const middleware = (immerWithPatches<T>(
    storeWithHistory
  ) as unknown) as StateCreator<StoreState<T>>

  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    // tslint:disable-next-line:no-submodule-imports
    const { devtools } = require('zustand/middleware')
    return create<
      StoreState<T>,
      SetState<StoreState<T>>,
      GetState<StoreState<T>>,
      StoreApi<StoreState<T>>
    >(subscribeWithSelector(devtools(middleware, { name: 'geschichte' })))
  }
  return create<
    StoreState<T>,
    SetState<StoreState<T>>,
    GetState<StoreState<T>>,
    StoreApi<StoreState<T>>
  >(subscribeWithSelector(middleware))
}

type InitialValuesProvider<T> = T | (() => T)

export const useStore = <T>() => {
  return useContext(StoreContext) as UseBoundStore<StoreState<T>>
}

export const useBatchQuery = <T extends State>() => {
  const store = useStore<T>()
  return store(
    ({ batchPushState, batchReplaceState }) => ({
      batchPushState,
      batchReplaceState
    }),
    shallow
  )
}

export const factoryParameters = <T>(
  config: Config,
  // tslint:disable-next-line:no-object-literal-type-assertion
  defaultInitialValues: InitialValuesProvider<T> = {} as T,
  ns: string = DEFAULT_NAMESPACE
) => {
  const flatConfig = flattenConfig(config)
  const createInitialValues = (d: InitialValuesProvider<T>) =>
    typeof d === 'function' ? (d as () => T)() : d

  const initBlank = (initialQueries: object, initialValues: T) => {
    // thisValues will be mutated by applyFlatConfigToState, that's why we init it with a copy of
    // the initial state.
    // tslint:disable-next-line:no-let
    let thisQuery = {}
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
  const memCreateInitialValues = memoizeOne(createInitialValues)

  const useQuery = () => {
    const useStore = useContext(StoreContext) as UseBoundStore<
      StoreState<T>,
      Mutate<
        StoreApi<StoreState<T>>,
        [['zustand/subscribeWithSelector', never]]
      >
    >

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
      const namespaceData = useStore.getState().namespaces[ns] || {}
      const initialValues = memCreateInitialValues(defaultInitialValues)
      const { values, query } = namespaceData
      if (values) {
        return {
          initialValues,
          query,
          values
        }
      }
      return memInitBlank(initialQueries(), initialValues)
    }, [useStore, defaultInitialValues])

    const [currentState, setCurrentState] = useState({
      initialValues: initialRegisterState.initialValues,
      values: initialRegisterState.values
    })

    useEffect(() => {
      const { unsubscribe: unregister, values, initialValues } = register(
        config,
        flatConfig,
        ns,
        initialRegisterState.initialValues,
        initialRegisterState.query,
        initialRegisterState.values
      )
      if (
        initialRegisterState.values !== values ||
        initialRegisterState.initialValues !== initialValues
      ) {
        setCurrentState({ values, initialValues })
      }
      const unsubscribe = useStore.subscribe(
        state =>
          state.namespaces[ns] && {
            initialValues: state.namespaces[ns].initialValues,
            values: state.namespaces[ns].values
          },
        state => {
          if (state) {
            setCurrentState(state)
          }
        },
        { equalityFn: shallow }
      )

      return () => {
        unsubscribe()
        unregister()
      }
    }, [initialRegisterState])

    const values = currentState.values
    const initialValues = currentState.initialValues

    const createQuery = useCallback(
      (values: Partial<T>) => {
        return createQueryObject(flatConfig, ns, values, initialValues)
      },
      [initialValues]
    )

    return useMemo(
      () => ({
        createQuery: (customValues?: Partial<T>) =>
          createQuery(customValues || values),
        createQueryString: (customValues?: Partial<T>) =>
          stringify(createQuery(customValues || values)),
        initialValues,
        pushState: (state: (state: T) => void, options?: Record<string, any>) =>
          pushState(ns, state, options),
        replaceState: (
          state: (state: T) => void,
          options?: Record<string, any>
        ) => replaceState(ns, state, options),
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

  const createQueryString = (
    values: Partial<T>,
    initialValues?: Partial<T> | null
  ): string => {
    const thisInitialValues =
      typeof initialValues === 'undefined'
        ? memCreateInitialValues(defaultInitialValues)
        : initialValues
    return stringify(
      createQueryObject<T>(flatConfig, ns, values, thisInitialValues)
    )
  }

  return { useQuery, createQueryString }
}
