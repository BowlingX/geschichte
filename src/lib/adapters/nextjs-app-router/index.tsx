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

interface Props {
  readonly children?: ReactNode
}

const GeschichteForNextAppRouter = ({ children }: Props) => {
  const searchParams = useSearchParams()
  const { push, replace } = useRouter()
  const pathname = usePathname()

  const router = useRef({ push, replace, searchParams, pathname })

  const historyInstance: HistoryManagement = useMemo(() => {
    const { searchParams, push, replace, pathname } = router.current
    return {
      initialSearch: () => searchParams,
      push: async (query) => {
        push(`${pathname}${createSearch(query)}`)
      },
      replace: async (query) => {
        replace(`${pathname}${createSearch(query)}`)
      },
    }
  }, [])

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
      state.updateFromQuery(searchParams)
    }
    router.current = { push, replace, searchParams, pathname }
    return () => {
      state.unregister()
    }
  }, [push, replace, pathname, searchParams, state])

  return (
    <StoreContext.Provider value={useStore}>{children}</StoreContext.Provider>
  )
}

export default memo(GeschichteForNextAppRouter)
