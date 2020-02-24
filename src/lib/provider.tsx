/* tslint:disable:no-expression-statement readonly-array */
import { History } from 'history'
import React, {
  FC,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo
} from 'react'
import { StoreApi, UseStore } from 'zustand'
// tslint:disable-next-line:no-submodule-imports
import shallow from 'zustand/shallow'
import { StoreState } from './middleware'
import { geschichte, StoreContext } from './store'

interface Props<T> {
  /** a history instance (e.g. createBrowserHistory()) */
  readonly history: History
}

export const Geschichte: FC<Props<any>> = forwardRef(
  ({ children, history }, ref) => {
    const value = useMemo(() => geschichte(history), []) as [
      UseStore<StoreState<any>>,
      StoreApi<StoreState<any>>
    ]
    const [useStore] = value
    const state = useStore(
      ({ unregister, updateFromQuery }: StoreState<any>) => ({
        unregister,
        updateFromQuery
      }),
      shallow
    )
    useImperativeHandle(
      ref,
      () => ({
        updateFromQuery: state.updateFromQuery
      }),
      [state]
    )
    useEffect(() => {
      const { unregister } = state
      return () => {
        return unregister()
      }
    }, [state])
    return (
      <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
    )
  }
)
