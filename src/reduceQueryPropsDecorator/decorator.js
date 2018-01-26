import React from 'react';
import pick from 'lodash/fp/pick';
import displayName from '../displayName';
import * as t from 'io-ts';
import { ThrowReporter } from 'io-ts/lib/ThrowReporter';

const ReadyState = t.interface({
  loading: t.boolean, ready: t.boolean
}, 'ReadyState');

const reduceQueryPropsReturn = (queries) => t.interface({
  accumulator: t.any,
  props: t.interface({
    ...queries.reduce((ac, k) => ({ ...ac, [k]: t.any }), {}),
    readyState: t.interface(queries.reduce((ac, k) => ({ ...ac, [k]: ReadyState }), {}), 'ReadyStates')
  }, 'QueriesProps')
}, 'ReduceQueryPropsReturn');

export default ({ queries, reducer }) => {
  const pickQueriesAndReadyState = pick([...(queries || []), 'readyState']);
  const ReduceQueryPropsReturn = reduceQueryPropsReturn(queries);

  return Component => (
    class ReduceQueryPropsWrapper extends React.Component {

      static displayName = displayName(Component, 'reduceQueryProps');

      state = {};

      componentWillReceiveProps(newProps) {
        const rqp = reducer(this.state.queryPropsAccumulator, pickQueriesAndReadyState(newProps));
        if (process.env.NODE_ENV !== 'production') {
          ThrowReporter.report(t.validate(rqp, ReduceQueryPropsReturn));
        }
        const { accumulator: queryPropsAccumulator, props: queryProps } = rqp;
        this.setState({
          queryPropsAccumulator, queryProps
        });
      }

      render() {
        return <Component {...{ ...this.props, ...this.state.queryProps }} />;
      }
    }
  );
};
