import { pm } from '../lib/utils'
import { serializers } from '../lib/serializers'
import { factoryParameters } from '../lib/store'
import React, { createContext, FC, useContext, useMemo } from 'react'

const config = {
  someParameter: pm('wow', serializers.string)
}
const defaultValues = () => ({
  someParameter: 'test'
})

interface Props<T = {}> {
  readonly defaultValues: T
}

const defaultProductSearchWithoutCustomization = factoryParameters(
  config,
  defaultValues,
  'some'
)

const ConfigurableProductSearchContext = createContext(
  defaultProductSearchWithoutCustomization
)

export const SearchProvider: FC<Props> = ({
  defaultValues: thisDefaultValues,
  children
}) => {
  const value = useMemo(() => {
    return factoryParameters(
      config,
      () => ({
        ...defaultValues(),
        ...thisDefaultValues
      }),
      'some'
    )
  }, [thisDefaultValues])

  return (
    <ConfigurableProductSearchContext.Provider value={value}>
      {children}
    </ConfigurableProductSearchContext.Provider>
  )
}

export const useQuery = () => {
  const { useQuery: thisUseQuery } = useContext(
    ConfigurableProductSearchContext
  )
  return thisUseQuery()
}
