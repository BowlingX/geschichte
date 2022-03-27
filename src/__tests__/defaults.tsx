/* tslint:disable:no-expression-statement no-object-mutation */
import { render, cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory } from 'history'
import React, {
  createContext,
  FC,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import Geschichte, { factoryParameters, pm, serializers } from '../index'

const config = {
  someParameter: pm('wow', serializers.string),
}
const defaultValues = () => ({
  someParameter: 'test',
})

interface Props<T = {}> {
  readonly defaultValues: T
}

const defaultProductSearchWithoutCustomization = factoryParameters(
  config,
  defaultValues
)

const ConfigurableProductSearchContext = createContext(
  defaultProductSearchWithoutCustomization
)

const SearchProvider: FC<Props> = ({
  defaultValues: thisDefaultValues,
  children,
}) => {
  const value = useMemo(() => {
    return factoryParameters(config, () => ({
      ...defaultValues(),
      ...thisDefaultValues,
    }))
  }, [thisDefaultValues])

  return (
    <ConfigurableProductSearchContext.Provider value={value}>
      {children}
    </ConfigurableProductSearchContext.Provider>
  )
}

const useQuery = () => {
  const { useQuery: thisUseQuery } = useContext(
    ConfigurableProductSearchContext
  )
  return thisUseQuery()
}

afterEach(cleanup)

describe('<Geschichte /> dynamic defaults', () => {
  const history = createMemoryHistory()

  const ComponentThatDisplaysValue = () => {
    const {
      values: { someParameter },
    } = useQuery()
    return <span role="content">{someParameter}</span>
  }

  const ComponentThatUsesQuery = () => {
    const { pushState } = useQuery()
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
    userEvent.click(screen.getByTitle('resetDefaults'))
    expect(screen.getByRole('content').textContent).toEqual('new default')
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
    userEvent.click(screen.getByTitle('resetDefaults'))
    expect(screen.getByRole('content').textContent).toEqual('new default')
  })
})
