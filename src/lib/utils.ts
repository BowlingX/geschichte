/* tslint:disable:no-expression-statement no-let no-submodule-imports no-object-mutation */
import { Patch } from 'immer'
import { shallow } from 'zustand/shallow'
import { GenericObject } from './middleware.js'
import { Serializer } from './serializers.js'
import {
  Config,
  Context,
  DEFAULT_NAMESPACE,
  MappedConfig,
  Parameter,
} from './store.js'
import type { PartialDeep } from 'type-fest'

export const createSearch = (query: Record<string, string>) => {
  const queryString = new URLSearchParams(query).toString()
  return queryString === '' ? '' : `?${queryString}`
}

/**
 * Default skip implementation
 */
export function defaultSkipValue<V>(value?: V, initialValue?: V): boolean {
  return (
    value === undefined ||
    value === null ||
    shallow(value, initialValue) ||
    (Array.isArray(value) && value.length === 0)
  )
}

export function pm<V>(
  name: string,
  serializer: Serializer<V>,
  thisSkipValue: (value?: V, initialValue?: V) => boolean = defaultSkipValue
): () => Parameter<V> {
  return (): Parameter<V> => ({
    name,
    serializer,
    skipValue: thisSkipValue,
  })
}

export const createOrApplyPath = <T>(
  obj: GenericObject | null,
  path: readonly string[],
  value: T | null = null
) => {
  let current = obj || {}
  let thisPath: ReadonlyArray<string> = [...path]
  while (thisPath.length > 1) {
    const [head, ...tail] = thisPath
    thisPath = tail
    if (current && current[head] === undefined) {
      current[head] = {}
    }
    current = current?.[head]
  }
  if (current) {
    current[thisPath[0]] = value
  }
  return obj
}

export const formatNamespace = (key: string, ns?: string) => {
  return ns && ns !== DEFAULT_NAMESPACE ? `${ns}.${key}` : key
}

export const get = <T extends Record<string, unknown>>(
  object: T | null | undefined,
  path: ReadonlyArray<string | number>
) => {
  return path.reduce((next: unknown, key) => {
    return next ? (next as T)[key] : undefined
  }, object)
}

/**
 * @return a list of patches that deeply match the given config object
 */
const findDeepPatches = (
  config: Config,
  basePath: readonly string[]
): readonly Patch[] => {
  return Object.keys(config).reduce((next, item: string) => {
    if (typeof config[item] === 'function') {
      return [...next, { path: [...basePath, item], op: 'replace' }]
    }
    return [
      ...next,
      ...findDeepPatches(config[item] as Config, [...basePath, item]),
    ]
  }, [] as Patch[])
}

/**
 * @return an object with the keys that have been processed
 * if a key has been removed / set to undefined, we still return it to
 * be able to create a diff to the current state
 */
export const createQueriesFromPatch = <
  T extends Record<string, unknown>,
  C extends Context
>(
  config: Config,
  ns: string,
  patch: readonly Patch[],
  state: T,
  initialState: T,
  context?: C
): object => {
  return patch.reduce((next, item) => {
    const { path } = item
    // namespaces, [ns], values|initialValues, ...rest
    const [, patchNamespace, , ...objectPath] = path
    // skip patches that don't belong to the given namespace
    if (patchNamespace !== ns) {
      return next
    }
    const possibleParameter = get(config, objectPath)
    const isNotCallable = typeof possibleParameter !== 'function'

    if (possibleParameter !== undefined && isNotCallable) {
      // If we have an object as result, we create patches for each parameter inside the subtree
      const patches = findDeepPatches(
        possibleParameter as Config,
        path as readonly string[]
      )
      return {
        ...next,
        ...createQueriesFromPatch<T, C>(
          config,
          ns,
          patches,
          state,
          initialState,
          context
        ),
      }
    }

    if (isNotCallable) {
      return next
    }

    const { name, serializer, skipValue } = possibleParameter() as Parameter
    const value = get(state, objectPath) as Record<string, unknown> | undefined
    const initialValue = get(initialState, objectPath) as
      | Record<string, unknown>
      | undefined

    const nextValue = skipValue(value, initialValue) ? undefined : value

    return {
      ...next,
      [formatNamespace(name, ns)]:
        nextValue === undefined
          ? nextValue
          : serializer.serialize(nextValue, context),
    }
  }, {})
}

/**
 * Creates a queryObject that can be serialized.
 */
export const createQueryObject = <
  T extends Record<string, unknown>,
  C extends Context
>(
  config: MappedConfig,
  ns: string,
  values: Partial<T> | PartialDeep<T>,
  initialState?: Partial<T> | PartialDeep<T> | null,
  context?: C
) => {
  return Object.keys(config).reduce((next, parameter) => {
    const { path, serializer, skipValue } = config[parameter]
    const possibleValue = get(values, path) as Record<string, unknown>
    const nextValue = skipValue(
      possibleValue,
      get(initialState, path) as Record<string, unknown>
    )
      ? undefined
      : possibleValue
    if (nextValue === undefined) {
      return next
    }
    return {
      ...next,
      [formatNamespace(parameter, ns)]: serializer.serialize(
        nextValue,
        context
      ),
    }
  }, {})
}

export const applyDiffWithCreateQueriesFromPatch = <
  T extends Record<string, unknown>,
  C extends Context
>(
  config: Config,
  ns: string,
  currentQuery: object,
  patch: readonly Patch[],
  state: T,
  initialState: T,
  context?: C
) => {
  const query = createQueriesFromPatch(
    config,
    ns,
    patch,
    state,
    initialState,
    context
  )
  const nextQueries: GenericObject = {
    ...currentQuery,
    ...query,
  }

  return Object.keys(nextQueries)
    .filter((key) => nextQueries[key] !== undefined)
    .reduce((next, key) => {
      return {
        ...next,
        [key]: nextQueries[key],
      }
    }, {})
}

/**
 * Applies the given queryValues to the current state, based on the configuration
 * Important: Mutates `state`.
 * @return an object with the keys that have been processed
 */
export const applyFlatConfigToState = <
  T extends Record<string, unknown>,
  C extends Context
>(
  config: MappedConfig,
  queryValues: Record<string, string>,
  ns: string,
  state: T,
  initialState: T,
  apply = true,
  context?: C
) => {
  return Object.keys(config).reduce((next, queryParameter) => {
    const { path, serializer, skipValue } = config[queryParameter]
    const nsQueryParameter = formatNamespace(queryParameter, ns)
    const maybeValue = queryValues[nsQueryParameter]

    const value =
      maybeValue === undefined
        ? get(initialState, path)
        : serializer.deserialize(maybeValue, context)

    if (apply) {
      createOrApplyPath(state, path, value)
    }

    if (
      skipValue(
        value as Record<string, unknown>,
        get(initialState, path) as Record<string, unknown>
      )
    ) {
      return next
    }

    if (typeof maybeValue === 'undefined') {
      return next
    }

    return {
      ...next,
      [nsQueryParameter]: maybeValue,
    }
  }, {})
}

/**
 * Creates a flat serializable object based on a mapping Object
 * that can be used to generate a query string.
 * @return a key/value object with the object containing the defined parameters as key.
 */
export const flattenConfig = (
  config: Config | readonly Config[],
  path: readonly (string | number)[] = []
): MappedConfig => {
  return Object.keys(config).reduce((next, key: string | number) => {
    const v = Array.isArray(config)
      ? config[key as number]
      : (config as Config)[key as string]
    const nextPath: ReadonlyArray<string | number> = [...path, key]
    if (typeof v === 'function') {
      const { name, ...rest } = v()
      if (next[name] !== undefined) {
        throw new Error(
          `Config invalid: Multiple definitions found for ${name}.`
        )
      }
      return {
        ...next,
        [name]: {
          path: nextPath,
          ...rest,
        },
      }
    }
    if (typeof v === 'object') {
      return {
        ...next,
        ...flattenConfig(v, nextPath),
      }
    }
    return next
  }, {} as MappedConfig)
}
