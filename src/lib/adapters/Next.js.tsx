/* tslint:disable:no-expression-statement readonly-array */
import React, { FC, useEffect, useMemo, useRef } from 'react'
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
  }
  readonly initialClientOnlyAsPath?: string
  readonly asPath: string
  readonly defaultPushOptions?: RouterOptions
  readonly defaultReplaceOptions?: RouterOptions
}

const GeschichteForNextjs: FC<Props> = ({
  children,
  asPath,
  initialClientOnlyAsPath,
  Router,
  defaultPushOptions,
  defaultReplaceOptions
}) => {
  const lastClientSideQuery = useRef(initialClientOnlyAsPath)
  const historyInstance: HistoryManagement = useMemo(() => {
    return {
      initialSearch: () => {
        const [, query] =
          typeof window === 'undefined'
            ? split(asPath)
            : split(lastClientSideQuery.current || Router.asPath)
        return `?${query || ''}`
      },
      push: (next: string, options) => {
        const [path] = split(Router.asPath)
        Router.push(Router.route, `${path}${next}`, {
          ...defaultPushOptions,
          ...options
        })
      },
      replace: (next: string, options) => {
        const [path] = split(Router.asPath)
        Router.replace(Router.route, `${path}${next}`, {
          ...defaultReplaceOptions,
          ...options
        })
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
    const nextQuery = `?${query || ''}`
    if (initialClientOnlyAsPath) {
      // tslint:disable-next-line
      lastClientSideQuery.current = nextQuery
    }
    updateFromQuery(nextQuery)
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
