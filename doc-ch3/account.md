
## Public Ledger
There are three trees in Public Ledger: 
### AccountTree: 
leafIndex: address的hash
Leaf: Account数据结构：{ alias, KeyTreeRoot, BalanceTreeRoot }

额外后台保存索引：alias <-> address
直接转账时，需要在电路(协议)层面补上：alias的有效性校验

### UserDataTree：height=8
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

### BalanceTree: 
一个用户有一颗balance merkle tree, 其中balanceTreeRoot存储在AccountTree上。
Balance Tree采用标准的SMT,  254高度，通过一个TokenID作为leafIndex， 其Leaf对应的value是{nonce, value}


## Protocol-Native AccountID
DID is the bottleneck of current Web3 application layer

Account-ID's current usage is far from the huge vision we gave it at the beginning of its design. The actual final real mission of Account-ID is to build a DID system in MINA world, since we believe that as MINA's zkAPP ecosystem progresses to a certain point, it must also encounter situations where it is limited by 'Identity'(for the following reasons). Of course, DID is a big and complex concept, and we team schedules to take a small step forward with each of the next upgrades.

We have had high expectations for the design of AccountID from the very beginning. Followingly, let's move it forward a step.

We plan to move the mapping relationship between AccountID and Pure Address down to the protocol layer. This means that during the process of asset transfer, the mapping relationship between AccountID and Pure Address will undergo circuit verification. This helps mitigate the potential attack risks to AccountID in the asset management process mentioned earlier.

The design of AccountID opens up possibilities for larger scenarios on the Anomix Network, such as 'off-chain identity authentication', 'on-chain reputation scoring', 'on-chain identity aggregation', 'compliance with regulatory requirements', and more. Examples are as follows:

On-chain Reputation Scoring:

Aggregate users' (public) on-chain activities for analysis, calculate users' on-chain reputation scores using open-source and widely recognized reputation scoring algorithms. Based on this score, users can be hierarchically divided and filtered in web3 activities. For instance, accounts with low on-chain reputation scores may not be allowed to participate in current airdrops&ICO activities, or cannot enjoy lower on-chain lending rates etc.

Additionally, the on-chain reputation system gives users the opportunity to shape their own reputation, freeing them from dependence on centralized credit rating agencies. When users are dissatisfied with their credit score, on-chain reputation users can adjust their behavior transparently based on open-source reputation algorithms or submit additional data to improve their score.

Regulatory Compliance:

Privacy protection is a fundamental attribute of Anomix Network, but the design of AccountID provides a way for regulatory compliance.

Utilizing digital identity verification services, such as government agencies or authentication service providers, users can complete identity verification off-chain and then associate the obtained digital identity proof or authentication information with their AccountID. This approach protects user privacy while ensuring the authenticity of their identity.

