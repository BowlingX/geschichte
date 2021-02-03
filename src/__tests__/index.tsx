/* tslint:disable:no-expression-statement no-object-mutation */
import { mount } from 'enzyme'
import { createMemoryHistory } from 'history'
import React from 'react'
import Geschichte, {
  factoryParameters,
  pm,
  serializers,
  useBatchQuery
} from '../index'

describe('<Geschichte />', () => {
  const history = createMemoryHistory()

  describe('renders', () => {
    const { useQuery } = factoryParameters(
      {
        someParameter: pm('wow', serializers.string)
      },
      { someParameter: 'test' },
      'test'
    )

    const { useQuery: secondNamespaceUseQuery } = factoryParameters(
      {
        someParameter: pm('wow', serializers.string)
      },
      { someParameter: 'test' },
      'test2'
    )

    const Component = () => {
      const {
        values: { someParameter },
        pushState,
        resetPush
      } = useQuery()
      const { values: secondValues } = secondNamespaceUseQuery()

      const { batchPushState } = useBatchQuery()
      return (
        <>
          <p>{someParameter}</p>
          <button
            name="pushState"
            onClick={() =>
              pushState(state => void (state.someParameter = 'foo'))
            }
          />
          <button
            name="pushBatch"
            onClick={() =>
              batchPushState(['test', 'test2'], (stateFirst, stateSecond) => {
                stateFirst.someParameter = 'wasBatch'
                stateSecond.someParameter = 'anotherOne'
              })
            }
          />
          <button name="resetPush" onClick={resetPush} />
        </>
      )
    }

    const rendered = mount(
      <Geschichte history={history}>
        <Component />
      </Geschichte>
    )

    it('changes the state when we click the button', () => {
      expect(rendered.text()).toEqual('test')
      rendered.find('button[name="pushState"]').simulate('click')
      expect(rendered.text()).toEqual('foo')
      expect(history.location.search).toEqual('?test.wow=foo')
    })

    it('changes the state when we use `pushBatch`', () => {
      rendered.find('button[name="pushBatch"]').simulate('click')
      expect(rendered.text()).toEqual('wasBatch')
      expect(history.location.search).toEqual(
        '?test.wow=wasBatch&test2.wow=anotherOne'
      )
    })

    it('should reset the state properly', () => {
      rendered.find('button[name="pushBatch"]').simulate('click')
      expect(rendered.text()).toEqual('wasBatch')
      expect(history.location.search).toEqual(
        '?test.wow=wasBatch&test2.wow=anotherOne'
      )
      rendered.find('button[name="resetPush"]').simulate('click')
      expect(rendered.text()).toEqual('test')
      expect(history.location.search).toEqual('?test2.wow=anotherOne')
    })
  })

  describe('renders with hash', () => {
    const { useQuery } = factoryParameters(
      {
        someParameter: pm('someParameter', serializers.string)
      },
      { someParameter: 'test' }
    )
    const historyWithHash = createMemoryHistory({
      initialEntries: ['/#this-is-a-hash']
    })

    const Component = () => {
      const {
        values: { someParameter },
        pushState
      } = useQuery()

      return (
        <>
          <p>{someParameter}</p>
          <button
            name="pushState"
            onClick={() =>
              pushState(state => void (state.someParameter = 'foo'))
            }
          />
        </>
      )
    }

    const rendered = mount(
      <Geschichte history={historyWithHash}>
        <Component />
      </Geschichte>
    )
    it('should keep the hash on pushState', () => {
      expect(rendered.text()).toEqual('test')
      rendered.find('button[name="pushState"]').simulate('click')
      expect(rendered.text()).toEqual('foo')
      expect(historyWithHash.location.search).toEqual('?someParameter=foo')
      expect(historyWithHash.location.hash).toEqual('#this-is-a-hash')
    })
  })
})
