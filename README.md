# jsqn
JSON Query Notation
Example Data: 
```
{
 "animals": [
  {
   "kind": "dog",
   "name": "Luna",
   "is": "feisty"
  },
  {
   "kind": "cat",
   "name": "Ola",
   "is": "playful"
  },
  {
   "kind": "dog",
   "name": "Bobo",
   "is": "thoughtful"
  },
  {
   "kind": "lion",
   "name": "King",
   "is": "thoughtful"
  }
 ]
}
```
To select properties mark them **true** or with empty accesor **[]**
```
Selector: { "animals": { "0": { "name": true, "kind": [] } } }
Output: { "animals": [ { "name": "Luna", "kind": "dog" } ] }
```
To rename a property use the property accessor. The following assigns **name** to **first_name**
```
Selector: { "animals": { "0": { "first_name": [ "name" ] } } }
Output: { "animals": [ { "first_name": "Luna" } ] }
```
Object selection distributes through arrays. The following selects **name** for all animals
```
Selector: { "animals": { "name": [] } }
Output: { "animals": [ { "name": "Luna" }, { "name": "Ola" }, { "name": "Bobo" }, { "name": "King" } ] }
```
In general anything inside **{}** represents the structure of the output. Anything inside **[]** is a transformation of the current object. Property access is the simplest transformation, and in the case of empty **[]** the name of the property is taken from the selector. So, **{ name: ['name'] }** and **{ name: [] }** are equivalent
Transformations can be chained. The output of the first is input to the next
```
Selector: { "Luna is": [ [ "animals" ], [ 0 ], [ "is" ] ] }
Output: { "Luna is": "feisty" }
```
To assign a constant value, enclose it in double square brackets
```
Selector: { "static": [ [ "This can be anything, including a static array" ] ] }
Output: { "static": "This can be anything, including a static array" }
```
Custom or built-in functions can be used. The function syntax is **["function_name", ...args]**. The function name can be anywhere in a chain of transformations. Anything after the function name is an argument. If an argument is an array, it is resolved the same as other transformations
```
Selector: { "First Dog is": [ [ "animals" ], [ 0 ], "uppercase", [ "name" ] ] }
Output: { "First Dog is": "LUNA" }
```
## Filtering
A filter can be added using the **?** operator as key and a predicate as value. A primitive value implies equality
```
Selector: { "animals": { "name": true, "?": { "kind": "cat" } } }
Output: { "animals": [ { "name": "Ola" } ] }
```
A filter can appear anywhere in a path. Unlike the previous example, **kind** is included in the output since it appears in the selector path. The predicate uses RegExp operator.
```
Selector: { "animals": { "name": true, "kind": { "?": { "~": ".*at" } } } }
Output: { "animals": [ { "name": "Ola", "kind": "cat" } ] }
```
Conditions can be AND-ed using **{}**
```
Selector: { "animals": { "name": true, "?": { "kind": "dog", "name": "Bobo" } } }
Output: { "animals": [ { "name": "Bobo" } ] }
```
Conditions can be OR-ed using **[]**
```
Selector: { "animals": { "name": true, "?": [ { "kind": "lion" }, { "name": "Ola" } ] } }
Output: { "animals": [ { "name": "Ola" }, { "name": "King" } ] }
```