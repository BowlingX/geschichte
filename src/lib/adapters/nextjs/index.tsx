/* tslint:disable:no-expression-statement readonly-array */
import React, {
  FC,
  memo,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
// tslint:disable-next-line:no-submodule-imports
import { useRouter, Router as Router$, default as NextRouter } from 'next/router.js'
// tslint:disable-next-line:no-submodule-imports
import shallow from 'zustand/shallow'
import { StoreState } from '../../middleware'
import { HistoryManagement, StoreContext, useGeschichte } from '../../store'

const split = (url?: string) => url?.split('?') || []

interface TransitionOptions {
  readonly shallow?: boolean
  readonly locale?: string | false
  readonly scroll?: boolean
}

interface Props {
  readonly initialClientOnlyAsPath?: string
  readonly asPath: string
  readonly defaultPushOptions?: TransitionOptions
  readonly defaultReplaceOptions?: TransitionOptions
}

// FIXME: Somehow imports are messed up for nextjs when importing from modules (see https://github.com/vercel/next.js/issues/36794)
const Router = (NextRouter as any as { readonly default: Router$ }).default

export const GeschichteForNextjs: FC<Props> = ({
  children,
  asPath,
  initialClientOnlyAsPath,
  defaultPushOptions,
  defaultReplaceOptions,
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
          ...options,
        })
      },
      replace: (next: string, options) => {
        const [path] = split(Router.asPath)
        Router.replace(Router.route, `${path}${next}`, {
          ...defaultReplaceOptions,
          ...options,
        })
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

type ClientOnlyProps = Pick<
  Props,
  'defaultPushOptions' | 'defaultReplaceOptions'
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
