#!/bin/bash

ps -ef | grep node | grep -v grep | awk '{print $2}' | xargs kill -9

cd /opt/anomix_server/anomix-network/

npm run libs:build

npm run print -w @anomix/circuits

cd /opt/anomix_server/anomix-network/packages/circuits/

# circuit-JoinsplitProofDummyTx.string
mv ./circuit-JoinsplitProofDummyTx.string /opt/anomix_server/anomix-network/apps/rollup-sequencer

ls /opt/anomix_server/anomix-network/apps/rollup-sequencer


# circuit-JoinSplitProverVK.string
mv ./circuit-JoinSplitProverVK.string /opt/anomix_server/anomix-network/apps/open-api

ls /opt/anomix_server/anomix-network/apps/open-api

echo 'done'
