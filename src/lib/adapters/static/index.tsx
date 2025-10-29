import React, { memo, useMemo, useRef } from 'react'
import {
  StoreContext,
  createGeschichte,
  Context,
  DefaultHistoryManagement,
} from '../../store.js'
import { createSearch } from '../../utils.js'

interface Props {
  readonly search?: string
  readonly context?: Context
}

const StaticGeschichteProvider = ({
  search,
  context,
  children,
}: React.PropsWithChildren<Props>) => {
  const thisSearch = useRef(search)
  const historyInstance: DefaultHistoryManagement = useMemo(() => {
    return {
      initialSearch: () => thisSearch.current || '',
      push: async (query) => {
        thisSearch.current = createSearch(query)
        return
      },
      replace: async (query) => {
        thisSearch.current = createSearch(query)
        return
      },
      context,
    }
  }, [thisSearch, context])

  const value = useMemo(
    () => createGeschichte(historyInstance),
    [historyInstance]
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export default memo(StaticGeschichteProvider)
