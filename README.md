# Geschichte

Let's you manage query-parameters with hooks. Uses `immer` and `zustand` to manage the internal state.

## Example

```typescript jsx

import { pm, factoryParameters, serializers } from 'geschichte'

const parameterConfig = {
  your: {
    object: {
      somewhere: pm('queryParameter', serializers.string)  
    }   
  } 
};

const defaultValue = {
  your: {
    object: {
      somewhere: 'defaultValue'
    }
  }
}


const { useQuery } = factoryParameters(parameterConfig, defaultValue);

const Component = () => {
 const { values, pushState, replaceState } = useQuery()
 return (
   <>
     <button onClick={() => pushState((values) => void ( values.your.object.somewhere = "newValue" ))}>push new state</button>
     <button onClick={() => replaceState((values) => void ( values.your.object.somewhere = "anotherOne" ))}>replace state</button>
     <div>{JSON.stringify(values)}</div>
   </> 
 )
}
```
