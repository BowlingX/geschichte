/* tslint:disable:no-expression-statement readonly-array no-shadowed-variable */
import { Draft, enablePatches, produce } from 'immer'
import memoizeOneImport from 'memoize-one'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { create, Mutate, StateCreator, StoreApi, UseBoundStore } from 'zustand'
// tslint:disable-next-line:no-submodule-imports
import { devtools, subscribeWithSelector } from 'zustand/middleware'

const memoizeOne = memoizeOneImport.default || memoizeOneImport

// tslint:disable-next-line:no-submodule-imports
import { shallow } from 'zustand/shallow'
import {
  converter,
  historyManagement,
  immerWithPatches,
  StoreState,
} from './middleware.js'
import { Serializer } from './serializers.js'
import {
  applyFlatConfigToState,
  createQueryObject,
  flattenConfig,
} from './utils.js'

enablePatches()

export const DEFAULT_NAMESPACE = 'default'
export const StoreContext = createContext<StoreApi<StoreState<any>> | null>(
  null
)

export interface Parameter<V = any> {
  readonly name: string
  readonly serializer: Serializer<V>
  // tslint:disable-next-line:no-mixed-interface
  readonly skipValue: (value?: V, initialValue?: V) => boolean
}

export interface MappedParameter extends Parameter {
  readonly path: readonly string[]
}

export interface Config {
  readonly [propName: string]: this | this[] | (() => Parameter)
}

export interface MappedConfig {
  readonly [queryParameter: string]: MappedParameter
}

export type RouterOptions = Record<string, any>

export interface HistoryManagement {
  /** the initial search string (e.g. ?query=test), contains the questionsmark */
  readonly initialSearch: () => string | URLSearchParams
  readonly push: (
    queryObject: Record<string, string>,
    options?: RouterOptions
  ) => Promise<unknown>
  readonly replace: (
    queryObject: Record<string, string>,
    options?: RouterOptions
  ) => Promise<unknown>
}

export const useGeschichte = <T extends object>(
  historyInstance: HistoryManagement
) => {
  const thisStore = converter<T>(historyInstance)
  const storeWithHistory = historyManagement<T>(historyInstance)(thisStore)

  const middleware = immerWithPatches(
    storeWithHistory
  ) as unknown as StateCreator<StoreState<T>, any>

  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    return create(
      subscribeWithSelector(devtools(middleware, { name: 'geschichte' }))
    )
  }
  return create(subscribeWithSelector(middleware))
}

type InitialValuesProvider<T> = T | (() => T)

const assertContextExists = <T>(value: T | null): T => {
  if (process.env.NODE_ENV !== 'production' && value === null) {
    throw new Error(
      'Cannot find `GeschichteProvider` in React tree context. Please provide outer <GeschichteProvider />.'
    )
  }
  return value as T
}

export const useStore = <T extends object>() => {
  return assertContextExists(
    useContext(StoreContext) as UseBoundStore<StoreApi<StoreState<T>>>
  )
}

export const useBatchQuery = <T extends object>() => {
  const store = useStore<T>()
  return store(
    ({ batchPushState, batchReplaceState }) => ({
      batchPushState,
      batchReplaceState,
    }),
    shallow
  )
}

export const factoryParameters = <T extends object>(
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
      values,
    }
  }

  const memInitBlank = memoizeOne(initBlank)
  const memCreateInitialValues = memoizeOne(createInitialValues)

  const useQuery = () => {
    const useStore = assertContextExists(
      useContext(StoreContext) as UseBoundStore<
        Mutate<
          StoreApi<StoreState<T>>,
          [['zustand/subscribeWithSelector', never]]
        >
      >
    )

    const {
      register,
      pushState,
      replaceState,
      resetPush,
      resetReplace,
      initialQueries,
    } = useStore(
      ({
        register,
        pushState,
        replaceState,
        resetPush,
        resetReplace,
        initialQueries,
      }) => ({
        initialQueries,
        pushState,
        register,
        replaceState,
        resetPush,
        resetReplace,
      }),
      shallow
    )
    const initialRegisterState = useMemo(() => {
      const initialValues = memCreateInitialValues(defaultInitialValues)
      return memInitBlank(initialQueries(), initialValues)
    }, [useStore, defaultInitialValues])

    const [currentState, setCurrentState] = useState({
      initialValues: initialRegisterState.initialValues,
      values: initialRegisterState.values,
    })

    useEffect(() => {
      const {
        unsubscribe: unregister,
        values,
        initialValues,
      } = register(
        config,
        flatConfig,
        ns,
        initialRegisterState.initialValues,
        initialRegisterState.query,
        initialRegisterState.values
      )
      if (
        initialRegisterState.values !== values ||
        initialRegisterState.initialValues !== initialValues ||
        currentState.initialValues !== initialValues ||
        currentState.values !== values
      ) {
        setCurrentState({ values, initialValues })
      }
      const unsubscribe = useStore.subscribe(
        (state) =>
          state.namespaces[ns] && {
            initialValues: state.namespaces[ns].initialValues,
            values: state.namespaces[ns].values,
          },
        (state) => {
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
          new URLSearchParams(createQuery(customValues || values)).toString(),
        initialValues,
        pushState: (state: (state: T) => void, options?: Record<string, any>) =>
          pushState(ns, state, options),
        replaceState: (
          state: (state: T) => void,
          options?: Record<string, any>
        ) => replaceState(ns, state, options),
        resetPush: () => resetPush(ns),
        resetReplace: () => resetReplace(ns),
        values,
      }),
      [
        values,
        initialValues,
        pushState,
        replaceState,
        resetPush,
        resetReplace,
        createQuery,
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
    return new URLSearchParams(
      createQueryObject<T>(flatConfig, ns, values, thisInitialValues)
    ).toString()
  }

  const parseQueryString = (
    query: string,
    initialValues?: Partial<T> | null
  ): Partial<T> => {
    const thisInitialValues =
      typeof initialValues === 'undefined'
        ? memCreateInitialValues(defaultInitialValues)
        : initialValues
    return produce({}, (draft: Draft<T>) => {
      const parsedQuery = new URLSearchParams(query)
      applyFlatConfigToState(
        flatConfig,
        Object.fromEntries(parsedQuery.entries()),
        ns,
        draft as T,
        thisInitialValues as T
      )
    })
  }

  return { useQuery, createQueryString, parseQueryString }
}
