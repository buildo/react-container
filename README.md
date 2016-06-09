### Import as

```js
import container from 'react-container'
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

### Use this forms to configure `react-avenger/queries`, `react-avenger/commands` or `state/connect`

All three are optional

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
