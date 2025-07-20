#!/usr/bin/env sh

# abort on errors

set -e

# build

npm run build

# nav to build

cd out
touch .nojekyll
cp ../404.html .

git init

git add --a

git commit -m "deploy"

git push -f git@github.com:WeissSa/portfolio.git master:gh-pages

cd ..