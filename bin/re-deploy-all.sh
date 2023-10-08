#!/bin/bash

cd /opt/anomix_server/anomix-network/

npm run updateKeys -w @anomix/circuits

npm run deploy:all -w @anomix/circuits

echo 'done'

