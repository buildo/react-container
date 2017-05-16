import React from 'react';
import { skinnable, contains } from 'revenge';
import { t, props } from 'tcomb-react';
import mapKeys from 'lodash/mapKeys';
import mapValues from 'lodash/mapValues';
import reduce from 'lodash/reduce';
import displayName from './displayName';

export default function localizePropsDecorator({ containerNamespace, local }) {
  const globalizeLocalKeys = obj => mapKeys(obj, (_, k) => {
    if (local[k]) {
      return `${containerNamespace}${k}`;
    }
    return k;
  });

  const globalizedLocalTypes = globalizeLocalKeys(mapValues(local, ty => {
    return t.maybe(t.dict(t.String, ty));
  }) || {});

  const decorator = Component => {
    @skinnable(contains(Component))
    @props({
      ...globalizedLocalTypes,
      transition: t.Function
    }, { strict: false })
    class LocalizePropsWrapper extends React.Component {
      static displayName = displayName(Component, 'localizeProps');

      static _instanceCount = 0;

      globalizeLocalState = obj => reduce(obj, (acc, v, k) => {
        const globalKey = local[k] ? `${containerNamespace}${k}` : k;
        return {
          ...acc,
          [globalKey]: local[k] ? {
            ...this.props[globalKey],
            [this.instanceNamespace]: v
          } : v
        };
      }, {});

      localizeLocalState = obj => reduce(obj, (acc, v, k) => {
        const localKey = k.replace(containerNamespace, '');
        return {
          ...acc,
          [localKey]: local[localKey] && v ? v[this.instanceNamespace] : v
        };
      }, {});

      localizeProps = props => this.localizeLocalState({
        ...props,
        transition: (...args) => {
          if (args.length === 1 && t.Object.is(args[args.length - 1])) {
            const globalizedProps = this.globalizeLocalState(args[args.length - 1]);
            return props.transition(globalizedProps);
          }
          throw new Error(`Sorry, local transitions do not yet support arguments ${args.map(v => typeof v).join(',')}`);
        }
      });

      getLocals = this.localizeProps;

      componentWillMount = () => {
        LocalizePropsWrapper._instanceCount += 1; // eslint-disable-line operator-assignment
        this.instanceNamespace = `instance-${LocalizePropsWrapper._instanceCount}`;
      }

      componentWillUnmount = () => {
        // cleanup local keys when dead
        setTimeout(() => {
          this.props.transition(mapValues(globalizedLocalTypes, (_, k) => {
            if (typeof this.props[k] !== 'undefined') {
              delete this.props[k][this.instanceNamespace];
            }
          }));
        });
      }
    }
    return LocalizePropsWrapper;
  };
  decorator.GlobalDeclaration = globalizedLocalTypes;
  decorator.Type = { ...local, transition: t.Function };

  return decorator;
}
