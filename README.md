# 📖 Geschichte (/ɡəˈʃɪçtə/)

![CircleCI](https://img.shields.io/circleci/build/gh/BowlingX/geschichte)
![Codecov](https://img.shields.io/codecov/c/github/bowlingx/geschichte)
![npm](https://img.shields.io/npm/v/geschichte)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

`Geschichte` (german for History / Story / Tale) Let's you manage query-parameters with hooks.
Uses `immer` and `zustand` to manage the internal state.

Documentation & Demo: https://bowlingx.github.io/geschichte/index.html

API: https://bowlingx.github.io/geschichte/api/index.html

    yarn add geschichte
    
    npm install geschichte

## Basic Example

```typescript jsx

import Geschichte, { pm, factoryParameters, serializers } from 'geschichte'
import { createBrowserHistory } from 'history'

const parameterConfig = {
  item: pm('queryParameter', serializers.string /** a basic collection of serializers is availble, like date, int, float, arrays */ )
  /* ... more keys, any depth. */
};

// default value is either an object or a factory () => defaultValue
const defaultValue = {
  item: 'defaultValue' /** it automatically skips null or default values*/
}

// exports a hook (`useQuery`), and 
// utility methods `createQueryString` that let's you create a query string based on the described object anywhere outside of components etc.
// `parseQueryString` let's you parse a query string into an object as defined in the `parameterConfig`.
const { useQuery, createQueryString, parseQueryString } = factoryParameters(parameterConfig, defaultValue,  /** optional namespace, (creates a prefix separated by a dot)*/);


const Component = () => {
 const { values, pushState, replaceState, resetPush, resetReplace, createQueryString, batchReplaceState, batchPushState } = useQuery()
 return (
   <>
     <button onClick={() => pushState((values) => void ( values.item = "newValue" ))}>push new state</button>
     <button onClick={() => replaceState((values) => void ( values.item = "anotherOne" ))}>replace state</button>
     <button onClick={resetPush}>reset (push) to defaults</button>
     <button onClick={resetReplace}>reset (replace) to defaults</button>
     <div>{JSON.stringify(values)}</div>
     <div>The current queryString: {createQueryString()}</div>
   </> 
 )
}

const App = () => (
  <Geschichte history={createBrowserHistory()}>
    <Component />
  </Geschichte>
)
```

## Concept

`Geschichte` let's you describe and serialize an arbitrary object of any depth to your browsers query and history. 
It takes care of updating the next state and current query in a efficient way using `immerjs`.
It works on both the browser and server side (with `createMemoryHistory`)

### Naming

I was inspired by `immer` and `zustand`, so I picked a fitting german name :).

## Agenda

- Add more tests
- Propper examples and documentation of the full API
- Describe Use-Cases

## Compability

It works out of the box with react-router (by providing the same `history` instance).

### Using with next.js

Nextjs support is build in, but requires a different Instance.

```tsx

import React, { FC, memo, ReactNode } from 'react'
import { GeschichteForNextjs } from 'geschichte'
import Router, { useRouter } from 'next/router'

const GeschichteWithHistory: FC<{ children: ReactNode }> = (props) => {
  const { asPath } = useRouter()
  return (
      <GeschichteForNextjs Router={Router} asPath={asPath} {...props}/>
  )
}

export default memo(GeschichteWithHistory)

```
