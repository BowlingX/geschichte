/* tslint:disable:no-expression-statement readonly-array */
import React, { FC, memo, ReactNode, useEffect, useMemo, useRef } from 'react'
import {
  Router as Router$,
  default as NextRouter,
  // tslint:disable-next-line:no-submodule-imports
} from 'next/router.js'
// tslint:disable-next-line:no-submodule-imports
import shallow from 'zustand/shallow'
import { StoreState } from '../../middleware'
import { HistoryManagement, StoreContext, useGeschichte } from '../../store'
import type { UrlObject } from 'url'

const split = (url?: string) => url?.split('?') || []

interface TransitionOptions {
  readonly shallow?: boolean
  readonly locale?: string | false
  readonly scroll?: boolean
}

declare type Url = UrlObject | string

interface Props {
  readonly defaultPushOptions?: TransitionOptions
  readonly defaultReplaceOptions?: TransitionOptions
  // tslint:disable-next-line:no-mixed-interface
  readonly routerPush?: (
    url: Url,
    as: UrlObject,
    options?: TransitionOptions
  ) => Promise<boolean>
  // tslint:disable-next-line:no-mixed-interface
  readonly routerReplace?: (
    url: Url,
    as: UrlObject,
    options?: TransitionOptions
  ) => Promise<boolean>
}

// FIXME: Somehow imports are messed up for nextjs when importing from modules (see https://github.com/vercel/next.js/issues/36794)
const Router = (NextRouter as any as { readonly default: Router$ }).default

const queryFromPath = (path: string) => {
  const [, query] = split(path)
  return `?${query || ''}`
}

export const GeschichteForNextjs: FC<Props> = ({
  children,
  defaultPushOptions,
  defaultReplaceOptions,
  routerPush,
  routerReplace,
}) => {
  const lastClientSideQuery = useRef<string>()
  const historyInstance: HistoryManagement = useMemo(() => {
    return {
      initialSearch: () => {
        return typeof window === 'undefined'
          ? '?'
          : lastClientSideQuery.current || window.location.search
      },
      push: (query, options) => {
        const [pathname] = split(Router.asPath)
        const routerOptions = {
          ...defaultPushOptions,
          ...options,
        }

        if (routerPush) {
          return routerPush(Router.route, { pathname, query }, routerOptions)
        }
        return Router.push(Router.route, { pathname, query }, routerOptions)
      },
      replace: (query, options) => {
        const [pathname] = split(Router.asPath)

        const routerOptions = {
          ...defaultReplaceOptions,
          ...options,
        }

        if (routerReplace) {
          return routerReplace(Router.route, { pathname, query }, routerOptions)
        }
        return Router.replace(Router.route, { pathname, query }, routerOptions)
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerPush, routerReplace])

  const useStore = useMemo(
    () => useGeschichte(historyInstance),
    [historyInstance]
  )
  const state = useStore(
    // tslint:disable-next-line:no-shadowed-variable
    ({ unregister, updateFromQuery }: StoreState<object>) => ({
      unregister,
      updateFromQuery,
    }),
    shallow
  )

  const { updateFromQuery } = state

  useEffect(() => {
    updateFromQuery(window.location.search)
    // tslint:disable-next-line
    lastClientSideQuery.current = window.location.search
    const routeChangeStartHandler = (path: string) => {
      const query = queryFromPath(path)
      // tslint:disable-next-line
      lastClientSideQuery.current = query
      updateFromQuery(query)
    }
    Router.events.on('routeChangeStart', routeChangeStartHandler)
    return () => {
      Router.events.off('routeChangeStart', routeChangeStartHandler)
    }
  }, [updateFromQuery])

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

type ClientOnlyProps = Pick<
  Props,
  | 'defaultPushOptions'
  | 'defaultReplaceOptions'
  | 'routerPush'
  | 'routerReplace'
> & {
  readonly children: ReactNode
  readonly omitQueries?: boolean
}

// see https://nextjs.org/docs/api-reference/next/router#routerpush for options;
// in general we want shallow (see https://nextjs.org/docs/routing/shallow-routing) routing in most cases and not scroll
const defaultRoutingOptions = { scroll: false, shallow: true }

export const GeschichteForNextjsWrapper: FC<ClientOnlyProps> = ({
  omitQueries = true,
  defaultPushOptions = defaultRoutingOptions,
  defaultReplaceOptions = defaultRoutingOptions,
  ...props
}) => {
  return (
    <GeschichteForNextjs
      defaultReplaceOptions={defaultReplaceOptions}
      defaultPushOptions={defaultPushOptions}
      {...props}
    />
  )
}

export default memo<ClientOnlyProps>(GeschichteForNextjsWrapper)
