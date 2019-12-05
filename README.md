# 📖 Geschichte

![CircleCI](https://img.shields.io/circleci/build/gh/BowlingX/geschichte)
![Codecov](https://img.shields.io/codecov/c/github/bowlingx/geschichte)
![npm](https://img.shields.io/npm/v/geschichte)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

`Geschichte` (german for Story / Tale) Let's you manage query-parameters with hooks.
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
  item: pm('queryParameter', serializers.string (/* a basic collection of serializers is availble, like date, int, float, arrays */))
  /* ... more keys, any depth. */
};

const defaultValue = {
  item: 'defaultValue' /** it automatically skips null or default values*/
}

const { useQuery } = factoryParameters(parameterConfig, defaultValue,  /** optional namespace, (creates a prefix separated by a dot)*/);

const Component = () => {
 const { values, pushState, replaceState, resetPush, resetReplace, createQueryString } = useQuery()
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

Next.js does not give access to all required Router methods (to detect push for example).
What works though is to hijack the browser's `pushState` and `replaceState` methods to notify
`history.js` about the change (with `replace`, so we don't create an entry).

We also need to keep the currrent state, because `Geschichte` uses a `__g__` property
to mark if it pushes something (to not create an infinite loop :)).

```js
let globalHistoryObject
if (typeof window !== 'undefined') {
  // We replace push and replace state to keep the current history state.
  // This will allow next.js and history.js work together
  const originalPushState = History.prototype.pushState
  const originalReplaceState = History.prototype.replaceState

  History.prototype.pushState = function(...args) {
    let [state, title, url] = args
    const historyState = state.state && state.state.__g__

    // if the push was issued from Geschichte, we update the as url here to make sure next.js
    // does not replace it when we navigate back
    if (historyState) {
      state = { ...state, as: url }
    }

    originalPushState.call(
      this,
      { ...window.history.state, ...state },
      title,
      url
    )
    // Only if it happened from an external change that was not done by Geschichte
    if (!historyState) {
      // To make the next url available on the internal history object we replace it with the next url
      globalHistoryObject.replace(url)
    }
  }

  History.prototype.replaceState = function(...args) {
    const [state, title, url] = args
    return originalReplaceState.call(
      this,
      { ...window.history.state, ...state },
      title,
      url
    )
  }
}
```

An example repo will follow.
