/* tslint:disable:no-expression-statement */
import expect from 'expect'
import { Patch } from 'immer'
import { serializers } from '../serializers'
import { DEFAULT_NAMESPACE } from '../store'
import { createQueriesFromPatch, flattenConfig, pm } from '../utils'

describe('utils', () => {
  describe('flattenConfig', () => {
    const config = {
      somethingElse: {
        deeper: pm('anotherOne', serializers.int),
        evenDeeper: {
          test: pm('deeper', serializers.string)
        }
      },
      state: pm('theParameter', serializers.int)
    }
    it('should create a flat config from `config`', () => {
      const flatConfig = flattenConfig(config)
      expect(Object.keys(flatConfig)).toEqual([
        'anotherOne',
        'deeper',
        'theParameter'
      ])
      expect(flatConfig).toMatchSnapshot()
    })
  })

  describe('createQueriesFromPatch', () => {
    const config = {
      parameter: pm('p', serializers.string)
    }
    it('should generate undefined values for undefined queries', () => {
      const patch: readonly Patch[] = [
        {
          op: 'add',
          path: ['namespaces', DEFAULT_NAMESPACE, 'values', 'parameter'],
          value: undefined
        }
      ]
      const nextQueries = createQueriesFromPatch(
        config,
        DEFAULT_NAMESPACE,
        patch,
        { parameter: undefined },
        { parameter: 'something' }
      )
      expect(nextQueries).toEqual({ p: undefined })
    })
  })
})
