import pickBy from 'lodash/fp/pickBy';
import mapValues from 'lodash/mapValues';

const stripUndefineds = pickBy(x => typeof x !== 'undefined');

const mergeReadyState = (accReadyState = {}, newReadyState) => {
  return mapValues(newReadyState, (newQueryRs, queryName) => {
    const accQueryRs = accReadyState[queryName] || {};
    return {
      ...newQueryRs,
      ready: newQueryRs.ready || accQueryRs.ready || false // possibly remain "ready" based on old props
    };
  });
};

export const cacheQueryValues = (acc = {}, newProps) => {
  const nextProps = {
    ...acc,
    ...stripUndefineds(newProps),
    readyState: mergeReadyState(acc.readyState, newProps.readyState)
  };
  return {
    accumulator: nextProps,
    props: nextProps
  };
};
