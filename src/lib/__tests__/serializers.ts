/* tslint:disable:no-expression-statement */
import expect from 'expect'
import { serializers } from '../serializers'

describe('serializers', () => {
  describe('string', () => {
    const { serialize, deserialize } = serializers.string
    it('should serialize', () => {
      expect(serialize('string')).toEqual('string')
    })
    it('should deserialize', () => {
      expect(deserialize('string')).toEqual('string')
    })
  })
  describe('arrayString', () => {
    const { serialize, deserialize } = serializers.arrayString
    it('should serialize', () => {
      expect(serialize(['a', 'b'])).toEqual('a_b')
    })
    it('should deserialize', () => {
      expect(deserialize('a_b')).toEqual(['a', 'b'])
    })
  })

  describe('arrayFloat', () => {
    const { serialize, deserialize } = serializers.arrayFloat
    it('should serialize', () => {
      expect(serialize([1.2, 2.01])).toEqual('1.2_2.01')
    })
    it('should deserialize', () => {
      expect(deserialize('1.2_2.01')).toEqual([1.2, 2.01])
    })
  })

  describe('arrayInt', () => {
    const { serialize, deserialize } = serializers.arrayInt
    it('should serialize', () => {
      expect(serialize([1, 2])).toEqual('1_2')
    })
    it('should deserialize', () => {
      expect(deserialize('1_2')).toEqual([1, 2])
    })
  })

  describe('date', () => {
    const { serialize, deserialize } = serializers.date()
    it('should serialize', () => {
      expect(serialize(new Date(Date.UTC(1985, 9, 10, 0, 0, 0)))).toEqual(
        '10/10/1985'
      )
    })
    it('should deserialize', () => {
      expect(deserialize('10/10/1985')).toEqual(new Date('10/10/1985'))
    })
  })

  describe('int', () => {
    const { serialize, deserialize } = serializers.int
    it('should serialize', () => {
      expect(serialize(2)).toEqual('2')
    })
    it('should deserialize', () => {
      expect(deserialize('2')).toEqual(2)
    })
  })

  describe('float', () => {
    const { serialize, deserialize } = serializers.float
    it('should serialize', () => {
      expect(serialize(2.0)).toEqual('2')
    })
    it('should deserialize', () => {
      expect(deserialize('2.0')).toEqual(2.0)
    })
  })

  describe('boolean', () => {
    const { serialize, deserialize } = serializers.boolean
    it('should serialize', () => {
      expect(serialize(true)).toEqual('1')
      expect(serialize(false)).toEqual('0')
    })
    it('should deserialize', () => {
      expect(deserialize('1')).toEqual(true)
      expect(deserialize('0')).toEqual(false)
    })
  })
})
