import React from 'react';
import pick from 'lodash/fp/pick';
import omitByF from 'lodash/fp/omitBy';
import compact from 'lodash/compact';
import flowRight from 'lodash/flowRight';
import isUndefined from 'lodash/isUndefined';
import { t, props } from 'tcomb-react';
import { skinnable, pure, contains } from 'revenge';
import _declareConnect from 'buildo-state/lib/connect';
import _declareQueries from 'react-avenger/lib/queries';
import _declareCommands from 'react-avenger/lib/commands';
import { defaultIsReady, noLoaderLoading } from 'react-avenger/lib/loading';
import displayName from './displayName';

const stripUndef = omitByF(isUndefined);

const ContainerConfig = t.interface({
  isReady: t.maybe(t.Function),
  loadingDecorator: t.maybe(t.Function),
  connect: t.maybe(t.dict(t.String, t.Type)),
  queries: t.maybe(t.list(t.String)),
  commands: t.maybe(t.list(t.String)),
  reduceQueryProps: t.maybe(t.Function),
  mapProps: t.maybe(t.Function),
  propTypes: t.maybe(t.dict(t.String, t.Type))
}, { strict: true, name: 'ContainerConfig' });

const DecoratorConfig = t.interface({
  declareConnect: t.maybe(t.Function),
  declareQueries: t.maybe(t.Function),
  declareCommands: t.maybe(t.Function)
}, { strict: true, name: 'DecoratorConfig' });

const PublicDecoratorConfig = DecoratorConfig.extend({
  allQueries: t.maybe(t.Object),
  allCommands: t.maybe(t.Object)
}, { strict: true, name: 'PublicDecoratorConfig' });

const ReadyState = t.interface({
  waiting: t.Boolean, fetching: t.Boolean, loading: t.Boolean, error: t.maybe(t.Any), ready: t.Boolean
}, { strict: true, name: 'ReadyState' });

const reduceQueryPropsReturn = queries => t.interface({
  accumulator: t.Any,
  props: t.interface({
    ...queries.reduce((ac, k) => ({ ...ac, [k]: t.Any }), {}),
    readyState: t.interface(queries.reduce((ac, k) => ({ ...ac, [k]: ReadyState }), {}), { strict: true, name: 'ReadyStates' })
  }, { strict: true, name: 'QueriesProps' })
}, { strict: true, name: 'ReduceQueryPropsReturn' });

const defaultDeclareConnect = (decl = {}, config = {}) => (
  _declareConnect(decl, { killProps: ['params', 'query', 'router'], ...config })
);

const decorator = ({ declareQueries, declareCommands, declareConnect }) => (Component, config = {}) => {
  const {
    isReady = defaultIsReady,
    loadingDecorator = noLoaderLoading,
    connect, queries, commands,
    reduceQueryProps: reduceQueryPropsFn,
    mapProps,
    propTypes: __props
  } = ContainerConfig(config);

  const declaredQueries = queries && declareQueries(queries);

  const reduceQueryPropsDecorator = () => {
    const pickQueriesAndReadyState = pick([...(queries || []), 'readyState']);
    const ReduceQueryPropsReturn = reduceQueryPropsReturn(queries);

    return Component => (
      class ReduceQueryPropsWrapper extends React.Component {

        static displayName = displayName(Component, 'reduceQueryProps');

        state = {};

        componentWillReceiveProps(newProps) {
          const rqp = reduceQueryPropsFn(this.state.queryPropsAccumulator, pickQueriesAndReadyState(newProps));
          t.assert(ReduceQueryPropsReturn.is(rqp), () => `
            \`reduceQueryProps\` function should return a \`{ props, accumulator }\` object.
            \`props\` should conform to declared queries plus \`readyState\`, no additional keys are allowed.
          `);
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

  const reduceQueryProps = queries && reduceQueryPropsFn && reduceQueryPropsDecorator();
  const declaredCommands = commands && declareCommands(commands);
  const declaredConnect = connect && declareConnect(connect);
  const propsTypes = {
    ...(__props ? __props : {}),
    ...(queries ? declaredQueries.Type : {}),
    ...(commands ? declaredCommands.Type : {}),
    ...(connect ? declaredConnect.Type : {})
  };
  const composedDecorators = flowRight(...compact([
    declaredQueries,
    reduceQueryProps,
    declaredCommands,
    declaredConnect
  ]));

  const getLocals = mapProps || pick([
    ...(queries || []),
    ...(commands || []),
    ...Object.keys(connect || {})
  ]);

  @composedDecorators
  @skinnable(contains(loadingDecorator(Component)))
  @pure
  @props(propsTypes)
  class ContainerFactoryWrapper extends React.Component { // eslint-disable-line react/no-multi-comp

    static displayName = displayName(Component, 'Container');

    getLocals(props) {
      const { readyState } = props;
      if (!readyState) {
        return getLocals(props);
      } else if (isReady(props)) {
        return { ...stripUndef({ readyState }), ...getLocals(props) };
      } else {
        return stripUndef({ readyState });
      }
    }

  }

  return ContainerFactoryWrapper;
};

const defaultWithConnectOnly = decorator(DecoratorConfig({ declareConnect: defaultDeclareConnect }));

export default (...args) => t.match(args[0],
  t.Function, () => defaultWithConnectOnly(...args),
  DecoratorConfig, () => decorator(args[0]),
  PublicDecoratorConfig, () => {
    const {
      declareQueries: dq, allQueries, declareCommands: dc, allCommands,
      declareConnect = defaultDeclareConnect
    } = args[0];
    const declareQueries = dq || (allQueries && _declareQueries(allQueries)) || undefined;
    const declareCommands = dc || (allCommands && _declareCommands(allCommands)) || undefined;
    return decorator({ declareConnect, declareQueries, declareCommands });
  }
);
