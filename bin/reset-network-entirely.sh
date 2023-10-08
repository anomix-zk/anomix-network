#!/bin/bash

ps -ef | grep node | grep -v grep | awk '{print $2}' | xargs kill -9

./clear-cache-req-resp-files.sh

./clear-logs-file.sh

./clear-merkle-db-dirs.sh

./re-gen-vk-dummy.sh

./re-deploy-all.sh.sh

echo 'all done, please restart all apps!'

