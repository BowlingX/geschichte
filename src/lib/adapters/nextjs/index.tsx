import React, {
  FC,
  memo,
  PropsWithChildren,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { shallow } from 'zustand/shallow'
import { StoreState } from '../../middleware.js'
import {
  StoreContext,
  createGeschichte,
  Context,
  DefaultHistoryManagement,
} from '../../store.js'
import type { UrlObject } from 'url'
import {
  Router as Router$,
  useRouter,
  default as NextRouter,
} from 'next/router.js'
import { createSearch, getOtherQueryParameters } from '../../utils.js'

const split = (url?: string) => url?.split('?') || []

interface TransitionOptions {
  readonly shallow?: boolean
  readonly locale?: string | false
  readonly scroll?: boolean
}

declare type Url = UrlObject | string

interface Props {
  readonly initialClientOnlyAsPath: string
  readonly asPath: string
  readonly defaultPushOptions?: TransitionOptions
  readonly defaultReplaceOptions?: TransitionOptions
  readonly routerPush?: (
    url: Url,
    as?: UrlObject,
    options?: TransitionOptions
  ) => Promise<boolean>
  readonly routerReplace?: (
    url: Url,
    as?: UrlObject,
    options?: TransitionOptions
  ) => Promise<boolean>
  readonly context?: Context
}

// FIXME: Somehow imports are messed up for nextjs when importing from modules (see https://github.com/vercel/next.js/issues/36794)
const Router = (NextRouter as unknown as { readonly default: Router$ }).default

const queryFromPath = (path: string) => {
  const [, query] = split(path)
  return `?${query || ''}`
}

const pathname = (path: string) => {
  try {
    return new URL(path, 'https://g').pathname
  } catch {
    return null
  }
}

export const GeschichteForNextjs = ({
  children,
  asPath,
  initialClientOnlyAsPath,
  defaultPushOptions,
  defaultReplaceOptions,
  routerPush,
  routerReplace,
  context,
}: PropsWithChildren<Props>) => {
  const lastClientSideQuery = useRef(initialClientOnlyAsPath)
  const historyInstance: DefaultHistoryManagement = useMemo(() => {
    return {
      initialSearch: () => {
        const [, query] =
          typeof window === 'undefined'
            ? split(asPath)
            : split(lastClientSideQuery.current || Router.asPath)
        return `?${query || ''}`
      },
      push: (query, namespaces, options) => {
        const [pathname] = split(Router.asPath)
        const routerOptions = {
          ...defaultPushOptions,
          ...options,
        }

        const others = getOtherQueryParameters(
          namespaces,
          new URLSearchParams(window.location.search)
        )
        const thisQuery = { ...others, ...query }

        if (routerPush) {
          return routerPush(
            { query: Router.query },
            { query: thisQuery, pathname },
            routerOptions
          )
        }
        return Router.push(
          `${pathname}${createSearch(thisQuery)}`,
          undefined,
          routerOptions
        )
      },
      replace: (query, namespaces, options) => {
        const [pathname] = split(Router.asPath)

        const routerOptions = {
          ...defaultReplaceOptions,
          ...options,
        }

        const others = getOtherQueryParameters(
          namespaces,
          new URLSearchParams(window.location.search)
        )
        const thisQuery = { ...others, ...query }

        if (routerReplace) {
          return routerReplace(
            { query: Router.query },
            { pathname, query: thisQuery },
            routerOptions
          )
        }
        return Router.replace(
          `${pathname}${createSearch(thisQuery)}`,
          undefined,
          routerOptions
        )
      },
      context,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerPush, routerReplace, context])

  const useStore = useMemo(
    () => createGeschichte(historyInstance),
    [historyInstance]
  )
  const state = useStore(
    ({ unregister, updateFromQuery }: StoreState<Record<string, unknown>>) => ({
      unregister,
      updateFromQuery,
    }),
    shallow
  )

  const { updateFromQuery } = state

  useEffect(() => {
    // tslint:disable-next-line
    lastClientSideQuery.current = window.location.href
    updateFromQuery(window.location.search)
    let skipEvent = true
    const routeChangeStartHandler = (path: string) => {
      const nextQuery = queryFromPath(path)
      let waitForNextRender = false

      // in case the path changes, the route changed, and we will delay applying the update
      if (pathname(lastClientSideQuery.current) !== pathname(path)) {
        waitForNextRender = true
      }

      lastClientSideQuery.current = path

      if (waitForNextRender) {
        Router.events.on('routeChangeComplete', function inner() {
          updateFromQuery(window.location.search)
          Router.events.off('routeChangeComplete', inner)
        })
        return
      }
      if (!skipEvent) {
        updateFromQuery(nextQuery)
      }
      skipEvent = false
    }
    Router.events.on('beforeHistoryChange', routeChangeStartHandler)
    return () => {
      Router.events.off('beforeHistoryChange', routeChangeStartHandler)
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
  | 'context'
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
  const { asPath } = useRouter()

  const thisAsPath = useMemo(() => {
    if (omitQueries) {
      const [path] = asPath.split('?')
      return path
    }
    return asPath
  }, [asPath, omitQueries])

  const [pp, setPp] = useState(thisAsPath)

  useEffect(() => {
    // We have to render the page always as if it would be rendered without query parameters, because
    // nextjs does not include the query parameters in the cache key. To not add side effects for other clients,
    // we set the path including query parameters on client mount.
    setPp(asPath)
  }, [asPath])

  return (
    <GeschichteForNextjs
      initialClientOnlyAsPath={thisAsPath}
      defaultReplaceOptions={defaultReplaceOptions}
      defaultPushOptions={defaultPushOptions}
      asPath={pp}
      {...props}
    />
  )
}

export default memo<ClientOnlyProps>(GeschichteForNextjsWrapper)
