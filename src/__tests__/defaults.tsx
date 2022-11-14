/* tslint:disable:no-expression-statement no-object-mutation */
import { render, cleanup, screen, act } from '@testing-library/react'
import userEventImport from '@testing-library/user-event'
import { createMemoryHistory } from 'history'
import React, { useCallback, useState } from 'react'
import Geschichte from '../lib/adapters/historyjs/index.js'
import {
  SearchProvider,
  useQuery as useDefaultQuery,
} from '../examples/defaults.js'

const userEvent = userEventImport.default || userEventImport

afterEach(cleanup)

describe('<Geschichte /> dynamic defaults', () => {
  const history = createMemoryHistory()

  const ComponentThatDisplaysValue = () => {
    const {
      values: { someParameter },
    } = useDefaultQuery()
    return <span role="content">{someParameter}</span>
  }

  const ComponentThatUsesQuery = () => {
    const { pushState } = useDefaultQuery()
    return (
      <>
        <button
          title="pushState"
          onClick={() =>
            pushState((state) => void (state.someParameter = 'foo'))
          }
        />
      </>
    )
  }
  it('should apply new default values when they change', async () => {
    const Component = () => {
      const [values, setValues] = useState({ someParameter: 'current default' })

      const setNewDefaults = useCallback(() => {
        setValues({ someParameter: 'new default' })
      }, [setValues])

      return (
        <SearchProvider defaultValues={values}>
          <ComponentThatUsesQuery />
          <ComponentThatDisplaysValue />
          <button title="resetDefaults" onClick={setNewDefaults} />
        </SearchProvider>
      )
    }

    const DefaultTest = () => (
      <Geschichte history={history}>
        <Component />
      </Geschichte>
    )

    render(<DefaultTest />)

    expect(screen.getByRole('content').textContent).toEqual('current default')
    await act(async () => {
      await userEvent.click(screen.getByTitle('resetDefaults'))
    })
    expect(screen.getByRole('content').textContent).toEqual('new default')
  })

  it('should apply new defaults in different trees when they change', async () => {
    const Component = () => {
      const [values, setValues] = useState({ someParameter: 'current default' })

      const setNewDefaults = useCallback(() => {
        setValues({ someParameter: 'new default' })
      }, [setValues])

      return (
        <>
          <ComponentThatUsesQuery />
          <SearchProvider defaultValues={values}>
            <ComponentThatDisplaysValue />
            <button title="resetDefaults" onClick={setNewDefaults} />
          </SearchProvider>
        </>
      )
    }

    const DifferentTreesTest = () => (
      <Geschichte history={history}>
        <Component />
      </Geschichte>
    )

    render(<DifferentTreesTest />)

    expect(screen.getByRole('content').textContent).toEqual('current default')
    await act(async () => {
      await userEvent.click(screen.getByTitle('resetDefaults'))
    })
    expect(screen.getByRole('content').textContent).toEqual('new default')
  })
})
