import { Context } from './store.js'

export interface Serializer<V, C extends Context = Context> {
  readonly deserialize: (
    value: string | null,
    context?: C
  ) => V | undefined | null
  readonly serialize: (value?: V, context?: C) => string | undefined | null
}

const join = (value: readonly unknown[], separator: string) =>
  value.join(separator)

const split = (value: string | null, separator: string) =>
  value?.split(separator).filter((str) => str.trim() !== '') || []

const intSerializer: Serializer<number> = {
  deserialize: (value: string | null): number | null => {
    if (value === null) {
      return value
    }
    const num = parseInt(value, 10)
    return Number.isNaN(num) ? null : num
  },
  serialize: (value?: number): string => String(value),
}

const floatSerializer: Serializer<number> = {
  deserialize: (value: string | null): number | null => {
    if (value === null) {
      return value
    }
    const num = parseFloat(value)
    return Number.isNaN(num) ? null : num
  },
  serialize: (value?: number): string => String(value),
}

const stringSerializer: Serializer<string> = {
  deserialize: (value: string | null): string | null =>
    value === null ? null : String(value),
  serialize: (value?: string): string => String(value),
}

export const arrayStringSerializer: <C extends Context = Context>(
  separator: string
) => Serializer<readonly string[], C> = (separator: string) => ({
  deserialize: (value, context) =>
    split(value, context?.serializerConfig?.arrayStringSeparator || separator),
  serialize: (value, context) =>
    value
      ? join(
          value,
          context?.serializerConfig?.arrayStringSeparator || separator
        )
      : null,
})

export const arrayIntSerializer: (
  separator: string
) => Serializer<readonly number[]> = (separator: string) => ({
  deserialize: (value: string | null, context): readonly number[] | null =>
    split(value, separator).map((v) =>
      intSerializer.deserialize(v, context)
    ) as readonly number[],
  serialize: (value?: readonly number[]): string | null =>
    value ? join(value, separator) : null,
})

export const arrayFloatSerializer: (
  separator: string
) => Serializer<readonly number[]> = (separator: string) => ({
  deserialize: (value: string | null, context): readonly number[] | null =>
    split(value, separator).map((v) =>
      floatSerializer.deserialize(v, context)
    ) as readonly number[],
  serialize: (value?: readonly number[]): string | null =>
    value ? join(value, separator) : null,
})

const dateSerializer = (
  locale: string = 'en-us',
  timeZone: string = 'UTC'
): Serializer<Date> => ({
  deserialize: (value: string | null): Date =>
    value ? new Date(value) : new Date(),
  serialize: (value?: Date): string | undefined =>
    value?.toLocaleDateString(locale, { timeZone }),
})

const booleanSerializer: Serializer<boolean> = {
  deserialize: (value: string | null): boolean => value === '1',
  serialize: (value?: boolean): string => (value ? '1' : '0'),
}

export const DEFAULT_SEPARATOR = '_'

export const serializers = {
  arrayFloat: arrayFloatSerializer(DEFAULT_SEPARATOR),
  arrayInt: arrayIntSerializer(DEFAULT_SEPARATOR),
  arrayString: arrayStringSerializer(DEFAULT_SEPARATOR),
  boolean: booleanSerializer,
  date: dateSerializer,
  float: floatSerializer,
  int: intSerializer,
  string: stringSerializer,
}
