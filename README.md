# Geschichte

![CircleCI](https://img.shields.io/circleci/build/gh/BowlingX/geschichte)
![Codecov](https://img.shields.io/codecov/c/github/bowlingx/geschichte)
![npm](https://img.shields.io/npm/v/geschichte)

Let's you manage query-parameters with hooks. Uses `immer` and `zustand` to manage the internal state.

Documentation: https://bowlingx.github.io/geschichte/index.html

API: https://bowlingx.github.io/geschichte/api/index.html

    yarn add geschichte
    
    npm install geschichte

## Basic Example

```typescript jsx

import { pm, factoryParameters, serializers } from 'geschichte'

const parameterConfig = {
  item: pm('queryParameter', serializers.string)
};

const defaultValue = {
  item: 'defaultValue'
}


const { useQuery } = factoryParameters(parameterConfig, defaultValue);

const Component = () => {
 const { values, pushState, replaceState } = useQuery()
 return (
   <>
     <button onClick={() => pushState((values) => void ( values.item = "newValue" ))}>push new state</button>
     <button onClick={() => replaceState((values) => void ( values.item = "anotherOne" ))}>replace state</button>
     <div>{JSON.stringify(values)}</div>
   </> 
 )
}
```
