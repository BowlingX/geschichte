/* tslint:disable:no-expression-statement */
import { serializers } from '../serializers.js'

describe('serializers', () => {
  describe('string', () => {
    const { serialize, deserialize } = serializers.string
    it('should serialize', () => {
      expect(serialize('string')).toEqual('string')
    })
    it('should deserialize', () => {
      expect(deserialize('string')).toEqual('string')
    })
    it('should deserialize null', () => {
      expect(deserialize(null)).toEqual(null)
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
    it('should deserialize null', () => {
      expect(deserialize(null)).toEqual([])
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
    it('should deserialize null', () => {
      expect(deserialize(null)).toEqual([])
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
    it('should deserialize null', () => {
      expect(deserialize(null)).toEqual([])
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
    it('should deserialize null', () => {
      expect(deserialize(null)).not.toBeNull()
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
    it('should deserialize 0', () => {
      expect(deserialize('0')).toEqual(0)
    })
    it('should deserialize string to null', () => {
      expect(deserialize('xyz')).toEqual(null)
    })
    it('should deserialize null', () => {
      expect(deserialize(null)).toEqual(null)
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
    it('should deserialize 0.0', () => {
      expect(deserialize('0.0')).toEqual(0)
    })
    it('should deserialize string to null', () => {
      expect(deserialize('xyz')).toEqual(null)
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
    it('should deserialize null', () => {
      expect(deserialize(null)).toEqual(false)
    })
  })
})
