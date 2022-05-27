/* tslint:disable:no-expression-statement no-object-mutation */
import { render, cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from 'history'
import React from 'react'
import Geschichte, {
  factoryParameters,
  pm,
  serializers,
  useBatchQuery,
} from '../index'

afterEach(cleanup)

describe('<Geschichte />', () => {
  const history = createMemoryHistory()

  describe('renders', () => {
    const { useQuery } = factoryParameters(
      {
        someParameter: pm('wow', serializers.string),
      },
      { someParameter: 'test' },
      'test'
    )

    const { useQuery: secondNamespaceUseQuery } = factoryParameters(
      {
        someParameter: pm('wow', serializers.string),
      },
      { someParameter: 'test' },
      'test2'
    )

    const Component = () => {
      const {
        values: { someParameter },
        pushState,
        resetPush,
      } = useQuery()
      const { values: secondValues } = secondNamespaceUseQuery()
      // tslint:disable-next-line:readonly-keyword
      const { batchPushState } = useBatchQuery<{ someParameter: string }>()
      return (
        <>
          <p role="content">{someParameter}</p>
          <button
            title="pushState"
            onClick={() =>
              pushState((state) => void (state.someParameter = 'foo'))
            }
          />
          <button
            title="pushBatch"
            onClick={() =>
              batchPushState(['test', 'test2'], (stateFirst, stateSecond) => {
                stateFirst.someParameter = 'wasBatch'
                stateSecond.someParameter = 'anotherOne'
              })
            }
          />
          <button title="resetPush" onClick={resetPush} />
        </>
      )
    }

    it('should render correctly if we have an inital query state', () => {
      const historyWithInitialState = createMemoryHistory({
        initialEntries: ['/?test.wow=myInitialState'],
      })
      render(
        <Geschichte history={historyWithInitialState}>
          <Component />
        </Geschichte>
      )
      expect(screen.getByRole('content').textContent).toEqual('myInitialState')
    })

    it('changes the state when we click the button', async () => {
      render(
        <Geschichte history={history}>
          <Component />
        </Geschichte>
      )
      expect(screen.getByRole('content').textContent).toEqual('test')
      await userEvent.click(screen.getByTitle('pushState'))
      expect(screen.getByRole('content').textContent).toEqual('foo')
      expect(history.location.search).toEqual('?test.wow=foo')
    })

    it('changes the state when we use `pushBatch`', async () => {
      render(
        <Geschichte history={history}>
          <Component />
        </Geschichte>
      )
      await userEvent.click(screen.getByTitle('pushBatch'))
      expect(screen.getByRole('content').textContent).toEqual('wasBatch')
      expect(history.location.search).toEqual(
        '?test.wow=wasBatch&test2.wow=anotherOne'
      )
    })

    it('should reset the state properly', async () => {
      render(
        <Geschichte history={history}>
          <Component />
        </Geschichte>
      )
      await userEvent.click(screen.getByTitle('pushBatch'))
      expect(screen.getByRole('content').textContent).toEqual('wasBatch')
      expect(history.location.search).toEqual(
        '?test.wow=wasBatch&test2.wow=anotherOne'
      )
      await userEvent.click(screen.getByTitle('resetPush'))
      expect(screen.getByRole('content').textContent).toEqual('test')
      expect(history.location.search).toEqual('?test2.wow=anotherOne')
    })
  })

  describe('renders with hash', () => {
    const { useQuery } = factoryParameters(
      {
        someParameter: pm('someParameter', serializers.string),
      },
      { someParameter: 'test' }
    )
    const historyWithHash = createMemoryHistory({
      initialEntries: ['/#this-is-a-hash'],
    })

    const Component = () => {
      const {
        values: { someParameter },
        pushState,
      } = useQuery()

      return (
        <>
          <p role="content">{someParameter}</p>
          <button
            title="pushState"
            onClick={() =>
              pushState((state) => void (state.someParameter = 'foo'))
            }
          />
        </>
      )
    }

    it('should keep the hash on pushState', async () => {
      render(
        <Geschichte history={historyWithHash}>
          <Component />
        </Geschichte>
      )
      expect(screen.getByRole('content').textContent).toEqual('test')
      await userEvent.click(screen.getByTitle('pushState'))
      expect(screen.getByRole('content').textContent).toEqual('foo')
      expect(historyWithHash.location.search).toEqual('?someParameter=foo')
      expect(historyWithHash.location.hash).toEqual('#this-is-a-hash')
    })
  })
})
