## tracer-watcher @ Anomix

* trace all L1 tx and update status into DB
  * deposit tree maintainance L1 tx
  * withdraw L1 tx
  * rollup contract L1 tx
  * ...

* watch the network status and notify 'rollup-sequencer' & 'deposit-processor'
  * deposit actions amount
  * pending tx amount
  * ...
  * 每次claim过程中生成的L1tx都是锚定当时blockID的（即data_tree的root），如果用户claim了后老旧都没正是sign和广播tx的话，那么会tx过时。需要一个定时任务扫描withdrawInfo 表，查看{status:processing}的item的L1 tx是否失效了（如果blockIdWhenL1Tx < 当前L2区块高度）。若失效则回退Pending状态。
- look for scripts in package.json
  * 监测L2Block迟迟不出，则终结flow.
