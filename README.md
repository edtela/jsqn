# jsqn
JSON Query Notation
Example Data: 
```json
[
 {
  "kind": "dog",
  "name": "Luna",
  "is": "feisty",
  "weight": 10
 },
 {
  "kind": "cat",
  "name": "Ola",
  "is": "playful",
  "weight": 5
 },
 {
  "kind": "dog",
  "name": "Bobo",
  "is": "thoughtful",
  "weight": 20
 },
 {
  "kind": "lion",
  "name": "King",
  "is": "thoughtful",
  "weight": 100
 }
]
```
To select properties mark them **true** or with empty accesor **[]**
```
Selector: { "0": { "name": true, "kind": [] } }
Output: [ { "name": "Luna", "kind": "dog" } ]
```
To select all properties use "*" operator
```
Selector: { "0": { "*": true, "is": false, "weight": false } }
Output: [ { "name": "Luna", "kind": "dog" } ]
```
To rename a property use the property accessor. The following assigns **name** to **first_name**
```
Selector: { "0": { "first_name": [ "name" ] } }
Output: [ { "first_name": "Luna" } ]
```
Object selection distributes through arrays. The following selects **name** for all animals
```
Selector: { "name": [] }
Output: [ { "name": "Luna" }, { "name": "Ola" }, { "name": "Bobo" }, { "name": "King" } ]
```
In general anything inside **{}** represents the structure of the output. Anything inside **[]** is a transformation of the current object. Property access is the simplest transformation, and in the case of empty **[]** the name of the property is taken from the selector. So, **{ name: ['name'] }** and **{ name: [] }** are equivalent
Transformations can be chained. The output of the first is input to the next
```
Selector: { "Luna is": [ [ 0 ], [ "is" ] ] }
Output: { "Luna is": "feisty" }
```
To assign a constant value, enclose it in double square brackets
```
Selector: { "static": [ [ 1 ], [ [ "This can be anything, including a static array" ] ] ] }
Output: { "static": "This can be anything, including a static array" }
```
Custom or built-in functions can be used. The function syntax is **["function_name", ...args]**. The function name can be anywhere in a chain of transformations. Anything after the function name is an argument. If an argument is an array, it is resolved the same as other transformations
```
Selector: { "First Dog is": [ [ 0 ], "uppercase", [ "name" ] ] }
Output: { "First Dog is": "LUNA" }
```
## Filtering
Filtering is specified using the **?** operator as key and a predicate as value. A primitive value implies equality
```
Selector: { "name": true, "?": { "kind": "cat" } }
Output: [ { "name": "Ola" } ]
```
A filter can appear anywhere in a path. Unlike the previous example, **kind** is included in the output since it appears in the selector path rather than the predicate. The predicate uses RegExp operator.
```
Selector: { "name": true, "kind": { "?": { "~": ".*at" } } }
Output: [ { "name": "Ola", "kind": "cat" } ]
```
Conditions can be AND-ed using **{}**
```
Selector: { "name": true, "?": { "kind": "dog", "name": "Bobo" } }
Output: [ { "name": "Bobo" } ]
```
Conditions can be OR-ed using **[]**
```
Selector: { "name": true, "?": [ { "kind": "lion" }, { "name": "Ola" } ] }
Output: [ { "name": "Ola" }, { "name": "King" } ]
```
## Aggregation
Aggregation is specified by setting selection to an aggregation function. Properties that have no aggregation function are grouped
```
Selector: { "kind": true, "weight": "sum", "?": { "kind": { "!": "lion" } } }
Output: [ { "kind": "dog", "weight": 30 }, { "kind": "cat", "weight": 5 } ]
```
Data can be transformed prior to aggregation by specifying transforms after the aggregation function
```
Selector: { "names": [ "values", "uppercase", [ "name" ] ], "kind": { "?": { "!": "lion" } } }
Output: [ { "kind": "dog", "names": [ "LUNA", "BOBO" ] }, { "kind": "cat", "names": [ "OLA" ] } ]
```
## Sorting
Sorting is specified by setting selection to a number. A negative number specifies descending order. The absolute value of the number specifies the order of properties when sorting by multiple properties. The following sorts first by **kind** ascending, then by **weight** descdending 
```
Selector: { "name": true, "kind": 1, "weight": -2, "?": { "kind": [ "cat", "dog" ] } }
Output: [ { "kind": "cat", "name": "Ola", "weight": 5 }, { "kind": "dog", "name": "Bobo", "weight": 20 }, { "kind": "dog", "name": "Luna", "weight": 10 } ]
```
Data can be transformed prior to sorting by specifying transforms after the sort
```
Selector: { "name": true, "kind": [ 1, "uppercase", [] ], "weight": -2, "?": { "kind": [ "cat", "dog" ] } }
Output: [ { "kind": "CAT", "name": "Ola", "weight": 5 }, { "kind": "DOG", "name": "Bobo", "weight": 20 }, { "kind": "DOG", "name": "Luna", "weight": 10 } ]
```
## Arrays
Arrays can be manipulated just like objects. If keys of a selector are numeric, the result is an array rather than object. The following copies object to array
```
Selector: { "0": { "0": [ "kind" ], "1": [ "name" ] } }
Output: [ [ "dog", "Luna" ] ]
```
When indexed with positive numbers, the resulting array is considered a tuple, i.e. indices specified exist regardless of empty spaces.
```
Selector: { "0": { "1": [ "kind" ], "3": [ "name" ], "4": [ "not defined" ] } }
Output: [ [ null, "dog", null, "Luna", null ] ]
```
Use negative numbers to specify just ordering and ignore undefined values
```
Selector: { "0": { "-10": [ "kind" ], "-15": [ "not defined" ], "-20": [ "name" ], "-21": [ "not defined" ] } }
Output: [ [ "dog", "Luna" ] ]
```
The following copies array to object
```
Selector: { "First is named": [ [ 0 ], [ "name" ] ], "Second is": [ [ 1 ], [ "kind" ] ] }
Output: { "First is named": "Luna", "Second is": "cat" }
```
Negative indices access the array from the end
```
Selector: { "Last is named": [ [ -1 ], [ "name" ] ], "Second to last is": [ [ -2 ], [ "kind" ] ] }
Output: { "Last is named": "King", "Second to last is": "dog" }
```
And this fixes just the second index
```
Selector: { "1": [ [ 0 ], [ "name" ] ], "-200": [ [ 1 ], [ "name" ] ], "-300": [ [ -2 ], [ "name" ] ] }
Output: [ "Ola", "Luna", "Bobo" ]
```
