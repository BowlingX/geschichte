import React, {
  FC,
  memo,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { shallow } from 'zustand/shallow'
import { StoreState } from '../../middleware.js'
import {
  HistoryManagement,
  StoreContext,
  createGeschichte,
  Context,
} from '../../store.js'
import type { UrlObject } from 'url'
import {
  Router as Router$,
  useRouter,
  default as NextRouter,
} from 'next/router.js'

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

export const GeschichteForNextjs: FC<Props> = ({
  children,
  asPath,
  initialClientOnlyAsPath,
  defaultPushOptions,
  defaultReplaceOptions,
  routerPush,
  routerReplace,
  context,
}) => {
  const lastClientSideQuery = useRef(initialClientOnlyAsPath)
  const historyInstance: HistoryManagement<Context> = useMemo(() => {
    return {
      initialSearch: () => {
        const [, query] =
          typeof window === 'undefined'
            ? split(asPath)
            : split(lastClientSideQuery.current || Router.asPath)
        return `?${query || ''}`
      },
      push: (query, options) => {
        const [pathname] = split(Router.asPath)
        const routerOptions = {
          ...defaultPushOptions,
          ...options,
        }

        if (routerPush) {
          return routerPush(
            { query: Router.query },
            { query, pathname },
            routerOptions
          )
        }
        return Router.push(
          { query: Router.query },
          { query, pathname },
          routerOptions
        )
      },
      replace: (query, options) => {
        const [pathname] = split(Router.asPath)

        const routerOptions = {
          ...defaultReplaceOptions,
          ...options,
        }

        if (routerReplace) {
          return routerReplace(
            { query: Router.query },
            { pathname, query },
            routerOptions
          )
        }
        return Router.replace(
          { query: Router.query },
          { pathname, query },
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
      lastClientSideQuery.current = path
      // skip execution for first render
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
