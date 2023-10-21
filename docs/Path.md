## DataPath

### ForwardDataPath

SelectのOptionのkey/valueなど、最適化の観点から階層を上に上がってほしくない場合に使うパス

### EditingForwardDataPath

ForwardDataPathに加えて、PointerPathComponentを許容したパス。
編集中の要素を表すには重複するキーを考慮しなければならないため、UIModel上で扱うパスは基本的にこれになる

### DataPathComponent (single)

ForwardDataPathから階層を上に遡ることができるように拡張されたパス

### MultiDataPathComponent

Selectのoptionのパスなど、複数要素を指定可能なパス

## DataModelContext

## UIModelDataPathContext

以下の意図がありそう
- DataModelが途中から存在しなくても編集対象のパスを表せるようにする
- 親の要素から自身の要素へのpointerを保持できる($key の編集コンポーネントをbuildするため)

## UISchemaContext