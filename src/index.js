import React from 'react';
import pick from 'lodash/fp/pick';
import compact from 'lodash/compact';
import flowRight from 'lodash/flowRight';
import mapKeys from 'lodash/mapKeys';
import mapValues from 'lodash/mapValues';
import { t, props } from 'tcomb-react';
import { skinnable, pure, contains } from 'revenge';
import _declareConnect from 'state/connect';
import _declareQueries from 'react-avenger/queries';
import _declareCommands from 'react-avenger/commands';
import noLoaderLoading from './noLoaderLoading';
import _displayName from './displayName';

const ContainerConfig = t.interface({
  loadingDecorator: t.maybe(t.Function),
  connect: t.maybe(t.dict(t.String, t.Type)),
  local: t.maybe(t.dict(t.String, t.Type)),
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
}, { strict: true, name: 'PublicDecoratorConfig' });

const reduceQueryPropsReturn = queries => t.interface({
  accumulator: t.Any,
  props: t.interface(
    queries.reduce((ac, k) => ({ ...ac, [k]: t.Any }), {}),
    { strict: true }
  )
}, { strict: true, name: 'ReduceQueryPropsReturn' });

const defaultDeclareConnect = (decl = {}, config = {}) => (
  _declareConnect(decl, { killProps: ['params', 'query', 'router'], ...config })
);

let _containerCounter = 0;

const decorator = ({ declareQueries, declareCommands, declareConnect }) => (Component, config = {}) => {
  const {
    connect, local, queries, commands,
    loadingDecorator = noLoaderLoading, // force a "safety" loader
    reduceQueryProps: reduceQueryPropsFn,
    mapProps,
    __DO_NOT_USE_additionalPropTypes: __props
  } = ContainerConfig(config);

  const displayName = _displayName(Component, 'Container');

  _containerCounter += 1; // eslint-disable-line operator-assignment
  const containerNamespace = `__${displayName}-${_containerCounter}__`;
  const globalizeLocalKeys = obj => mapKeys(obj, (_, k) => {
    if (local[k]) {
      return `${containerNamespace}${k}`;
    }
    return k;
  });
  const localizeLocalKeys = obj => mapKeys(obj, (_, k) => {
    return k.replace(containerNamespace, '');
  });
  const globalizedLocal = globalizeLocalKeys(local || {});

  const reduceQueryPropsDecorator = () => {
    const pickQueries = pick([...(queries || [])]);
    const ReduceQueryPropsReturn = reduceQueryPropsReturn(queries);

    return Component => (
      class ReduceQueryPropsWrapper extends React.Component {

        static displayName = _displayName(Component, 'reduceQueryProps');

        state = {};

        componentWillReceiveProps(newProps) {
          const rqp = reduceQueryPropsFn(this.state.queryPropsAccumulator, pickQueries(newProps));
          t.assert(ReduceQueryPropsReturn.is(rqp), () => `
            \`queryPropsAccumulator\` should return a \`{ props, accumulator }\` object.
            \`props\` should conform to declared queries, no additional keys are allowed.
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

  const declaredQueries = queries && declareQueries(queries);
  const reduceQueryProps = queries && reduceQueryPropsFn && reduceQueryPropsDecorator();
  const declaredCommands = commands && declareCommands(commands);
  const declaredConnect = (connect || local) && declareConnect({
    ...(connect || {}),
    ...((local && globalizedLocal) || {})
  });
  const loader = queries && loadingDecorator;
  const propsTypes = {
    ...(__props ? __props : {}),
    ...(queries ? declaredQueries.Type : {}),
    ...(commands ? declaredCommands.Type : {}),
    ...(connect ? declaredConnect.Type : {}),
    ...(local ? { ...globalizedLocal, transition: t.Function } : {})
  };
  const composedDecorators = flowRight(...compact([
    declaredQueries,
    reduceQueryProps,
    declaredCommands,
    declaredConnect,
    loader
  ]));

  const getLocals = mapProps || localizeLocalKeys(pick([
    ...(queries || []),
    ...(commands || []),
    ...Object.keys({ ...(connect || {}), ...globalizedLocal })
  ]));

  @composedDecorators
  @skinnable(contains(Component))
  @pure
  @props(propsTypes)
  class ContainerFactoryWrapper extends React.Component { // eslint-disable-line react/no-multi-comp
    static displayName = displayName;
    containerNamespace = containerNamespace;
    getLocals = props => {
      if (props.transition && local) {
        // TODO: this only supports the "object" form of `transition`
        // not the "function" one
        return getLocals(localizeLocalKeys({
          ...props,
          transition: obj => {
            if (t.Object.is(obj)) {
              return props.transition(globalizeLocalKeys(obj));
            }
            return props.transition(obj);
          }
        }));
      }
      return getLocals(props);
    }
    componentWillUnmount = () => {
      if (local) {
        setTimeout(() => {
          this.props.transition(mapValues(globalizedLocal, () => null));
        });
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
