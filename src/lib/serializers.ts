export interface Serializer {
  readonly deserialize: (value: string | null) => any
  readonly serialize: (value?: any) => string | null
}

const join = (value: readonly any[], separator: string) => value.join(separator)

const split = (value: string | null, separator: string) =>
  value?.split(separator) || []

const intSerializer: Serializer = {
  deserialize: (value: string | null): number | null => {
    if (value === null) {
      return value
    }
    const num = parseInt(value, 10)
    return Number.isNaN(num) ? null : num
  },
  serialize: (value?: number): string => String(value),
}

const floatSerializer: Serializer = {
  deserialize: (value: string | null): number | null => {
    if (value === null) {
      return value
    }
    const num = parseFloat(value)
    return Number.isNaN(num) ? null : num
  },
  serialize: (value?: number): string => String(value),
}

const stringSerializer: Serializer = {
  deserialize: (value: string | null): string | null =>
    value === null ? null : String(value),
  serialize: (value?: string): string => String(value),
}

export const arrayStringSerializer: (separator: string) => Serializer = (
  separator: string
) => ({
  deserialize: (value: string | null): readonly string[] | null =>
    split(value, separator),
  serialize: (value?: readonly string[]): string | null =>
    (value && join(value, separator)) || null,
})

export const arrayIntSerializer: (separator: string) => Serializer = (
  separator: string
) => ({
  deserialize: (value: string | null): readonly number[] | null =>
    split(value, separator).map(intSerializer.deserialize),
  serialize: (value?: readonly number[]): string | null =>
    (value && join(value, separator)) || null,
})

export const arrayFloatSerializer: (separator: string) => Serializer = (
  separator: string
) => ({
  deserialize: (value: string | null): readonly number[] | null =>
    split(value, separator).map(floatSerializer.deserialize),
  serialize: (value?: readonly number[]): string | null =>
    (value && join(value, separator)) || null,
})

const dateSerializer = (
  locale: string = 'en-us',
  timeZone: string = 'UTC'
): Serializer => ({
  deserialize: (value: string | null): Date =>
    value ? new Date(value) : new Date(),
  serialize: (value: Date): string =>
    value.toLocaleDateString(locale, { timeZone }),
})

const booleanSerializer: Serializer = {
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
