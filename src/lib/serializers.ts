export interface Serializer {
  readonly deserialize: (value?: string) => any
  readonly serialize: (value?: any) => string
}

const numberSerializer: Serializer = {
  deserialize: (value?: string): number => Number(value),
  serialize: (value?: number): string => String(value)
}

const stringSerializer: Serializer = {
  deserialize: (value?: string): string => (value ? String(value) : ''),
  serialize: (value?: string): string => String(value)
}

export const serializers = {
  number: numberSerializer,
  string: stringSerializer
}
