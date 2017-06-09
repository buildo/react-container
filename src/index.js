import React from 'react';
import difference from 'lodash/difference';
import omit from 'lodash/fp/omit';
import pick from 'lodash/fp/pick';
import omitByF from 'lodash/fp/omitBy';
import compact from 'lodash/compact';
import flowRight from 'lodash/flowRight';
import isUndefined from 'lodash/isUndefined';
import identity from 'lodash/identity';
import { t, props } from 'tcomb-react';
import { skinnable, pure, contains } from 'revenge';
import _declareQueries from 'react-avenger/lib/queries';
import _declareCommands from 'react-avenger/lib/commands';
import { defaultIsReady } from 'react-avenger/lib/loading';
import _displayName from './displayName';
import reduceQueryPropsDecorator from './reduceQueryPropsDecorator/decorator';
export { cacheQueryValues } from './reduceQueryPropsDecorator/reducers';
import localizePropsDecorator from './localizePropsDecorator';

const stripUndef = omitByF(isUndefined);

const ContainerConfig = t.interface({
  isReady: t.maybe(t.Function),
  connect: t.maybe(t.list(t.String)),
  local: t.maybe(t.dict(t.String, t.Type)),
  queries: t.maybe(t.list(t.String)),
  commands: t.maybe(t.list(t.String)),
  reduceQueryProps: t.maybe(t.Function),
  mapProps: t.maybe(t.Function),
  propTypes: t.maybe(t.dict(t.String, t.Type)),
  pure: t.maybe(t.Boolean),
  querySync: t.maybe(t.Boolean)
}, { strict: true, name: 'ContainerConfig' });

const DecoratorConfig = t.interface({
  declareConnect: t.Function,
  declareQueries: t.maybe(t.Function),
  declareCommands: t.maybe(t.Function)
}, { strict: true, name: 'DecoratorConfig' });

const PublicDecoratorConfig = DecoratorConfig.extend({
  allQueries: t.maybe(t.Object),
  allCommands: t.maybe(t.Object)
}, { strict: true, name: 'PublicDecoratorConfig' });

let _containerCounter = 0;
export function isLocalKey(key) {
  return key === '___local';
}

const decorator = ({ declareQueries, declareCommands, declareConnect }) => (Component, config = {}) => {
  const {
    isReady = defaultIsReady,
    connect, local, queries, commands,
    reduceQueryProps: reduceQueryPropsFn,
    mapProps,
    propTypes: __props,
    pure: __pure = true,
    querySync = typeof window === 'undefined'
  } = ContainerConfig(config);

  const displayName = _displayName(Component, 'Container');
  _containerCounter += 1; // eslint-disable-line operator-assignment
  const containerNamespace = `${displayName}-${_containerCounter}__`;
  const localizeProps = local && localizePropsDecorator({ containerNamespace, local });

  const declaredQueries = queries && declareQueries(queries, { querySync });
  const queriesInputTypes = queries && Object.keys(declaredQueries.InputType) || [];
  const declaredCommands = commands && declareCommands(commands);
  const commandsInputTypes = commands && Object.keys(declaredCommands.InputType) || [];
  const declaredConnect = (connect || local || queries || commands) && declareConnect([
    ...omit(queriesInputTypes, Object.keys(local || {})),
    ...omit(commandsInputTypes, Object.keys(local || {})),
    ...(connect || [])
  ].concat(local ? ['___local'] : []));
  const reduceQueryProps = queries && reduceQueryPropsFn && reduceQueryPropsDecorator({ queries, reducer: reduceQueryPropsFn });

  const propsTypes = {
    ...(__props ? __props : {}),
    ...(queries ? declaredQueries.Type : {}),
    ...(commands ? declaredCommands.Type : {}),
    ...(queries || commands ? { transition: t.Function } : {}),
    ...(connect ? declaredConnect.Type : {}),
    ...(local ? localizeProps.Type : {})
  };

  // used to filer out props that are "unwanted" below
  const cleanProps = omit(difference(
    Object.keys({ ...queriesInputTypes, ...commandsInputTypes }),
    (connect || []).concat(Object.keys(local || {})).concat(Object.keys(__props || {})).concat(queries || []).concat(commands || [])
  ));

  const composedDecorators = flowRight(...compact([
    declaredConnect,
    localizeProps,
    declaredQueries,
    reduceQueryProps,
    declaredCommands
  ]));

  const pureDecorator = __pure ? pure : identity;

  const getLocals = mapProps || pick([
    ...(queries || []),
    ...(commands || []),
    ...(connect || []),
    ...Object.keys({ ...(local || {}), ...(__props || {}) })
  ]);

  @composedDecorators
  @skinnable(contains(Component))
  @pureDecorator
  @props(propsTypes)
  class ContainerFactoryWrapper extends React.Component { // eslint-disable-line react/no-multi-comp

    static displayName = displayName;

    getLocals(_props) {
      const props = cleanProps(_props);
      const { readyState } = props;
      if (!readyState) {
        // this means there are no `queries` defined
        return getLocals(props);
      } else if (isReady(props)) {
        const locals = getLocals(props);
        // this is needed to support the possible `return null`
        // from `skinnable(contains(Component)).getLocals`
        return locals === null ? locals : { ...stripUndef({ readyState }), ...locals };
      } else {
        return stripUndef({ readyState });
      }
    }

  }

  return ContainerFactoryWrapper;
};


export default config => {

  const declareConnect = (decl = [], connectConfig = {}) => (
    config.declareConnect(decl, { killProps: ['params', 'query', 'router'], ...connectConfig })
  );


  return t.match(config,
    DecoratorConfig, () => decorator({ ...config, declareConnect }),
    PublicDecoratorConfig, () => {
      const {
        declareQueries: dq, allQueries, declareCommands: dc, allCommands
      } = config;
      const declareQueries = dq || (allQueries && _declareQueries(allQueries)) || undefined;
      const declareCommands = dc || (allCommands && _declareCommands(allCommands)) || undefined;
      return decorator({ declareConnect, declareQueries, declareCommands });
    }
  );
};
