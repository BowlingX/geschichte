import { render, cleanup } from '@testing-library/react'
import { createMemoryHistory } from 'history'
import React, { useEffect } from 'react'
import { factoryParameters, pm, serializers, useBatchQuery } from '../index.js'
import Geschichte from '../lib/adapters/historyjs/index.js'
import { InferNamespaceValues } from '../lib/store.js'

afterEach(cleanup)

describe('<Geschichte /> with initial query', () => {
  const configDefault = {
    myParameter: pm('my-parameter', serializers.string),
  }
  const defaultValuesDefault = () => ({
    myParameter: 'test',
  })

  const configOtherNs = {
    another: pm('another', serializers.string),
  }

  const defaultValuesOtherNs = () => ({
    another: 'value',
  })

  const { useQuery: useQueryDefault } = factoryParameters(
    configDefault,
    defaultValuesDefault
  )

  const { useQuery: useQueryOther } = factoryParameters(
    configOtherNs,
    defaultValuesOtherNs,
    'other'
  )

  it('should keep other query strings in the url for single namespaces', () => {
    const history = createMemoryHistory({
      initialEntries: [
        '/?my-parameter=foo&utm_campaign=some-campaign&utm_source=some-source',
      ],
    })

    const MyComponent = () => {
      const { replaceState } = useQueryDefault()
      useEffect(() => {
        replaceState((state) => {
          state.myParameter = 'other'
        })
      }, [replaceState])
      return null
    }

    render(
      <Geschichte history={history}>
        <MyComponent />
      </Geschichte>
    )

    expect(history.location.search).toEqual(
      '?utm_campaign=some-campaign&utm_source=some-source&my-parameter=other'
    )
  })

  it('should keep other query strings in the url for multiple namespaces', () => {
    const history = createMemoryHistory({
      initialEntries: ['/?utm_campaign=some-campaign&utm_source=some-source'],
    })

    const MyComponent = () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { replaceState } = useQueryDefault()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { values } = useQueryOther()

      type FullStore = {
        default: InferNamespaceValues<typeof useQueryDefault>
        other: InferNamespaceValues<typeof useQueryOther>
      }
      const { batchPushState } = useBatchQuery<FullStore>()

      useEffect(() => {
        batchPushState(
          ['default', 'other'] as const,
          (stateFirst, stateSecond) => {
            if (stateFirst && stateSecond) {
              stateFirst.myParameter = 'wasBatch'
              stateSecond.another = 'anotherOne'
            }
          }
        )
      }, [batchPushState])
      return null
    }

    render(
      <Geschichte history={history}>
        <MyComponent />
      </Geschichte>
    )

    expect(history.location.search).toEqual(
      '?utm_campaign=some-campaign&utm_source=some-source&my-parameter=wasBatch&other.another=anotherOne'
    )
  })
})
