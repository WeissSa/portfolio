#!/usr/bin/env sh

# abort on errors

set -e

# build

npm run build

# nav to build

cd dist

git init

git add --a

git commit -m "deploy"

git push git@github.com:WeissSa/portfolio.git main:gh-pages

cd ..