`Anomix Sequencer` will each time bundle specified amount L2 user tx and aggregate their proofs into a `inner rollup proof`, and later aggregate `inner rollup proof` of given amount into a `outer rollup proof`. Then `outer rollup proof` will be as a parameter to invoke `rollup_contract`.

`Anomix Sequencer`的rollup电路里，总共要处理以下类型的L2 tx:
1. account registration L2 tx
2. account update L2 tx
3. account migration L2 tx
4. transfer L2 tx
5. withdrawal L2 tx
6. padding L2 tx
这些L2 tx都需要拟合到统一的tx格式里。此时部分L2 tx在统一格式里会出现字段空缺，此时需要电路中进行判断并区分处理。

## Inner Rollup zkProgram
[innerRollupZkProgram_design](./innerRollupZkProgram_design.md)

## Outer Rollup zkProgram
[outerRollupZkProgram_design](./outerRollupZkProgram_design.md)
