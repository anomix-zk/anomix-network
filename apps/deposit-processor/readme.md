启动触发条件：
  每3mins内启动一次 fetchActions/Events, 入库, 插树准备后发送给proof-generator执行电路;
  proof-generator执行完毕后异步通知deposit-processor;
  deposit-processor签名并广播tx;
  
