#!/bin/bash

cd /opt/anomix-network-data/leveldb/anomix_world_state_db
rm -rf ./*
cd /opt/anomix-network-data/leveldb/anomix_index_db
rm -rf ./*
cd /opt/anomix-network-data/leveldb/anomix_withdraw_db
rm -rf ./*
rmdir /opt/anomix-network-data/leveldb/anomix_world_state_db
rmdir /opt/anomix-network-data/leveldb/anomix_index_db
rmdir /opt/anomix-network-data/leveldb/anomix_withdraw_db

echo 'done'
