/* tslint:disable:no-expression-statement */
import expect from 'expect'
import { Patch } from 'immer'
import { serializers } from '../serializers'
import { DEFAULT_NAMESPACE } from '../store'
import {
  createOrApplyPath,
  createQueriesFromPatch,
  flattenConfig,
  pm
} from '../utils'

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

  describe('createOrApplyPath', () => {
    it('should handle null', () => {
      const result = createOrApplyPath(null, ['some', 'path'], 'new value')
      expect(result).toEqual(null)
    })
    it('should handle null of key inside object', () => {
      const result = createOrApplyPath(
        { some: null },
        ['some', 'path'],
        'new value'
      )
      expect(result).toEqual({ some: null })
    })
    it('should map an object', () => {
      const object = {
        some: {
          path: 'test'
        },
        somewhere: {
          else: {
            deep: 'xyz'
          }
        }
      }

      createOrApplyPath(object, ['some', 'path'], 'new value')

      expect(object).toEqual({
        some: { path: 'new value' },
        somewhere: {
          else: {
            deep: 'xyz'
          }
        }
      })
    })
  })

  describe('createQueriesFromPatch', () => {
    const config = {
      parameter: pm('p', serializers.string),
      somewhere: {
        else: {
          here: pm('deep', serializers.string)
        }
      }
    }
    const initialState = {
      parameter: 'something',
      somewhere: {
        else: {
          here: 'xyz'
        }
      }
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
        { ...initialState, parameter: 'un' },
        initialState
      )
      expect(nextQueries).toEqual({ p: 'un' })
    })

    it('should deeply detect patches', () => {
      const patch: readonly Patch[] = [
        {
          op: 'add',
          path: ['namespaces', DEFAULT_NAMESPACE, 'values', 'somewhere'],
          value: undefined
        }
      ]
      const nextQueries = createQueriesFromPatch(
        config,
        DEFAULT_NAMESPACE,
        patch,
        { ...initialState, somewhere: { else: { here: 'newValue' } } },
        initialState
      )
      expect(nextQueries).toEqual({ deep: 'newValue' })
    })
  })
})
