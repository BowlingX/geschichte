import { factoryParameters } from '../lib/store.js'
import { pm } from '../lib/utils.js'
import { serializers } from '../lib/serializers.js'

describe('deep partial createQueryString', () => {
  const initialValues = {
    some: {
      parameter: 'hello',
      otherValue: 'world',
    },
  }
  const { createQueryString } = factoryParameters(
    {
      some: {
        parameter: pm('foo', serializers.string),
        otherValue: pm('bar', serializers.string),
      },
    },
    initialValues
  )

  it('should allow deep partial values', () => {
    expect(createQueryString({ some: { parameter: 'wow' } })).toEqual('foo=wow')
  })
})

describe('static parseQueryString', () => {
  const initialValues = { someParameter: 'test' }
  const { parseQueryString } = factoryParameters(
    {
      someParameter: pm('wow', serializers.string),
    },
    initialValues
  )

  it('should parse a query string', () => {
    const result = parseQueryString('?wow=nice')
    expect(result).toEqual({ someParameter: 'nice' })
  })

  it('should return defaults if empty', () => {
    const result = parseQueryString('')
    expect(result).toEqual(initialValues)
  })
  it('should return defaults if different string', () => {
    const result = parseQueryString('?somethingElse=cool')
    expect(result).toEqual(initialValues)
  })
  it('should allow to override defaults', () => {
    const newDefaults = { someParameter: 'otherDefault' }
    const result = parseQueryString('', newDefaults)
    expect(result).toEqual(newDefaults)
  })
})
