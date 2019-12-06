/* tslint:disable:no-expression-statement readonly-array */
import { History } from 'history'
import React, { FC, useEffect, useMemo } from 'react'
import { StoreApi, UseStore } from 'zustand'
import { StoreState } from './middleware'
import { geschichte, StoreContext } from './store'

interface Props {
  /** a history instance (e.g. createBrowserHistory()) */
  readonly history: History
}

export const Geschichte: FC<Props> = ({ children, history }) => {
  const value = useMemo(() => geschichte(history), []) as [
    UseStore<StoreState<any>>,
    StoreApi<StoreState<any>>
  ]
  const [useStore] = value
  const unregister = useStore((state: StoreState<any>) => state.unregister)
  useEffect(() => {
    return () => {
      return unregister()
    }
  }, [unregister])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
