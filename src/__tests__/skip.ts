/* tslint:disable:no-expression-statement no-object-mutation */

import { factoryParameters } from '../lib/store.js'
import { defaultSkipValue, pm } from '../lib/utils.js'
import { Serializer, serializers } from '../lib/serializers.js'

export const nullableBooleanSerializer: Serializer = {
  deserialize: (value: string | null) => {
    if (value === '1') {
      return true
    }
    return null
  },
  serialize: (value?: boolean) => (value ? '1' : '0'),
}

describe('custom skip', () => {
  const initialValues = { nullable: null }
  const { parseQueryString, createQueryString } = factoryParameters(
    {
      nullable: pm(
        'nullable',
        nullableBooleanSerializer,
        (value, initialValue) =>
          value === null ? false : defaultSkipValue(value, initialValue)
      ),
    },
    initialValues
  )

  it('should parse a query string', () => {
    const result = parseQueryString('?nullable=1')
    expect(result).toEqual({ nullable: true })
  })

  it('should parse null', () => {
    const result = parseQueryString('?nullable=0')
    expect(result).toEqual({ nullable: null })
  })

  it('should create a query string', () => {
    const queryString = createQueryString({ nullable: null })
    expect(queryString).toEqual('nullable=0')
  })
})

describe('Array query string serialization', () => {
  const { parseQueryString, createQueryString } = factoryParameters(
    {
      myArray: pm('myArray', serializers.arrayString),
    },
    {
      myArray: [] as null | readonly string[],
    }
  )
  it('should properly serialize and parse empty values', () => {
    const result = parseQueryString('?myArray')
    expect(result).toEqual({ myArray: [] })
    const queryString = createQueryString({ myArray: [''] })
    expect(queryString).toEqual('myArray=')
    const emptyArray = createQueryString({ myArray: [] })
    expect(emptyArray).toEqual('')
  })
})
