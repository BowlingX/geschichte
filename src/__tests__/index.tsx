/* tslint:disable:no-expression-statement */
import { mount } from 'enzyme';
import produce from 'immer';
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import create from 'zustand';

const pm = (name: string) => () => ({ name });

interface Parameter {
  readonly name: string;
}

interface Config {
  readonly [propName: string]: Config | (() => Parameter);
}

const namespaceProducer = (ns, fn) => state => {
  if (state.namespaces[ns]) {
    return fn(state.namespaces[ns]);
  }
  const next = {};
  fn(next);
  state.namespaces[ns] = next;
};

const immer = config => (set, get, api) => {
  return config(
    (fn, ns: string) => {
      set(produce(namespaceProducer(ns, fn)));
    },
    get,
    api
  );
};

// Log every time state is changed
const history = config => (set, get, api) =>
  config(
    (args, type, ns) => {
      set(args, ns);
    },
    get,
    api
  );

const geschichte = () => {
  return create(
    immer(
      history((set, get) => ({
        namespaces: {},
        pushState: (ns: string, fn) => set(fn, 'push', ns),
        // tslint:disable-next-line:no-empty
        register: (config: Config, ns: string, initialState = {}) => {
          const current = get().namespaces[ns];
          if (current !== undefined) {
            return current;
          }
          set(
            state => {
              // todo: deserialize values from query parameters
              state.values = initialState;
              state.initialValues = initialState;
            },
            'register',
            ns
          );
          return get().namespaces[ns];
        },
        replaceState: (ns: string, fn) => set(fn, 'replace', ns)
      }))
    )
  );
};

const StoreContext = createContext();

const Geschichte: React.FC<any> = ({ children }) => {
  const value = useMemo(() => geschichte(), []);
  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
};

const DEFAULT_NAMESPACE = 'default';

const factoryParameters = (
  config: Config,
  initialState: Object = {},
  ns: string = DEFAULT_NAMESPACE
) => {
  const useQuery = () => {
    const [useStore] = useContext(StoreContext);

    const callback = useCallback(
      // tslint:disable-next-line:no-shadowed-variable
      ({ register, pushState, replaceState }) => ({
        register,
        pushState,
        replaceState
      })
    );
    const { register, pushState, replaceState } = useStore(callback);
    register(config, ns, initialState);
    const values = useStore(state => state.namespaces[ns]);
    return useMemo(
      () => ({
        defaultValues: values.defaultValues,
        pushState: state => pushState(ns, state),
        replaceState: state => replaceState(ns, state),
        values: values.values
      }),
      [values, pushState, replaceState]
    );
  };
  return { useQuery };
};

describe('Zustand', () => {
  it('test', async () => {
    const { useQuery } = factoryParameters(
      {},
      { someParameter: 'test' },
      'test'
    );

    const Component = () => {
      const {
        values: { someParameter },
        pushState
      } = useQuery();
      // tslint:disable-next-line:no-console
      return (
        <>
          <p>{someParameter}</p>
          <button
            onClick={() =>
              pushState(state => void (state.values.someParameter = 'foo')
              )
            }
          />
        </>
      );
    };

    const renderd = mount(
      <Geschichte>
        <Component />
      </Geschichte>
    );

    expect(renderd.text()).toEqual('test');
    renderd.find('button').simulate('click');
    expect(renderd.text()).toEqual('foo');
  });
});
