/* tslint:disable:no-expression-statement readonly-array */
import { Action, History, Location } from 'history'
import React, {
  forwardRef,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useMemo,
} from 'react'
// tslint:disable-next-line:no-submodule-imports
import shallow from 'zustand/shallow'
import { StoreState } from '../../middleware.js'
import { HistoryManagement, StoreContext, useGeschichte } from '../../store.js'

export interface Props {
  /** a history instance (e.g. createBrowserHistory()) */
  readonly history: History
  readonly children?: ReactNode
}

export interface Refs {
  readonly updateFromQuery: (query: string) => void
}

const createSearch = (query: Record<string, string>) => {
  const queryString = new URLSearchParams(query).toString()
  return queryString === '' ? '' : `?${queryString}`
}

export const GeschichteWithHistory = forwardRef<Refs, Props>(
  ({ children, history }, ref) => {
    const historyInstance: HistoryManagement = useMemo(() => {
      return {
        initialSearch: () => history.location.search,
        push: async (query: Record<string, string>) => {
          history.push(
            {
              hash: history.location.hash,
              search: createSearch(query),
            },
            { __g__: true }
          )
        },
        replace: async (query: Record<string, string>) =>
          history.replace(
            {
              hash: history.location.hash,
              search: createSearch(query),
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
      return history.listen((update, maybeAction) => {
        // tslint:disable-next-line:no-let
        let action: Action
        // tslint:disable-next-line:no-let
        let location: Location<unknown>
        // history.js 4.x
        if (maybeAction) {
          location = update
          action = maybeAction
        } else {
          // history.js 5.x
          // @ts-ignore
          action = update.action
          // @ts-ignore
          location = update.location
        }
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
