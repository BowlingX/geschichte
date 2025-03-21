/* eslint-disable react-perf/jsx-no-new-function-as-prop */
import { render, cleanup, screen, act } from '@testing-library/react'
import userEventImport from '@testing-library/user-event'
import { createMemoryHistory } from 'history'
import React from 'react'
import { factoryParameters, pm, serializers, useBatchQuery } from '../index.js'
import Geschichte from '../lib/adapters/historyjs/index.js'
import { InferNamespaceValues } from '../lib/store.js'

afterEach(cleanup)

const userEvent = userEventImport.default || userEventImport

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
        other: pm('wow', serializers.string),
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { values: secondValues } = secondNamespaceUseQuery() // we have to use the other query so it's registered

      type FullStore = {
        test: InferNamespaceValues<typeof useQuery>
        test2: InferNamespaceValues<typeof secondNamespaceUseQuery>
      }
      const { batchPushState } = useBatchQuery<FullStore>()
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
                if (stateFirst && stateSecond) {
                  stateFirst.someParameter = 'wasBatch'
                  if ('other' in stateSecond) {
                    stateSecond.other = 'anotherOne'
                  }
                }
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
      await act(async () => {
        await userEvent.click(screen.getByTitle('pushState'))
      })
      expect(screen.getByRole('content').textContent).toEqual('foo')
      expect(history.location.search).toEqual('?test.wow=foo')
    })

    it('changes the state when we use `pushBatch`', async () => {
      render(
        <Geschichte history={history}>
          <Component />
        </Geschichte>
      )
      await act(async () => {
        await userEvent.click(screen.getByTitle('pushBatch'))
      })
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
      await act(async () => {
        await userEvent.click(screen.getByTitle('pushBatch'))
      })
      expect(screen.getByRole('content').textContent).toEqual('wasBatch')
      expect(history.location.search).toEqual(
        '?test.wow=wasBatch&test2.wow=anotherOne'
      )
      await act(async () => {
        await userEvent.click(screen.getByTitle('resetPush'))
      })
      expect(screen.getByRole('content').textContent).toEqual('test')
      expect(history.location.search).toEqual('?test2.wow=anotherOne')
    })

    it('should throw when `Provider` not in scope', () => {
      expect(() => render(<Component />)).toThrow(
        'Cannot find `GeschichteProvider` in React tree context. Please provide outer <GeschichteProvider />.'
      )
    })
  })

  describe('allow to set a context', () => {
    const { useQuery, createQueryString } = factoryParameters(
      {
        someParameter: pm('someParameter', serializers.arrayString),
      },
      { someParameter: [] as string[] }
    )
    const historyWithHash = createMemoryHistory({
      initialEntries: ['/?someParameter=A-B-C-D'],
    })
    const context = { serializerConfig: { arrayStringSeparator: '-' } }

    const Component = () => {
      const {
        values: { someParameter },
        createQueryString: createDynamicQueryString,
        pushState,
      } = useQuery()

      return (
        <>
          <p role="static-query">
            {createQueryString(
              { someParameter: ['cool', 'parameter'] },
              undefined,
              context
            )}
          </p>
          <p role="dynamic-query">
            {createDynamicQueryString({ someParameter: ['cool', 'parameter'] })}
          </p>
          <p role="content">{someParameter.join('#')}</p>
          <button
            title="pushState"
            onClick={() =>
              pushState(
                (state) => void (state.someParameter = ['hello', 'world'])
              )
            }
          />
        </>
      )
    }

    it('should render the expected state and serialize correctly', async () => {
      render(
        <Geschichte history={historyWithHash} context={context}>
          <Component />
        </Geschichte>
      )
      expect(screen.getByRole('content').textContent).toEqual('A#B#C#D')
      expect(screen.getByRole('static-query').textContent).toEqual(
        'someParameter=cool-parameter'
      )
      expect(screen.getByRole('dynamic-query').textContent).toEqual(
        'someParameter=cool-parameter'
      )
      await act(async () => {
        await userEvent.click(screen.getByTitle('pushState'))
      })
      expect(screen.getByRole('content').textContent).toEqual('hello#world')
      expect(historyWithHash.location.search).toEqual(
        '?someParameter=hello-world'
      )
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
      await act(async () => {
        await userEvent.click(screen.getByTitle('pushState'))
      })
      expect(screen.getByRole('content').textContent).toEqual('foo')
      expect(historyWithHash.location.search).toEqual('?someParameter=foo')
      expect(historyWithHash.location.hash).toEqual('#this-is-a-hash')
    })
  })
})
