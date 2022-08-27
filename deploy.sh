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

git push -f git@github.com:WeissSa/portfolio.git master:gh-pages

cd ..