/* tslint:disable:no-expression-statement readonly-array */
import React, { FC, useEffect, useMemo } from 'react'
// tslint:disable-next-line:no-submodule-imports
import shallow from 'zustand/shallow'
import { StoreState } from '../middleware'
import {
  HistoryManagement,
  RouterOptions,
  StoreContext,
  useGeschichte
} from '../store'

const split = (url: string) => url.split('?')

interface Props {
  readonly Router: {
    readonly asPath: string
    readonly route: string
    readonly push: (
      url: string,
      as: string | undefined,
      options?: RouterOptions
    ) => any
    readonly replace: (
      url: string,
      as: string | undefined,
      options?: RouterOptions
    ) => any
    readonly events: {
      readonly on: (event: string, handler: (...args: any) => any) => any
      readonly off: (event: string, handler: (...args: any) => any) => any
    }
  }
  readonly asPath: string
}

const GeschichteForNextjs: FC<Props> = ({ children, asPath, Router }) => {
  const historyInstance: HistoryManagement = useMemo(() => {
    return {
      initialSearch: () => {
        const [, query] =
          typeof window === 'undefined' ? split(asPath) : split(Router.asPath)
        return `?${query || ''}`
      },
      push: (next: string, options) => {
        const [path] = split(Router.asPath)
        Router.push(Router.route, `${path}${next}`, options)
      },
      replace: (next: string, options) => {
        const [path] = split(Router.asPath)
        Router.replace(Router.route, `${path}${next}`, options)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const useStore = useMemo(() => useGeschichte(historyInstance), [
    historyInstance
  ])
  const state = useStore(
    // tslint:disable-next-line:no-shadowed-variable
    ({ unregister, updateFromQuery }: StoreState<any>) => ({
      unregister,
      updateFromQuery
    }),
    shallow
  )

  const { updateFromQuery } = state

  useEffect(() => {
    const [, query] = split(asPath)
    updateFromQuery(`?${query || ''}`)
  }, [asPath, updateFromQuery])

  useEffect(() => {
    const { unregister } = state
    return () => {
      return unregister()
    }
  }, [state])
  return (
    <StoreContext.Provider value={useStore}>{children}</StoreContext.Provider>
  )
}

export default GeschichteForNextjs