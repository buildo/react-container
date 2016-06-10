import React from 'react';
import pick from 'lodash/fp/pick';
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

const defaultDeclareConnect = (decl = {}, config = {}) => (
  _declareConnect(decl, { killProps: ['params', 'query', 'router'], ...config })
);

const decorator = ({ declareQueries, declareCommands, declareConnect }) => (Component, config = {}) => {
  const {
    connect, queries, commands,
    loadingDecorator = noLoaderLoading, // force a "safety" loader
    mapProps,
    __DO_NOT_USE_additionalPropTypes: __props
  } = ContainerConfig(config);

  const declaredQueries = queries && declareQueries(queries);
  const declaredCommands = commands && declareCommands(commands);
  const declaredConnect = connect && declareConnect(connect);
  const loader = queries && loadingDecorator;
  const propsTypes = {
    ...(queries ? declaredQueries.Type : {}),
    ...(commands ? declaredCommands.Type : {}),
    ...(connect ? declaredConnect.Type : {}),
    ...(__props ? __props : {})
  };
  const composedDecorators = flowRight(...compact([
    declaredQueries,
    declaredCommands,
    declaredConnect,
    loader
  ]));

  const getLocals = mapProps || pick([
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
    getLocals = getLocals
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
