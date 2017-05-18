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
