/* tslint:disable:no-expression-statement */
import { History } from 'history';
import React, { useEffect, useMemo } from 'react';
import { geschichte, StoreContext } from './store';

interface Props {
  readonly history: History;
}

export const Geschichte: React.FC<Props> = ({ children, history }) => {
  const value = useMemo(() => geschichte(history), []);
  const [useStore] = value;
  const unregister = useStore(state => state.unregister);
  useEffect(() => {
    return () => {
      return unregister();
    };
  }, [unregister]);
  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
};
