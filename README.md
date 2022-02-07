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
Query: { "animals": { "0": { "name": true, "kind": [] } } }
Output: { "animals": [ { "name": "Luna", "kind": "dog" } ] }
```
To rename a property use the property accessor. The following assigns **name** to **first_name**
```
Query: { "animals": { "0": { "first_name": [ "name" ] } } }
Output: { "animals": [ { "first_name": "Luna" } ] }
```
In general anything inside **{}** represents the structure of the output. Anything inside **[]** is a transformation of the current object. Property access is the simplest transformation, and in the case of empty **[]** the name of the property is taken from the query. So, **{ name: ['name'] }** and **{ name: [] }** are equivalent
Transformations can be chained. The output of the first is input to the next
```
Query: { "Luna is": [ [ "animals" ], [ 0 ], [ "is" ] ] }
Output: { "Luna is": "feisty" }
```
To assign a constant value, enclose it in double square brackets
```
Query: { "static": [ [ "This can be anything, including a static array" ] ] }
Output: { "static": "This can be anything, including a static array" }
```
Custom or built-in functions can be used. The function syntax is **["function_name", ...args]**. The function name can be anywhere in a chain of transformations. Anything after the function name is an argument. If an argument is an array, it is resolved the same as other transformations
```
Query: { "First Dog is": [ [ "animals" ], [ 0 ], "uppercase", [ "name" ] ] }
Output: { "First Dog is": "LUNA" }
```