/* tslint:disable:no-expression-statement readonly-array */
import React, { FC, useEffect, useMemo } from 'react'
import { StoreApi, UseStore } from 'zustand'
// tslint:disable-next-line:no-submodule-imports
import shallow from 'zustand/shallow'
import { StoreState } from '../middleware'
import { geschichte, HistoryManagement, StoreContext } from '../store'

const split = (url: string) => url.split('?')

interface Props {
  readonly Router: {
    readonly asPath: string
    readonly route: string
    readonly push: (url: string, as: string) => any
    readonly replace: (url: string, as: string) => any
    readonly events: {
      readonly on: (event: string, handler: (...args: any) => any) => any
      readonly off: (event: string, handler: (...args: any) => any) => any
    }
  }
  readonly initialPath: string
}

const GeschichteForNextjs: FC<Props> = ({ children, initialPath, Router }) => {
  const historyInstance: HistoryManagement = useMemo(() => {
    const initial = split(initialPath)
    const [, query] = initial
    return {
      initialSearch: `?${query || ''}`,
      push: (next: string) => {
        const [path] = split(Router.asPath)
        Router.push(Router.route, `${path}${next}`)
      },
      replace: (next: string) => {
        const [path] = split(Router.asPath)
        Router.replace(Router.route, `${path}${next}`)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(() => geschichte(historyInstance), [
    historyInstance
  ]) as [UseStore<StoreState<any>>, StoreApi<StoreState<any>>]
  const [useStore] = value
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
    const { unregister } = state
    const handler = (url: string) => {
      const [, query] = split(url)
      updateFromQuery(`?${query || ''}`)
    }
    Router.events.on('routeChangeStart', handler)
    return () => {
      Router.events.off('routeChangeStart', handler)
      unregister()
    }
  }, [updateFromQuery])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export default GeschichteForNextjs
