import React from 'react';
import { skinnable, contains } from 'revenge';
import { t, props } from 'tcomb-react';
import mapKeys from 'lodash/mapKeys';
import mapValues from 'lodash/mapValues';
import displayName from './displayName';

export default function localizePropsDecorator({ containerNamespace, local }) {
  const globalizeLocalKeys = obj => mapKeys(obj, (_, k) => {
    if (local[k]) {
      return `${containerNamespace}${k}`;
    }
    return k;
  });
  const localizeLocalKeys = obj => mapKeys(obj, (_, k) => {
    return k.replace(containerNamespace, '');
  });
  const globalizedLocalTypes = globalizeLocalKeys(local || {});
  const localizeProps = props => localizeLocalKeys({
    ...props,
    transition: (...args) => {
      if (args.length === 1 && t.Object.is(args[args.length - 1])) {
        return props.transition(globalizeLocalKeys(args[args.length - 1]));
      }
      throw new Error(`Sorry, local transitions do not yet support arguments ${args.map(v => typeof v).join(',')}`);
    }
  });

  const decorator = Component => {
    @skinnable(contains(Component))
    @props({
      ...globalizedLocalTypes,
      transition: t.Function
    }, { strict: false })
    class LocalizePropsWrapper extends React.Component {
      static displayName = displayName(Component, 'localizeProps');

      getLocals = localizeProps;

      componentWillUnmount = () => {
        // cleanup local keys when dead
        setTimeout(() => {
          this.props.transition(mapValues(globalizedLocalTypes, () => null));
        });
      }
    }
    return LocalizePropsWrapper;
  };
  decorator.GlobalDeclaration = globalizedLocalTypes;
  decorator.Type = { ...local, transition: t.Function };

  return decorator;
}
