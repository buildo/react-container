import React from 'react';
import pick from 'lodash/fp/pick';
import omit from 'lodash/fp/omit';
import displayName from '../displayName';
import { t } from 'tcomb-react';

const ReadyState = t.interface({
  loading: t.Boolean, ready: t.Boolean
}, { strict: true, name: 'ReadyState' });

const reduceQueryPropsReturn = (queries) => t.interface({
  accumulator: t.Any,
  props: t.interface({
    ...queries.reduce((ac, k) => ({ ...ac, [k]: t.Any }), {}),
    readyState: t.interface(queries.reduce((ac, k) => ({ ...ac, [k]: ReadyState }), {}), { strict: true, name: 'ReadyStates' })
  }, { strict: true, name: 'QueriesProps' })
}, { strict: true, name: 'ReduceQueryPropsReturn' });

export default ({ queries, reducer }) => {
  const pickQueriesAndReadyState = pick([...(queries || []), 'readyState']);
  const omitQueriesAndReadyState = omit([...(queries || []), 'readyState']);
  const ReduceQueryPropsReturn = reduceQueryPropsReturn(queries);

  const getReducedQueryProps = (state, props) => {
    const rqp = reducer(state.queryPropsAccumulator, pickQueriesAndReadyState(props));
    t.assert(ReduceQueryPropsReturn.is(rqp), () => `
      \`reduceQueryProps\` function should return a \`{ props, accumulator }\` object.
      \`props\` should conform to declared queries plus \`readyState\`, no additional keys are allowed.
    `);
    const { accumulator: queryPropsAccumulator, props: queryProps } = rqp;
    return { queryPropsAccumulator, queryProps };
  };

  return Component => (
    class ReduceQueryPropsWrapper extends React.Component {

      static displayName = displayName(Component, 'reduceQueryProps');

      state = getReducedQueryProps({}, this.props);

      componentWillReceiveProps(newProps) {
        this.setState(getReducedQueryProps(this.state, newProps));
      }

      render() {
        return <Component {...{ ...omitQueriesAndReadyState(this.props), ...this.state.queryProps }} />;
      }
    }
  );
};
