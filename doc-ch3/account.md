
# AccountTree: 
leafIndex: address的hash
Leaf: Account数据结构：{ alias, KeyTreeRoot, BalanceTreeRoot }

额外后台保存索引：alias <-> address
直接转账时，需要在电路(协议)层面补上：alias的有效性校验

# UserDataTree：height=8
KeyTreeRoot: 由于存在新增和删除设备的情况，所以需要采用o1js-merkle里的SparseTree（UpdateOnlyTree）;
一个用户有一颗Key merkle tree, 其中KeyTreeRoot存储在AccountTree上。
* leafIndex: 自增长下标, from 0,1,2...
* leaf: 存储对应的value object的字段结构: { type, key, value,  }
  * type: 
    * 0 -> 授权设备类型
      * key: 设备名字，一个Field大小，如window chrome01, linux chrome01的hash值
      * value: 存MINA address
    * 1 -> 他链类型
      * key: 
      * value: 
    * ......

注意：后台需要记录当前有效下标，无需在协议层记录。
后续考虑参考 name service做功能扩展，谓之曰：基于Rollup的Name Service

# BalanceTree: 
一个用户有一颗balance merkle tree, 其中balanceTreeRoot存储在AccountTree上。
Balance Tree采用标准的SMT,  254高度，通过一个TokenID作为leafIndex， 其Leaf对应的value是{nonce, value}
