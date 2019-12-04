/* tslint:disable:no-expression-statement */
import { History } from 'history'
import React, { FC, useEffect, useMemo } from 'react'
import { geschichte, StoreContext } from './store'

interface Props {
  /** a history instance (e.g. createBrowserHistory()) */
  readonly history: History
}

export const Geschichte: FC<Props> = ({ children, history }) => {
  const value = useMemo(() => geschichte(history), [])
  const [useStore] = value
  const unregister = useStore(state => state.unregister)
  useEffect(() => {
    return () => {
      return unregister()
    }
  }, [unregister])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
