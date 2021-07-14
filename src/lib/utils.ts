/* tslint:disable:no-expression-statement no-let no-submodule-imports no-object-mutation */
import { Patch } from 'immer'
import shallowEqual from 'zustand/shallow'
import { GenericObject } from './middleware'
import { Serializer } from './serializers'
import { Config, DEFAULT_NAMESPACE, MappedConfig, Parameter } from './store'

export const pm = (name: string, serializer: Serializer) => (): Parameter => ({
  name,
  serializer
})

export const createOrApplyPath = (
  obj: GenericObject | null,
  path: readonly string[],
  value: any = null
) => {
  let current = obj || {}
  let thisPath: ReadonlyArray<string> = [...path]
  while (thisPath.length > 1) {
    const [head, ...tail] = thisPath
    thisPath = tail
    if (current[head] === undefined) {
      current[head] = {}
    }
    current = current[head]
  }
  current[thisPath[0]] = value
  return obj
}

export const formatNamespace = (key: string, ns?: string) => {
  return ns && ns !== DEFAULT_NAMESPACE ? `${ns}.${key}` : key
}

export const get = <T = object>(
  object: T,
  path: ReadonlyArray<string | number>
) => {
  return path.reduce((next: T | any, key: string | number) => {
    return next ? next[key] : undefined
  }, object)
}

/**
 * Default skip implementation
 */
export const skipValue = (value?: any, initialValue?: any) =>
  value === undefined ||
  value === null ||
  shallowEqual(value, initialValue) ||
  (Array.isArray(value) && value.length === 0)

/**
 * @return a list of patches that deeply match the given config object
 */
const findDeepPatches = (
  config: Config,
  basePath: readonly string[]
): readonly Patch[] => {
  return Object.keys(config).reduce((next: readonly any[], item: string) => {
    if (typeof config[item] === 'function') {
      return [...next, { path: [...basePath, item], op: 'replace' }]
    }
    return [
      ...next,
      ...findDeepPatches(config[item] as Config, [...basePath, item])
    ]
  }, [])
}

/**
 * @return an object with the keys that have been processed
 * if a key has been removed / set to undefined, we still return it to
 * be able to create a diff to the current state
 */
export const createQueriesFromPatch = <T = object>(
  config: Config,
  ns: string,
  patch: readonly Patch[],
  state: T,
  initialState: T
): object => {
  return patch.reduce((next, item) => {
    const { path, op } = item
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
        possibleParameter,
        path as readonly string[]
      )
      return {
        ...next,
        ...createQueriesFromPatch<T>(config, ns, patches, state, initialState)
      }
    }

    if (isNotCallable) {
      return next
    }

    const { name, serializer, skip } = possibleParameter()
    // @ts-ignore
    const value = get(state, objectPath)
    // @ts-ignore
    const initialValue = get(initialState, objectPath)

    const nextValue = skipValue(value, initialValue) ? undefined : value

    return {
      ...next,
      [formatNamespace(name, ns)]:
        nextValue === undefined ? nextValue : serializer.serialize(nextValue)
    }
  }, {})
}

/**
 * Creates a queryObject that can be serialized.
 */
export const createQueryObject = <T = object>(
  config: MappedConfig,
  ns: string,
  values: Partial<T>,
  initialState?: Partial<T> | null
) => {
  return Object.keys(config).reduce((next, parameter) => {
    const { path, serializer } = config[parameter]
    const possibleValue = get(values, path)
    const nextValue = skipValue(possibleValue, get(initialState, path))
      ? undefined
      : possibleValue
    if (nextValue === undefined) {
      return next
    }
    return {
      ...next,
      [formatNamespace(parameter, ns)]: serializer.serialize(nextValue)
    }
  }, {})
}

export const applyDiffWithCreateQueriesFromPatch = <T = object>(
  config: Config,
  ns: string,
  currentQuery: object,
  patch: readonly Patch[],
  state: T,
  initialState: T
) => {
  const query = createQueriesFromPatch(config, ns, patch, state, initialState)
  const nextQueries: GenericObject = {
    ...currentQuery,
    ...query
  }

  return Object.keys(nextQueries)
    .filter(key => nextQueries[key] !== undefined)
    .reduce((next, key) => {
      return {
        ...next,
        [key]: nextQueries[key]
      }
    }, {})
}

/**
 * Applies the given queryValues to the current state, based on the configuration
 * Important: Mutates `state`.
 * @return an object with the keys that have been processed
 */
export const applyFlatConfigToState = <T = object>(
  config: MappedConfig,
  queryValues: { readonly [index: string]: any },
  ns: string,
  state: T,
  initialState: T
) => {
  return Object.keys(config).reduce((next, queryParameter) => {
    const { path, serializer } = config[queryParameter]
    const nsQueryParameter = formatNamespace(queryParameter, ns)
    const maybeValue = queryValues[nsQueryParameter]

    const value =
      maybeValue === undefined
        ? get(initialState, path)
        : serializer.deserialize(maybeValue)
    createOrApplyPath(state, path, value)

    if (skipValue(value, get(initialState, path))) {
      return next
    }

    return {
      ...next,
      [nsQueryParameter]: maybeValue
    }
  }, {})
}

/**
 * Creates a flat serializable object based on a mapping Object
 * that can be used to generate a query string.
 * @return a key/value object with the object containing the defined parameters as key.
 */
export const flattenConfig = (
  config: Config,
  path: readonly string[] = []
): MappedConfig => {
  return Object.keys(config).reduce(
    (next: { readonly [index: string]: any }, key) => {
      const v = config[key]
      const nextPath: ReadonlyArray<string> = [...path, key]
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
            ...rest
          }
        }
      }
      if (typeof v === 'object') {
        return {
          ...next,
          ...flattenConfig(v, nextPath)
        }
      }
      return next
    },
    {}
  )
}
