export interface Serializer {
  readonly deserialize: (value: string) => any
  readonly serialize: (value?: any) => string | null
}

const join = (value: readonly any[], separator: string) => value.join(separator)

const split = (value: string, separator: string) => value.split(separator)

const intSerializer: Serializer = {
  deserialize: (value: string): number | null => parseInt(value, 10) || null,
  serialize: (value?: number): string => String(value)
}

const floatSerializer: Serializer = {
  deserialize: (value: string): number | null => parseFloat(value) || null,
  serialize: (value?: number): string => String(value)
}

const stringSerializer: Serializer = {
  deserialize: (value: string): string => String(value),
  serialize: (value?: string): string => String(value)
}

export const arrayStringSerializer: (separator: string) => Serializer = (
  separator: string
) => ({
  deserialize: (value: string): readonly string[] | null =>
    split(value, separator),
  serialize: (value?: readonly string[]): string | null =>
    (value && join(value, separator)) || null
})

export const arrayIntSerializer: (separator: string) => Serializer = (
  separator: string
) => ({
  deserialize: (value: string): readonly number[] | null =>
    split(value, separator).map(intSerializer.deserialize),
  serialize: (value?: readonly number[]): string | null =>
    (value && join(value, separator)) || null
})

export const arrayFloatSerializer: (separator: string) => Serializer = (
  separator: string
) => ({
  deserialize: (value: string): readonly number[] | null =>
    split(value, separator).map(floatSerializer.deserialize),
  serialize: (value?: readonly number[]): string | null =>
    (value && join(value, separator)) || null
})

const dateSerializer = (
  locale: string = 'en-us',
  timeZone: string = 'UTC'
): Serializer => ({
  deserialize: (value: string): Date => new Date(value),
  serialize: (value: Date): string =>
    value.toLocaleDateString(locale, { timeZone })
})

const booleanSerializer: Serializer = {
  deserialize: (value: string): boolean => value === '1',
  serialize: (value?: boolean): string => (value ? '1' : '0')
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
  string: stringSerializer
}
