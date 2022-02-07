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
{ "animals": { "0": { "name": true, "kind": [] } } }
{ "animals": [ { "name": "Luna", "kind": "dog" } ] }
```
To rename a property use the property accessor. The following assigns **name** to **first_name**
```
{ "animals": { "0": { "first_name": [ "name" ] } } }
{ "animals": [ { "first_name": "Luna" } ] }
```
In general anything inside **{}** represents the structure of the output. Anything inside **[]** is a transformation of the current object. Property access is the simplest transformation, and in the case of empty **[]** the name of the property is taken from the query. So, *{ name: ['name'] }* and *{ name: [] }* are equivalent
Transformations can be chained. The output of the first is input to the next
```
{ "Luna is": [ [ "animals" ], [ 0 ], [ "is" ] ] }
{ "Luna is": "feisty" }
```