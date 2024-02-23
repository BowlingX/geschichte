import { Draft, enablePatches, produce } from 'immer'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Mutate, StateCreator, StoreApi, UseBoundStore } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { createWithEqualityFn } from 'zustand/traditional'
import isDeepEqual from 'fast-deep-equal'

import { shallow } from 'zustand/shallow'
import {
  converter,
  historyManagement,
  immerWithPatches,
  InnerNamespace,
  NamespaceValues,
  StoreState,
} from './middleware.js'
import { Serializer } from './serializers.js'
import {
  applyFlatConfigToState,
  createQueryObject,
  flattenConfig,
} from './utils.js'
import type { PartialDeep } from 'type-fest'

enablePatches()

export const DEFAULT_NAMESPACE = 'default'
export const StoreContext = createContext<StoreApi<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  StoreState<any, any>
> | null>(null)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Parameter<V = any> {
  readonly name: string
  readonly serializer: Serializer<V>
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

export type RouterOptions = Record<string, unknown>

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

export const createGeschichte = <
  T extends Record<string, unknown>,
  N extends InnerNamespace<T>
>(
  historyInstance: HistoryManagement
) => {
  const thisStore = converter<T, N>(historyInstance)
  const storeWithHistory = historyManagement<T, N>(historyInstance)(thisStore)

  const middleware = immerWithPatches(
    storeWithHistory
  ) as unknown as StateCreator<StoreState<T, N>>

  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    return createWithEqualityFn(
      subscribeWithSelector(devtools(middleware, { name: 'geschichte' })),
      shallow
    )
  }
  return createWithEqualityFn(subscribeWithSelector(middleware), shallow)
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

export const useStore = <
  V extends Record<string, unknown>,
  N extends InnerNamespace<V>
>() => {
  return assertContextExists(
    useContext(StoreContext) as UseBoundStore<StoreApi<StoreState<V, N>>>
  )
}

export const useBatchQuery = <
  N extends InnerNamespace<Record<string, unknown>>
>() => {
  const store = useStore<Record<string, unknown>, N>()
  return store(({ batchPushState, batchReplaceState }) => ({
    batchPushState,
    batchReplaceState,
  }))
}

export const factoryParameters = <
  T extends Record<string, unknown>,
  N extends InnerNamespace<T>
>(
  config: Config,
  defaultInitialValues: InitialValuesProvider<T> = {} as T,
  ns: string = DEFAULT_NAMESPACE
) => {
  const flatConfig = flattenConfig(config)
  const createInitialValues = (d: InitialValuesProvider<T>) =>
    typeof d === 'function' ? (d as () => T)() : d

  const initBlank = (
    initialQueries: Record<string, string>,
    initialValues: T
  ) => {
    // thisValues will be mutated by applyFlatConfigToState, that's why we init it with a copy of
    // the initial state.
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

  const useQuery = () => {
    const useStore = assertContextExists(
      useContext(StoreContext) as UseBoundStore<
        Mutate<
          StoreApi<StoreState<T, N>>,
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
      const initialValues = createInitialValues(defaultInitialValues)
      return initBlank(initialQueries(), initialValues)
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
        !isDeepEqual(initialRegisterState.values, values) ||
        !isDeepEqual(initialRegisterState.initialValues, initialValues) ||
        !isDeepEqual(currentState.initialValues, initialValues) ||
        !isDeepEqual(currentState.values, values)
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
        { equalityFn: isDeepEqual }
      )

      return () => {
        unsubscribe()
        unregister()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialRegisterState])

    const values = currentState.values
    const initialValues = currentState.initialValues

    const createQuery = useCallback(
      (values: Partial<T> | PartialDeep<T>) => {
        return createQueryObject(flatConfig, ns, values, initialValues)
      },
      [initialValues]
    )

    return useMemo(
      () => ({
        createQuery: (customValues?: PartialDeep<T>) =>
          createQuery(customValues || values),
        createQueryString: (customValues?: PartialDeep<T>) =>
          new URLSearchParams(createQuery(customValues || values)).toString(),
        initialValues,
        pushState: (
          state: (state: T) => void,
          options?: Record<string, unknown>
        ) => pushState(ns, state, options),
        replaceState: (
          state: (state: T) => void,
          options?: Record<string, unknown>
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
    values: PartialDeep<T>,
    initialValues?: PartialDeep<T> | null
  ): string => {
    const thisInitialValues =
      typeof initialValues === 'undefined'
        ? createInitialValues(defaultInitialValues)
        : initialValues
    return new URLSearchParams(
      createQueryObject<T>(flatConfig, ns, values, thisInitialValues)
    ).toString()
  }

  const parseQueryString = (
    query: string,
    initialValues?: PartialDeep<T> | null
  ): Partial<T> => {
    const thisInitialValues =
      typeof initialValues === 'undefined'
        ? createInitialValues(defaultInitialValues)
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

export type InferNamespaceValues<
  F extends ReturnType<typeof factoryParameters>['useQuery']
> = NamespaceValues<ReturnType<F>['values']>
