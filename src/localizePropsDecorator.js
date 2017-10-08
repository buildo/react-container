import React from 'react';
import { skinnable, contains } from 'revenge';
import * as t from 'io-ts';
import { props } from 'prop-types-ts';
import mapKeys from 'lodash/mapKeys';
import mapValues from 'lodash/mapValues';
import reduce from 'lodash/reduce';
import pick from 'lodash/pick';
import omit from 'lodash/omit';
import omitByF from 'lodash/fp/omitBy';
import isEqualF from 'lodash/fp/isEqual';
import isNil from 'lodash/isNil';
import displayName from './displayName';

const omitNils = omitByF(isNil);
const omitEmpties = omitByF(isEqualF({}));

export default function localizePropsDecorator({ containerNamespace, local }) {

  const localKeys = Object.keys(local);
  const globalizedLocalKeys = localKeys.map(k => `${containerNamespace}${k}`);

  const globalizeLocalKeys = obj => mapKeys(obj, (_, k) => {
    if (local[k]) {
      return `${containerNamespace}${k}`;
    }
    return k;
  });

  const globalizedLocalTypes = globalizeLocalKeys(mapValues(local, ty => {
    return t.union([t.undefined, t.dictionary(t.string, ty)]);
  }) || {});

  const decorator = Component => {
    @skinnable(contains(Component))
    @props({
      ___local: t.union([t.undefined, t.interface(globalizedLocalTypes)]),
      transition: t.Function
    }, { strict: false })
    class LocalizePropsWrapper extends React.Component {
      static displayName = displayName(Component, 'localizeProps');

      static _instanceCount = 0;

      globalizeLocalState = obj => reduce(obj, (acc, v, k) => {
        const globalKey = `${containerNamespace}${k}`;

        const { ___local = {} } = this.props;

        return {
          ...acc,
          [globalKey]: omitNils({
            ...___local[globalKey],
            [this.instanceNamespace]: v
          })
        };
      }, {});

      localizeLocalState = obj => reduce(obj, (acc, v, k) => {
        const localKey = k.replace(containerNamespace, '');
        return {
          ...acc,
          [localKey]: local[localKey] && v ? v[this.instanceNamespace] : v
        };
      }, {});

      transitionWithLocal = (...args) => {
        if (args.length === 1 && t.Dictionary.is(args[0])) {
          const patch = args[0];
          const localProps = this.globalizeLocalState(pick(patch, localKeys));
          const globalProps = omit(patch, localKeys);

          return this.props.transition(oldstate => ({
            ...oldstate,
            ...globalProps,
            ___local: omitEmpties({
              ...oldstate.___local,
              ...localProps
            })
          }));
        }
        throw new Error(`Sorry, local transitions do not yet support arguments ${args.map(v => typeof v).join(',')}`);
      }

      localizeProps = ({ ___local = {}, ...props }) => ({
        ...props,
        ...this.localizeLocalState(pick(___local, globalizedLocalKeys)),
        transition: this.transitionWithLocal
      });

      getLocals = this.localizeProps;

      componentWillMount = () => {
        LocalizePropsWrapper._instanceCount += 1; // eslint-disable-line operator-assignment
        this.instanceNamespace = `instance-${LocalizePropsWrapper._instanceCount}`;
      }

      componentWillUnmount = () => {
        // cleanup local keys when dead
        setTimeout(() => {
          this.transitionWithLocal(mapValues(local, () => undefined));
        });
      }
    }
    return LocalizePropsWrapper;
  };
  decorator.GlobalDeclaration = globalizedLocalTypes;
  decorator.Type = { ...local, transition: t.Function };

  return decorator;
}
