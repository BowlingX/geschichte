/* tslint:disable:no-expression-statement no-object-mutation */

import { render, cleanup, screen, act } from '@testing-library/react'
import userEventImport from '@testing-library/user-event'
import React from 'react'
import Geschichte from '../lib/adapters/static/index.js'
import { factoryParameters } from '../lib/store.js'
import { pm } from '../lib/utils.js'
import { serializers } from '../lib/serializers.js'

const userEvent = userEventImport.default || userEventImport

afterEach(cleanup)

describe('<StaticGeschichteProvider />', () => {
  const { useQuery } = factoryParameters(
    {
      someParameter: pm('parameter', serializers.string),
    },
    { someParameter: 'test' }
  )
  const ComponentThatRendersSomethingStatically = () => {
    const {
      pushState,
      replaceState,
      values: { someParameter },
    } = useQuery()
    return (
      <>
        <span role="content">{someParameter}</span>
        <button
          role="push"
          onClick={() =>
            void pushState(
              (state) => void (state.someParameter = 'nextPushState')
            )
          }
        ></button>

        <button
          role="replace"
          onClick={() =>
            void replaceState(
              (state) => void (state.someParameter = 'nextReplaceState')
            )
          }
        ></button>
      </>
    )
  }

  it('should render a static search string', () => {
    render(
      <Geschichte search="?parameter=myValue">
        <ComponentThatRendersSomethingStatically />
      </Geschichte>
    )
    expect(screen.getByRole('content').textContent).toEqual('myValue')
  })

  it('should support replace and push state', async () => {
    render(
      <Geschichte>
        <ComponentThatRendersSomethingStatically />
      </Geschichte>
    )
    await act(async () => {
      await userEvent.click(screen.getByRole('push'))
    })
    expect(screen.getByRole('content').textContent).toEqual('nextPushState')
    await act(async () => {
      await userEvent.click(screen.getByRole('replace'))
    })
    expect(screen.getByRole('content').textContent).toEqual('nextReplaceState')
  })
})
