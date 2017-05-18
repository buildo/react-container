### Import as

```js
import container from 'buildo-react-container'
```

### All the following should be valid usage examples

```js
export default container(MyComponent)
```

```js
export default container(MyComponent, {
  connect: { param1: Type1 }
})
```

```js
export default container(MyComponent, {
  mapProps: ({ a, b }) => ({ aAndB: `${a}&${b}` })
})
```

```js
export default container(MyComponent, {
  queries: ['query1', 'query2']
})
```

```js
export default container(MyComponent, {
  commands: ['cmd1']
})
```

### This could be a "typical" usage

```js
export default container(MyComponent, {
  connect: { a: t.String },
  mapProps: ({ a, b, cmd1 }) => ({
    aAndB: `${a}&${b}`,
    onClick: cmd1
  }),
  queries: ['b'],
  commands: ['cmd1']
})
```

### Usage on node and/or SSR project:

When we have a single render shot (SSR on node), we must opt-in to `querySync` so that at the first render we have all the data we need to produce a full HTML. See also https://github.com/buildo/react-avenger/blob/master/src/queries.js#L38-L47

```js
export default container(MyComponent, {
  querySync: true,
  queries: ['b']
})
```

### If you need to add additional prop types...

(other than the ones derived from queries/commands/connect)

```js
export default container(MyComponent, {
  propTypes: { myProp: MyType },
  // ...
});
```

### Use this forms to configure `react-avenger/queries`, `react-avenger/commands` or `state/connect`

This should be done only once in a project, typically in a custom `app/container` file or folder.

```js
const containerFactory = container({
  declareConnect: declareConnect(/* declareConnect config */)
  allQueries: { /* all queries */ },
  allCommands: { /* all commands */ }
})

export default containerFactory(MyComponent, {
  /* container cfg */
})
```

### Notes about caching query values in a container instance

When we declare queries in a `container` we are delegating to avenger (and the query definition) the decision about refetching or not, given a possibly outdated value currently available in the cache.

From the `container` (component) perspective instead, closer to rendering the actual UI, we have slightly different concerns:
- should we render a loader if data is nota vailable yet?
- should we render loading states alongside UI for the data if we are both "loading" and "ready to render"
- should we wait for "fresh" data before rendering (i.e. if we are both "loading" and "ready to render", should we wait for the updated values aka to be "not loading anymore")

These kind of things are generally solved by customizing a `loading` decorator, that normally receives the plain `data` and `readyState` as avenger produces it.

There are specific cases though, where, as a container instance currently rendering some UI, we need to manipulate intermediate/stale data obtained from avenger *before* feeding it into our UI/loading. `container` is per se *stateless*. Here we need instead to accumulate state between multiple container re-renderings. In this cases we should resort to the `reduceQueryProps` api:

```js
container(MyComponent, {
  reduceQueryProps: (accumulator: Any, propsFromQueries: PropsFromQueries) => ({
    accumulator: Any,        // accumulator for the next re-render, if needed
    props: PropsFromQueries  // the actual props passed down at this render: you can map/change `readyState` and any query as you wish here
  })
})
```

Since there are only a few useful known usages, here we'll just list them and explain the use case.

**default** *(no `reduceQueryProps`)*

In the large majority of cases, this is what we want. As soon as we have a value for a query, we'll pass it down. As soon as some event causes the query the refetch, we'll pass the `readyState.loading` state down as well. We stay stateless.

If the query is refetched with a different input, we'll get notified and *loose* the previous value we got (it was indeed for a different input) and we pass through a "no data" state. This last example is uncommon since typically, during the whole container lifecycle, inputs for the queries it declares do not change.

**cache query values**

When the lifecycle of the component spans multiple instances of the same query class (i.e.: the declared query is refetched with different inputs *while we are still mounted*), we'll typically want to preserve data (and thus UI) across multiple instances.

Two example use cases to clarify:
- A query that produces a value also based on user input. User writes in a form, the query refetches with new inputs at every keystroke, we need to keep rendering the value computed, even if it was for the previous input.
- When we have data arranged in a sortable list, and the sorting is performed by the api: if the user sorts by a different param, we'll typically want to:
  - (maybe) show a loader while we are retrieving the updated sorted results
  - keep showing the stale data we have (in other words: avoid passing by "empty list" states, while waiting for the re-sorted data)
  
For this scenario, `container` exports a custom `reduceQueryProps` function called `cacheQueryValues`. It can be used as follows:

```js
import container, { cacheQueryValues } from 'container';

container(MyComponent, {
  queries: ['sortedData'],
  reduceQueryProps: cacheQueryValues,
  // ...
})
```

