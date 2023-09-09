#!/bin/bash

cd /opt/anomix-network-data/leveldb/anomix_deposit_rollup_state_db
rm -rf ./*
cd /opt/anomix-network-data/leveldb/anomix_deposit_index_db
rm -rf ./*
rmdir /opt/anomix-network-data/leveldb/anomix_deposit_rollup_state_db
rmdir /opt/anomix-network-data/leveldb/anomix_deposit_index_db
