/* tslint:disable:no-expression-statement no-object-mutation */
import { mount } from 'enzyme'
import { createMemoryHistory } from 'history'
import React, { useCallback, useState } from 'react'
import {
  SearchProvider,
  useQuery as useDefaultQuery
} from '../examples/defaults'
import Geschichte from '../index'

describe('<Geschichte /> dynamic defaults', () => {
  const history = createMemoryHistory()

  const ComponentThatDisplaysValue = () => {
    const {
      values: { someParameter }
    } = useDefaultQuery()
    return <span>{someParameter}</span>
  }

  const ComponentThatUsesQuery = () => {
    const { pushState } = useDefaultQuery()
    return (
      <>
        <button
          name="pushState"
          onClick={() => pushState(state => void (state.someParameter = 'foo'))}
        />
      </>
    )
  }
  it('should apply new default values when they change', () => {
    const Component = () => {
      const [values, setValues] = useState({ someParameter: 'current default' })

      const setNewDefaults = useCallback(() => {
        setValues({ someParameter: 'new default' })
      }, [setValues])

      return (
        <>
          <SearchProvider defaultValues={values}>
            <ComponentThatUsesQuery />
            <ComponentThatDisplaysValue />
            <button name="resetDefaults" onClick={setNewDefaults} />
          </SearchProvider>
        </>
      )
    }

    const Test = () => (
      <Geschichte history={history}>
        <Component />
      </Geschichte>
    )

    const rendered = mount(<Test />)
    expect(rendered.text()).toEqual('current default')
    rendered.find('button[name="resetDefaults"]').simulate('click')
    expect(rendered.text()).toEqual('new default')
  })

  it('should apply new defaults in different trees when they change', () => {
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
            <button name="resetDefaults" onClick={setNewDefaults} />
          </SearchProvider>
        </>
      )
    }

    const Test = () => (
      <Geschichte history={history}>
        <Component />
      </Geschichte>
    )

    const rendered = mount(<Test />)
    expect(rendered.text()).toEqual('current default')
    rendered.find('button[name="resetDefaults"]').simulate('click')
    expect(rendered.text()).toEqual('new default')
  })
})
