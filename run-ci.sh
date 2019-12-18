#!/bin/bash
set -ev

npm run test
npm run cobertura
npm run lint

if [ "${CI}" = "true" ]; then
	npx nyc report --reporter=text-lcov | npx coveralls
fi
