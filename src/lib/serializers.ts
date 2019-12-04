export interface Serializer {
  readonly deserialize: (value: string) => any
  readonly serialize: (value?: any) => string | null
}

const join = (value: readonly any[]) => value.join('_')

const split = (value: string) => value.split('_')

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

const arrayStringSerializer: Serializer = {
  deserialize: (value: string): readonly string[] | null => split(value),
  serialize: (value?: readonly string[]): string | null =>
    (value && join(value)) || null
}

const arrayIntSerializer: Serializer = {
  deserialize: (value: string): readonly number[] | null =>
    split(value).map(intSerializer.deserialize),
  serialize: (value?: readonly number[]): string | null =>
    (value && join(value)) || null
}

const arrayFloatSerializer: Serializer = {
  deserialize: (value: string): readonly number[] | null =>
    split(value).map(floatSerializer.deserialize),
  serialize: (value?: readonly number[]): string | null =>
    (value && join(value)) || null
}

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

export const serializers = {
  arrayFloat: arrayFloatSerializer,
  arrayInt: arrayIntSerializer,
  arrayString: arrayStringSerializer,
  boolean: booleanSerializer,
  date: dateSerializer,
  float: floatSerializer,
  int: intSerializer,
  string: stringSerializer
}
