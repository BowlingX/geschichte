'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation.js'
import {
  HistoryManagement,
  StoreContext,
  createGeschichte,
} from '../../store.js'
import React, { memo, ReactNode, useEffect, useMemo, useRef } from 'react'
import { StoreState } from '../../middleware.js'
import { shallow } from 'zustand/shallow'
import { createSearch } from '../../utils.js'
import type { NavigateOptions } from 'next/dist/shared/lib/app-router-context.js'

interface Props {
  readonly children?: ReactNode
  readonly navigateDefaultOptions?: NavigateOptions
}

const GeschichteForNextAppRouter = ({
  children,
  navigateDefaultOptions = { scroll: false },
}: Props) => {
  const searchParams = useSearchParams()
  const { push, replace } = useRouter()
  const pathname = usePathname()

  const router = useRef({ push, replace, searchParams, pathname })

  const historyInstance: HistoryManagement = useMemo(() => {
    const { searchParams, push, replace, pathname } = router.current
    return {
      initialSearch: () => searchParams as unknown as URLSearchParams,
      push: async (query, options) => {
        push(`${pathname}${createSearch(query)}`, {
          ...navigateDefaultOptions,
          ...options,
        })
      },
      replace: async (query, options) => {
        replace(`${pathname}${createSearch(query)}`, {
          ...navigateDefaultOptions,
          ...options,
        })
      },
    }
  }, [navigateDefaultOptions])

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

  useEffect(() => {
    if (router.current.searchParams !== searchParams) {
      state.updateFromQuery(searchParams as unknown as URLSearchParams)
    }
    router.current = { push, replace, searchParams, pathname }
  }, [push, replace, pathname, searchParams, state])

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

export default memo(GeschichteForNextAppRouter)
