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
        pushState
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
        </>
      )
    }

    const renderd = mount(
      <Geschichte history={history}>
        <Component />
      </Geschichte>
    )

    it('changes the state when we click the button', () => {
      expect(renderd.text()).toEqual('test')
      renderd.find('button[name="pushState"]').simulate('click')
      expect(renderd.text()).toEqual('foo')
      expect(history.location.search).toEqual('?test.wow=foo')
    })

    it('changes the state when we use `pushBatch`', () => {
      renderd.find('button[name="pushBatch"]').simulate('click')
      expect(renderd.text()).toEqual('wasBatch')
      expect(history.location.search).toEqual(
        '?test.wow=wasBatch&test2.wow=anotherOne'
      )
    })
  })
})
