/* tslint:disable:no-expression-statement readonly-array */
import { History } from 'history'
import React, {
  forwardRef,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useMemo,
} from 'react'
// tslint:disable-next-line:no-submodule-imports
import shallow from 'zustand/shallow'
import { StoreState } from '../middleware'
import { HistoryManagement, StoreContext, useGeschichte } from '../store'

export interface Props {
  /** a history instance (e.g. createBrowserHistory()) */
  readonly history: History
  readonly children?: ReactNode
}

export interface Refs {
  readonly updateFromQuery: (query: string) => void
}

export const GeschichteWithHistory = forwardRef<Refs, Props>(
  ({ children, history }, ref) => {
    const historyInstance: HistoryManagement = useMemo(() => {
      return {
        initialSearch: () => history.location.search,
        push: (next: string) => {
          history.push(
            {
              hash: history.location.hash,
              search: next,
            },
            { __g__: true }
          )
        },
        replace: (next: string) =>
          history.replace(
            {
              hash: history.location.hash,
              search: next,
            },
            { __g__: true }
          ),
      }
    }, [history])

    const value = useMemo(
      () => useGeschichte(historyInstance),
      [historyInstance]
    )
    const state = value(
      ({ unregister, updateFromQuery }: StoreState<any>) => ({
        unregister,
        updateFromQuery,
      }),
      shallow
    )

    useEffect(() => {
      return history.listen((update) => {
        const { action, location } = update
        // don't handle our own actions
        if (
          (action === 'REPLACE' || action === 'PUSH') &&
          location.state &&
          // @ts-ignore
          location.state.__g__
        ) {
          return
        }
        state.updateFromQuery(location.search)
      })
    }, [history, state.updateFromQuery])

    useImperativeHandle(
      ref,
      () => ({
        updateFromQuery: state.updateFromQuery,
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

export default GeschichteWithHistory
