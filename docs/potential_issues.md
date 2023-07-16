// TODO Complete them

# account维护没有tx_fee, 容易被攻击！
  * 需要探究没有收费，怎么防止用户恶意发account tx.

# sequencer 作恶
## 宕机
### 停机升级
### 故障

## 不工作
### 不及时维护merkle trees
### 不及时打包出块
### 不及时将2棵merkle tree的leaves完整地公开到公共空间

## 充值
### 恶意没有将用户的commitments插入tree
### 将不存在的commitments插入tree以造成凭空创造资产

# L1网络回滚
