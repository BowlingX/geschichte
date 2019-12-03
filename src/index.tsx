/* tslint:disable:no-expression-statement */
import { createBrowserHistory } from 'history';
import React from 'react';
import { Geschichte } from './lib/provider';
import { serializers } from './lib/serializers';
import { factoryParameters } from './lib/store';
import { pm } from './lib/utils';

const history = createBrowserHistory();

const config = {
  arg: pm('arg', serializers.string),
  test: pm('foo', serializers.string)
};

const { useQuery } = factoryParameters(config, {
  arg: 'blub',
  test: 'haha'
});

const { useQuery: useAnotherQuery } = factoryParameters(config, {
  arg: 'xyz',
  test: 'another'
}, 'wow');


const InnerApp = () => {
  const { values, query, pushState } = useQuery();
  return (
    <>
      <input
        type="text"
        value={values.test}
        onChange={event => {
          pushState(state => void (state.test = event.target.value));
        }}
      />
      <p>{JSON.stringify(values)}</p>
      <p>{JSON.stringify(query)}</p>
    </>
  );
};

const DifferentApp = () => {
  const { values } = useQuery();
  const { values: otherNsValues, pushState } = useAnotherQuery()
  return (
    <>
    <p>{JSON.stringify(values)}</p>
      <input
        type="text"
        value={otherNsValues.test}
        onChange={event => {
          pushState(state => void (state.test = event.target.value));
        }}
      />
      </>
  )
}

export const App = () => (
  <>
    <Geschichte history={history}>
      <p>Wsa geht denn?</p>
      <InnerApp />
      <DifferentApp />
    </Geschichte>
  </>
);
