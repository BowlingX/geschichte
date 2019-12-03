/* tslint:disable:no-expression-statement no-object-mutation */
import { mount } from 'enzyme';
import { createMemoryHistory } from 'history';
import React from 'react';
import Geschichte, { factoryParameters, pm, serializers } from '../index';

describe('<Geschichte />', () => {
  const history = createMemoryHistory();

  describe('renders', () => {
    const { useQuery } = factoryParameters(
      {
        someParameter: pm('wow', serializers.string)
      },
      { someParameter: 'test' },
      'test'
    );

    const Component = () => {
      const {
        values: { someParameter },
        pushState
      } = useQuery();
      return (
        <>
          <p>{someParameter}</p>
          <button
            onClick={() =>
              pushState(state => void (state.someParameter = 'foo'))
            }
          />
        </>
      );
    };

    const renderd = mount(
      <Geschichte history={history}>
        <Component />
      </Geschichte>
    );

    it('changes the state when we click the button', () => {
      expect(renderd.text()).toEqual('test');
      renderd.find('button').simulate('click');
      expect(renderd.text()).toEqual('foo');
      expect(history.location.search).toEqual('?test.wow=foo');
    });
  });
});
