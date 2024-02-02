# Anomix Network - A Hybrid zkRollup with Native ID for Web3 Mass-adoption

# What is your elevator pitch?*
At zkIgnite Cohort1, Anomix Network has growed up to be a zk-zkRollup layer2 on Mina focusing on Privacy&Scalablility, which is the FIRST Privacy-Frist Layer2 solution running on MINA BerkeleyNetwork.

Now, We are going to the NEXT step - A Hybrid zkRollup with Native ID for Web3 Mass-adoption.

In addition to (existing) Non-Compromised Privacy, we schedule to provide a Protocol-Native ID System based on a new Public Ledger, which allows you to create/hold a unique account ID, asset management directly by ID, and also support multi-device synchronization, account recovery, etc. No need again to care about wallet-plugin installations, password/mnemonics backup and long address.

Privacy & Scalability & Security & Convenience, Anomix Network targets to break down barriers from Web2 to Web3, accelerates mass-adoption of Web3.


# Describe the problem that your zkApp is solving *
Anomix Network has reached the first milestone to be a zk-zkRollup-style layer2 to enhance privacy protection and scalability of MINA chain. You could take an experience on our entry point: AnoCash, where you could

𝗢𝘄𝗻 𝗮 𝗨𝗻𝗶𝗾𝘂𝗲 𝗜𝗗,
Deposit from Layer1,
𝗤𝘂𝗶𝗰𝗸 Transfer directly through ID by 𝗨𝗹𝘁𝗿𝗮-𝗟𝗼𝘄 fee,
Withdraw back to Layer1,
Most importantly, Your assets are Untracable and Invisable.


To sum up, the above features mainly focus on Privacy & Scalability. But They are just a small step of the real goal of Anomix Network -- Web3 Mass-adoption.



According to a market sizing report from cryptocurrency exchange Crypto.com, more than half a billion people had become cryptocurrency users or owners by the end of 2023. This number is still very small compared to the ones of web2 companies.



From the view of Anomix Network, to bring massive users to web3, the most important approach is to break down the barrier between web2 and web3, and let the common users seamlessly enter web3 from web2.



The list below covers the challenges(barriers) blocking massive users we plan to overcome at the following upgrade of Anomix Network, as well as some scheduled improvements which could help much on make user journeys more convenient.



<1> tedious & troublesome steps to create/hold a crypto account

The common operations for new users to firstly enter web3 or existing users to join new web3 activities (like airdrop, ICO, claim, etc.) happens at wallet clients, always with blow steps: install wallet > create an account > backup password/mnemonics > deposit assets / transfer to target address.



Additionally, there are more cases, like that there are numbers of new users with little knowledge on wallet plugins installation, like that some wallet plugins only support chrome explorer, like that users have to specially install mobile wallet apps due to most mainstream mobile explorers now don't 100% support plugins installations, etc.



Apparently, by comparison to web2 operations, the above progress is so tedious & troublesome. Besides, you might risk losing your crypto assets by improper operations, such as 'install wallet from fake(evil) source', 'exposing/losing password/mnemonics', etc. Without doubt, these increase mental burden and blocks the common users at the first step.



And one target of Anomix Network's following upgrade is to wipe out the above tedious & troublesome steps to make crypto account walletplugin-independent, passwordless and mnemonics-free. Meanwhile, other features like multi-device support and account recovery, etc, would also be supported to make your account management within Anomix really convenient.



<2> risks on existing Account-ID design

From the birth Anomix Network allows users to create their own unique & human-readable Account-ID to free users from the hassle of tedious addresses.



The mechanism is that we underlying maintain a Bidirectional Mapping between Account-ID and pure Address, based on which users are able to just remember their own or receivers' ID and manage crypto assets by ID directly & unmistakably within Anomix, and thus to a certain extent avoiding transferring to wrong addresses as well as preventing hacker attacks during transfer(like clipboard attack cases).



This feature is similar to the pattern of how wallets/dapps integrates ENS. It helps improve user's confidence during asset transfer, but it could not thoroughly solve them. The pic below describes the lack of this pattern:



      seen at attached figure: accountID-existing-pattern-risks.png


Risk1: Hackers attack the API Service and tamper with the returned results;

Risk2: Internal personnel of the API Service commit wrongdoing and tamper with the returned results;

Risk3: Internal program exceptions in the API Service lead to incorrect results being returned;



<3>  DID is the bottleneck of current Web3 application layer

Account-ID's current usage is far from the huge vision we gave it at the beginning of its design. The actual final real mission of Account-ID is to build a DID system in MINA world, since we believe that as MINA's zkAPP ecosystem progresses to a certain point, it must also encounter situations where it is limited by 'Identity'(for the following reasons). Of course, DID is a big and complex concept, and we team schedules to take a small step forward with each of the next upgrades.



Why DID is so important to Web3(MINA)?

Interactions in Web3 are now based on wallet addresses, but the cost of creating a new address is negligible, and few people are bound to an address. This leads to the fact that users can give up the "identity" represented by an address at any time, and can also create a large number of address "identities" at zero cost, which leads to a series of problems.



Regarding this, <<Decentralized Society: Finding Web3's Soul>> (authors: Vitalik Buterin & his partners) indicates that, Web3 currently has some limitations at the application layer, 'Because web3 lacks primitives to represent such social identity, it has become fundamentally dependent on the very centralized web2 structures it aims to transcend, replicating their limitations', thus breaking the Web3 closed loop.



Typical examples are:

We cannot realize many common economic activities in reality, such as borrowing with insufficient collateral, since the current DeFi cannot construct the connection between the address and the "real person".

DAOs that expect to implement "one person, one vote" voting (with a token threshold) often have to rely on web2 infrastructure, such as social media profiles, to combat sybil attacks (where a large number of bots are programmed to behave like real people).

Some NFT projects claim to have been created by a well-known artist, but this creation cannot be directly verified on-chain. Users have to contact the artist through Web2 social media to verify the authenticity. If they cannot contact the artist or cannot be clarified in time, they are easy to be deceived.

Apparently, at current (early) stage, web3 project teams might benefit more from (as well as being more urgent for) DID infrastructure than the common users.



The improvement of key infrastructures could promote ecological enrichment, and then attracts a large number of users. Therefore, the construction of Web3 native identity components is crucial to the further prosperity of Web3 world (MINA ecology).



# Describe your proposed solution *
We firmly believe that a Web3 world for everyone should be decentralized, privacy-first, self-sovereign, and convenient.

Anomix Network has completed the evolution of 'zk-zkRollup Layer2 focusing on Privacy&Scalability' in 2023, based on which, our next step is to break down barriers between web2 & web3, make web3 life real simple!



Regarding the issues described above, we team have prepared practical solutions.



<1> address the challenges of account creation and usage

People are used to the convenience of sign-up and login in web2, so that they usually feel cumbersome in Web3 account operation. So our goal for Anomix account of next generation is: Make account operations as smooth as web2 while ensuring security.



Eliminate wallet installation & Password & mnemonics: Only your device and biometric information are required for easy access to your account. Wallet installation & password & mnemonics is history.

Non-custodian: The full control over your private keys and funds is always kept by yourself. Without your biometric authentication, others will not be able to access your wallet.

Multi-device support: Accounts can be synchronized on different devices after authorization. This is also an account backup.

Multiple mechanisms for Account Recovery : Account recovery is straightforward using options such as social recovery, passkeys, and multiple devices, blockchain wallets, eliminating tedious mnemonic phrases.




<2> Built-in private account messaging

Just like normal payments on bank apps, Anomix Account supports you could specify 'what it's for' during asset transfers. The message is invisible to the world but you and your couterparty. You can even implement a private-chat app based on this feature !!




<3> Protocol-Native AccountID

We have had high expectations for the design of AccountID from the very beginning. Followingly, let's move it forward a step.



We plan to move the mapping relationship between AccountID and Pure Address down to the protocol layer. This means that during the process of asset transfer, the mapping relationship between AccountID and Pure Address will undergo circuit verification. This helps mitigate the potential attack risks to AccountID in the asset management process mentioned earlier.



The design of AccountID opens up possibilities for larger scenarios on the Anomix Network, such as 'off-chain identity authentication', 'on-chain reputation scoring', 'on-chain identity aggregation', 'compliance with regulatory requirements', and more. Examples are as follows:

On-chain Reputation Scoring:

Aggregate users' (public) on-chain activities for analysis, calculate users' on-chain reputation scores using open-source and widely recognized reputation scoring algorithms. Based on this score, users can be hierarchically divided and filtered in web3 activities. For instance, accounts with low on-chain reputation scores may not be allowed to participate in current airdrops&ICO activities, or cannot enjoy lower on-chain lending rates etc.



Additionally, the on-chain reputation system gives users the opportunity to shape their own reputation, freeing them from dependence on centralized credit rating agencies. When users are dissatisfied with their credit score, on-chain reputation users can adjust their behavior transparently based on open-source reputation algorithms or submit additional data to improve their score.



Regulatory Compliance:

Privacy protection is a fundamental attribute of Anomix Network, but the design of AccountID provides a way for regulatory compliance.

Utilizing digital identity verification services, such as government agencies or authentication service providers, users can complete identity verification off-chain and then associate the obtained digital identity proof or authentication information with their AccountID. This approach protects user privacy while ensuring the authenticity of their identity.





<4> Dual ledger design for a wider application scenario

Privacy is native property of Anomix Network. However, we find that, as a Layer2, a single privacy ledger will to some extent limit our pursuit of more interesting user scenarios ( like, to support the above new features), and thus limit the development and enrichment of the ecosystem.

Therefore, guaranteeing the Private Ledger Based on UTXO, we introduce a Public Ledger based on Account Model. Meanwhile, we make it very easy to switch assets between the two ledgers. This means, Asset management under Anomix accounts can conveniently choose to be either public or private.



  Seen at attached Figure: anomix-dual-ledgers-design.jpg



Dual ledger design, is why we say 'Hybrid zkRollup' at the beginning of this Proposal. We believe the hybrid ledgers can prepare the Anomix Network for larger application scenarios in the future.





<5> Private Note Discovery Protocol

Regarding existing Private Ledger part, to enhance the efficiency of maintaining the private asset transactions on the user's local devices, We introduce the Private Note Discovery Protocol, which can quickly locate the user's private UTXO in the Private Ledger without privacy compromise.



# Architecture - Provide technical detail for your zkApp design *
At this section, we introduce at high-level on the key technologies on how we upgrade Anomix Network to implement solutions described above.

(Since the upgrade is the extension of current Anomix Network, it would be better to take a glance first at how we carry out the current version before read on.)



<1> Public Ledgers section
At this upgrade, The introduction of Public Ledgers Based on account-model is the foundation of the other features above.



You could see several Merkle trees in Figure-anomix-dual-ledgers-design.jpg, wherein the right side is about existing Private Ledger, and all the tree's roots are stored into onchain contract as the Layer2 State.



As you see, technically speaking, the Implementation of Public Ledger is based on Sparse Merkle Tree(SMT), denoted 'AccountTree' seen at pic.



The Account Tree leaves record all Public Accounts of all Layer2 Users.  And each Public Account stores all user's public info such as 'AccountID', 'Authorized Keys(for account management described below)', 'balance', 'nonce', etc.



And The asset switch between Public Ledger(Account Tree) and Private Ledger could be proved by their merkle witnesses within Circuits to ensure data consistency.





<2> Account Creation & Backup & Recovery section

Regarding 'L2 account maintenance', we align with the original pattern (described in cohort1 proposal): 'Unique ID + Multi-Level Keys'. But to support 'Eliminate wallet installation & Password & mnemonics', he keys hierarchy will be different。The pic below is the new design.

       Seen at attatched Figure-'account-keys-hierarchy.png'

'Account Viewing Key' is used for L2Tx encryption & decryption to later rebuild all L2tx history at new device.

'Spending Key' is used for asset management(transfer/withdraw). Normally 'one device, one spending key'.

'Manager Key' is a new key at this upgrade, which is used for authorizing 'spending keys' for different devices.



All the keys will be recorded on chain under your L2 account(through L2Tx).



1) how to implement passwordless & mnemonics-free account

As a background, let's take a look at the brief intro on 'WebAuthn' and 'PassKey'.

'WebAuthn is an open standard developed by W3C for implementing modern, secure, and user-friendly authentication. It utilizes methods such as public key encryption, biometrics, and hardware keys to replace traditional usernames and passwords, offering a more robust and predictable authentication mechanism, thereby enhancing the security of internet services.'

'Passkeys are a safer and easier alternative to passwords. With passkeys, users can sign in to apps and websites with a biometric sensor (such as a fingerprint or facial recognition), PIN, or pattern, freeing them from having to remember and manage passwords.'



Leveraging ‘FIDO WebAuth Protocol(PassKey)’ + 'Deterministic Signature', we could always generate the same (unique) 'Manager Key' and 'Account Viewing Key' at your device. That means you could access(signup & signin) Anomix L2 Account on your device directly by your device's screen lock such as a fingerprint sensor, facial recognition or PIN.



Mature WebAuth(PassKey) Tech make you no worry about exposure & loss of your device PassKey, and thus no worry about you lost your 'Manager Key' and 'Account Viewing Key'. This further means you No need again to care about wallet-plugin installations, password/mnemonics backup.



Note: Both 'Manager Key' and 'Account Viewing Key' are only generated in memory each time you need them and will be purged from memory after usage. This means the risk of exposure would be very low.



You could see that the full control over your private keys and funds is always kept by yourself (Non-custodian). Without your biometric authentication, others will not be able to access your L2 account.





2) how to support Multi-Devices synchronization

'Multi-Device support' means you could leverage 'Manger Key' to authorize a new-generated 'Spending key' at new device. Our Account solution provide secure approach for users to complete the progress, high-level steps as below:



enter ano.cash at a new device, and generate a new 'Spending Key' (encrypted & stored in explorer storage)

sync encrypted 'Account Viewing Key' to the new device and then decrypt it by inputing password

sync the new encrypted 'Spending Key' to original device and authorize through L2Tx the new 'Spending Key' by 'Manger Key'.



In additions, if you suspect specified 'Spending key' is exposed, we provide approaches to invalidate it to avoid asset loss.



3) how to implement Account Recovery

We provide a series of mechinsm for Account Recovery, such as social recovery(based on Emergency contact mechanism), passkeys, and multiple devices, eliminating tedious mnemonic phrases.


# Go-to-market strategy
## Share your go-to-market strategy, which includes: *
The main goal of Anomix Network of next upgrade is: break down the barriers between web2 & web3, and let people seamlessly switch to web3. 

In 3 months, We expect user could enjoy convenient& innovative account management solution and asset management of non-compromised privacy within Anomix Network.



Strategy：

Phase1 (in 3 months):

    Begin from Developer Community： invite technical community members as seed users for a small-range test,



Phase2 (in 6months):

    Education and Training： Create tutorials, videos and guides on all user journeys like from Account Creation&Usage&Recovery to asset management of non-compromised privacy within Anomix。



    Social media Promotion： Use social media platforms(discord/twitter mainly) for promotion, interact with the cryptocurrency community, and share the features and advantages of Anomix. Work with industry partners to expand the user base.



    Community Engagement： Build an active community that facilitates communication and collaboration among users by hosting online or offline events, forums, and social media interactions.



In addition, as a Layer2, in the future, we may consider issuing tokens for community airdrops and rewards to motivate users to stay active, participate in the community, and recommend new users.


## What does success look like in terms of user adoption in 6 months from now? Please be as specific as possible. *
What we think 'success' look like in terms of user adoption in 6 months is mainly based on the number of active users.

We think the below metrics are important:
1) the number of twitter followers  exceeds 3,000

2) the number of account creation exceeds 1000

3) the number of github stars: exceeds 30

4) the number of github issues: exceeds 10
5) hot community feedbacks: 80%+ users gives us a positive rating during our surveys, while 30%+ users could give us detailed feedbacks.


## Share your thoughts on generating revenue over a longer time horizon (greater than 6 months) *
As a layer2, our revenue mainly depends on the number of active users.

Our Profit Models:

1) Fee income:

    The ZK-Rollup network can collect fees paid by users when they execute transactions.



2) Value-added services:

case1 - computing outsourcing services: since circuit-compile & witness-calc & proof-gen usually costs much resources(time/cpu/memory) at user clients, 'computing outsourcing services' are provided for a fee for 'Layer2 Tx without privacy requirements' such as transactions generated inside Public Ledger.


case2 - Data aggregation and analysis services: Through the deep processing of the public data of layer2 users, high value analysis charts and reports are extracted, and the fees are generated. Examples include aggregated reports of on-chain activity for a specific user,


case3 - Establish an on-chain reputation scoring system and provide paid-query services


3) Governance equity:

     The Anomix network may consider introducing governance tokens in the future, where holders (founder team and community members) can participate in the decision-making process of the network, and these participations may bring certain gains.



In the future (longer time horizon), as the number of active users grows up within Anomix Network, we believe Revenue channels will be more diversified.


## What is your long-term vision for this project if your proposal is funded? What is your dream scenario for how this project could evolve? *
Since zkIgnite cohort1, Anomix Network has completed the evolution of 'zk-zkRollup Layer2 focusing on Privacy&Scalability'.



At current stage, Anomix Network aims to be A Hybrid zkRollup with Native ID for Web3 Mass-adoption. We expect Mina Community (users) could enjoy web3 life with Privacy & Security & Convenience through Anomix Network.



Till now, Anomix Network mainly focuses on asset management. But as our cohort1's proposal describes, we expect Anomix Network is able to support 'building private defi/nft/DID,etc'.



We team actually persists on this and found some practical approaches, but waits for underlying supports from o1js (upgrade).  In the future, We believe Anomix Network will continuously grow up to be a programmable layer2.


# Standard Budget Proposal
## Standard Budget in MINA *
60000

## Standard Scope *
// TODO

## Standard Scope Milestones *
// TODO

# Risks & Dependencies
## What risks or dependencies do you foresee with building and launching this application? *
Risks from Performance
As a zk-zkRollup layer2 consisting of dual ledgers(multiple merkle trees), the complexity of Anomix might lead to significant circuit size. This might impact the performance of the ‘compiling’ section and ‘proof-generation’ section. We team raises several solutions to improve the performance, such as leveraging high-performance cloud infra,  separating a service intended for proof generation, optimize circuit design to decrease extra constraints, etc.

Though this might matter, the risk just slow down the performance and does NOT block us to complete the project.

Risks from design
Although we team has completed the whole design, some details might be adjusted to perform better. This results in extra efforts.

Risks from potential bugs of o1js
The circuits in Anomix covers most features of o1js. Potential bugs of o1jsimpact our project. But with gradually stabilized features of o1js as well as the supports from Mina community(in discord channels, etc.), we estimate this risk could be reduced gradually.

Risks from Mina network issues
Potential network issues also directly blocks our development and testing plans. Fortunately, this risk is not high because network issues impact so much around that maintainers quickly take actions to fix/recover it.

# Proposer Github
https://github.com/coldstar1993

# Proposer Experience
I am an Full-stack Engineer with 7years’ experience in web3, mainly focusing on Bitcoin, Ethereum and Mina. And participated in Mina community from 2020.



My resume:

(1) Team Leader of Anomix Network
• Funded Project at Mina ZkIgnite Cohort1
• In charge of Design upon Archetecture, UI, etc.
• In charge of team management and project delivery



(2) co-Creator of o1js-merkle library - Merkle Trees for o1js (membership / non-membership merkle witness)
https://github.com/plus3-labs/o1js-merkle


(3) Mentor of zkIgnite cohort 2
• Mentor of ‘Tokenizk.finance’ team and ‘Privacy Token On Mina’ team
• Provide guidance on technical design and issue solutions for projects



(4)The First translator of <Foundry Book> of Chinese version
• recognized & forked by a famous Chinese blockchain community -- lbc-team
• As Repo Admin of the book
https://github.com/lbc-team/foundry-book-in-chinese



(5)Active Grantee in Mina ecology

• Navigators badge holder
• zkApp E2E Testing Program
• zkApp Builders Program-Cohort 1
• zkIgnite cohort0
• zk-peer-reviewer at 2022

• zkapp-beta-tester

• zkApps bootcamp 2021


## Team Members
Comdex#3801

    Github: https://github.com/Comdex/

    Mina Genesis founding member, 

    Active in community with several contributions:

co-Creator of o1js-merkle library - Merkle Trees for o1js (membership / non-membership merkle witness)
https://github.com/plus3-labs/o1js-merkle
Developer of snarky-smt -- Merkle Tree for SnarkyJS with Pluggable Storage;
Developer of WoKey -- The First cold wallet app within Mina community;
Developer of Nft-zkapp -- a simple private NFT (of POC) based on mina zkApp;
Developer of ZK-MultiSig -- a zk multi-sig wallet to connect to Mina zkApps, rank: high-quality zkApp;
   Selected as a member of many technical activities, such as zkApps-bootcamp-2021, zkApp Builders Program-Cohort 1, ZK-peer-reviewer at 2022 and zkapp-beta-tester. Awarded 'HighQuality zkApp' within zkIgnite-cohort0 , Navigators badge holder and  an active grantee, etc.
