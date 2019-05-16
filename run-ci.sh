#!/bin/bash
set -ev

yarn test-ci
yarn report
yarn lint

if [ "${CI}" = "true" ]; then
  npm install coveralls
  cat ./coverage/lcov.info | ./node_modules/coveralls/bin/coveralls.js
fi
