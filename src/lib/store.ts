/* tslint:disable:no-expression-statement readonly-array */
import { History } from 'history';
import LocationState = History.LocationState;

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import create, { StoreApi, UseStore } from 'zustand';
import {
  converter,
  historyManagement,
  immerWithPatches,
  NamespaceValues,
  StoreState
} from './middleware';
import { Serializer } from './serializers';
import { flattenConfig } from './utils';

export const DEFAULT_NAMESPACE = 'default';

export const StoreContext = createContext<
  [UseStore<StoreState<any>>, StoreApi<StoreState<any>>]
>(null);

export interface Parameter {
  readonly name: string;
  readonly serializer: Serializer;
}

export interface MappedParameter extends Parameter {
  readonly path: readonly string[];
}

export interface Config {
  readonly [propName: string]: Config | (() => Parameter);
}

export interface MappedConfig {
  readonly [queryParameter: string]: MappedParameter;
}

export const geschichte = (historyInstance: History<LocationState>) => {
  return create(
    immerWithPatches(
      historyManagement(historyInstance)(converter(historyInstance))
    )
  );
};

export const factoryParameters = <T = object>(
  config: Config,
  // tslint:disable-next-line:no-object-literal-type-assertion
  initialState: T = {} as T,
  ns: string = DEFAULT_NAMESPACE
) => {
  const useQuery = () => {
    const [useStore, api] = useContext(StoreContext) as [
      UseStore<StoreState<T>>,
      StoreApi<StoreState<T>>
    ];

    const callback = useCallback(
      // tslint:disable-next-line:no-shadowed-variable
      ({ register, pushState, replaceState }) => ({
        pushState,
        register,
        replaceState
      }),
      [useStore]
    );
    const { register, pushState, replaceState } = useStore(callback);

    const flatConfig = useMemo(() => flattenConfig(config), [config]);

    useMemo(() => {
      register(config, flatConfig, ns, initialState);
    }, [flatConfig]);

    const initialNamespaceValues = useStore(state => state.namespaces[ns]);
    // initial state
    const [innerValues, setInnerValues] = useState(initialNamespaceValues);

    // subscribe to updates
    useEffect(() => {
      const unsubscribe = api.subscribe<NamespaceValues<T>>(
        state => {
          setInnerValues(state);
        },
        state => state.namespaces[ns]
      );

      return () => {
        unsubscribe();
        innerValues.unsubscribe();
      };
    }, [setInnerValues]);

    return useMemo(
      () => ({
        initialValues: innerValues.initialValues,
        pushState: (state: (state: T) => void) => pushState(ns, state),
        query: innerValues.query,
        replaceState: (state: (state: T) => void) => replaceState(ns, state),
        values: innerValues.values
      }),
      [innerValues, pushState, replaceState]
    );
  };
  return { useQuery };
};
