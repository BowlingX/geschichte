/* tslint:disable:no-expression-statement no-object-mutation */
import { createBrowserHistory } from 'history'
import React from 'react'
import Geschichte, { factoryParameters, pm, serializers } from '../index'

const history = createBrowserHistory()

const config = {
  abc: {
    test: pm('z', serializers.string),
  },
  arg: pm('arg', serializers.string),
  test: pm('foo', serializers.string),
}

const { useQuery } = factoryParameters(config, {
  abc: {
    test: 'arg',
  },
  arg: 'blub',
  test: 'haha',
})

const { useQuery: useAnotherQuery } = factoryParameters(
  config,
  () => ({
    abc: {
      test: 'arg',
    },
    arg: 'xyz',
    test: 'another',
  }),
  'wow'
)

const InnerApp = () => {
  const { values, pushState } = useQuery()
  return (
    <>
      <input
        type="text"
        value={values.test}
        onChange={(event) => {
          pushState((state) => void (state.test = event.target.value))
        }}
      />
      <p>{JSON.stringify(values)}</p>
    </>
  )
}

const DifferentApp = () => {
  const { values: otherNsValues, pushState, resetPush } = useAnotherQuery()
  return (
    <>
      <input
        type="text"
        value={otherNsValues.test}
        onChange={(event) => {
          pushState((state) => void (state.test = event.target.value))
        }}
      />
      <button onClick={() => resetPush()}>Reset</button>
    </>
  )
}

export const App = () => (
  <>
    <Geschichte history={history}>
      <h3>A sample Appliations</h3>
      <InnerApp />
      <DifferentApp />
    </Geschichte>
  </>
)
