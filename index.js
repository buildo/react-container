import React from 'react';
import pick from 'lodash/fp/pick';
import pickBy from 'lodash/fp/pickBy';
import compact from 'lodash/compact';
import flowRight from 'lodash/flowRight';
import { t, props } from 'tcomb-react';
import { skinnable, pure, contains } from 'revenge';
import _declareConnect from 'state/connect';
import _declareQueries from 'react-avenger/queries';
import _declareCommands from 'react-avenger/commands';
import noLoaderLoading from './noLoaderLoading';

const ContainerConfig = t.interface({
  loadingDecorator: t.maybe(t.Function),
  connect: t.maybe(t.dict(t.String, t.Type)),
  queries: t.maybe(t.list(t.String)),
  commands: t.maybe(t.list(t.String)),
  reduceQueryProps: t.maybe(t.Function),
  mapProps: t.maybe(t.Function),
  __DO_NOT_USE_additionalPropTypes: t.maybe(t.dict(t.String, t.Type))
}, { strict: true, name: 'ContainerConfig' });

const DecoratorConfig = t.interface({
  declareConnect: t.maybe(t.Function),
  declareQueries: t.maybe(t.Function),
  declareCommands: t.maybe(t.Function)
}, { strict: true, name: 'DecoratorConfig' });

const PublicDecoratorConfig = DecoratorConfig.extend({
  allQueries: t.maybe(t.Object),
  allCommands: t.maybe(t.Object)
}, { strict: true, name: 'PublicDecoratorConfig' })

const ReduceQueryPropsReturn = t.interface({
  accumulator: t.Any,
  props: t.Object
}, { strict: true, name: 'ReduceQueryPropsReturn' });

const defaultDeclareConnect = (decl = {}, config = {}) => (
  _declareConnect(decl, { killProps: ['params', 'query', 'router'], ...config })
);

const defaultReduceQueryProps = (_, newProps) => ({ props: newProps });

const decorator = ({ declareQueries, declareCommands, declareConnect }) => (Component, config = {}) => {
  const {
    connect, queries, commands,
    loadingDecorator = noLoaderLoading, // force a "safety" loader
    reduceQueryProps = defaultReduceQueryProps,
    mapProps,
    __DO_NOT_USE_additionalPropTypes: __props
  } = ContainerConfig(config);

  const pickQueries = pick([...(queries || [])])

  const reduceQueryPropsDecorator = Component => (
    class ReduceQueryPropsWrapper extends React.Component {

      static displayName = `reduceQueryProps(${Component.displayName || Component.name || 'Component'})`;

      state = {};

      componentWillReceiveProps(newProps) {
        const rqp = ReduceQueryPropsReturn(
          reduceQueryProps(this.state.queryPropsAccumulator, pickQueries(newProps))
        );
        const { accumulator: queryPropsAccumulator, props: queryProps } = rqp;
        this.setState({
          queryPropsAccumulator, queryProps: pickQueries(queryProps)
        });
      }

      render() {
        return <Component {...{ ...this.props, ...this.state.queryProps }} />;
      }
    }
  );

  const declaredQueries = queries && declareQueries(queries);
  const _reduceQuryProps = queries && reduceQueryPropsDecorator;
  const declaredCommands = commands && declareCommands(commands);
  const declaredConnect = connect && declareConnect(connect);
  const loader = queries && loadingDecorator;
  const propsTypes = {
    ...(__props ? __props : {}),
    ...(queries ? declaredQueries.Type : {}),
    ...(commands ? declaredCommands.Type : {}),
    ...(connect ? declaredConnect.Type : {})
  };
  const composedDecorators = flowRight(...compact([
    declaredQueries,
    _reduceQuryProps,
    declaredCommands,
    declaredConnect,
    loader
  ]));

  const defaultMapProps = pick([
    ...(queries || []),
    ...(commands || []),
    ...Object.keys(connect || {})
  ]);

  @composedDecorators
  @skinnable(contains(Component))
  @pure
  @props(propsTypes)
  class ContainerFactoryWrapper extends React.Component {

    static displayName = `${Component.displayName || Component.name || 'Component'}Container`;

    getLocals = mapProps || defaultMapProps;

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
