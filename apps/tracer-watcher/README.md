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

- look for scripts in package.json
