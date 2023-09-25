#!/bin/bash

cd /opt/anomix_server/anomix-network/apps/proof-generators
ls /opt/anomix_server/anomix-network/apps/proof-generators
rm ./proofTaskDto*
rm ./*proofJson*
ls /opt/anomix_server/anomix-network/apps/proof-generators


cd /opt/anomix_server/anomix-network/apps/rollup-sequencer
rm ./*proofTaskDto*
ls /opt/anomix_server/anomix-network/apps/rollup-sequencer



cd /opt/anomix_server/anomix-network/apps/deposit-processor
rm ./*proofTaskDto*
rm ./*rollupTaskDto*
rm ./AnomixEntryContract_DEPOSIT_UPDATESTATE*
ls /opt/anomix_server/anomix-network/apps/deposit-processor

echo 'done'




