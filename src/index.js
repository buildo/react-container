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
import { defaultIsReady } from 'react-avenger/lib/loading';
import displayName from './displayName';
import reduceQueryPropsDecorator from './reduceQueryPropsDecorator';

const stripUndef = omitByF(isUndefined);

const ContainerConfig = t.interface({
  isReady: t.maybe(t.Function),
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

const defaultDeclareConnect = (decl = {}, config = {}) => (
  _declareConnect(decl, { killProps: ['params', 'query', 'router'], ...config })
);

const decorator = ({ declareQueries, declareCommands, declareConnect }) => (Component, config = {}) => {
  const {
    isReady = defaultIsReady,
    connect, queries, commands,
    reduceQueryProps: reduceQueryPropsFn,
    mapProps,
    propTypes: __props
  } = ContainerConfig(config);

  const declaredQueries = queries && declareQueries(queries);
  const declaredCommands = commands && declareCommands(commands);
  const declaredConnect = connect && declareConnect(connect);
  const reduceQueryProps = queries && reduceQueryPropsFn && reduceQueryPropsDecorator({ queries, reducer: reduceQueryPropsFn });

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
  @skinnable(contains(Component))
  @pure
  @props(propsTypes)
  class ContainerFactoryWrapper extends React.Component { // eslint-disable-line react/no-multi-comp

    static displayName = displayName(Component, 'Container');

    getLocals(props) {
      const { readyState } = props;
      if (!readyState) {
        return getLocals(props);
      } else if (isReady(props)) {
        const locals = getLocals(props);
        return locals === null ? locals : { ...stripUndef({ readyState }), ...locals };
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
