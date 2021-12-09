# @yarnpkg/plugin-depcheck

- Check and add workspace dependencies

## Install

```bash
yarn plugin import https://raw.githubusercontent.com/alizeait/plugin-depcheck/master/bundles/@yarnpkg/plugin-depcheck.js

```

## Usage

```
USAGE
$ yarn checkdeps

OPTIONS

   --write                Write missing dependencies into dependencies package.json, workspaces will have the range "workspace:*" while regular dependencies will prefer any range available from other workspaces, otherwise "*"

   --ignore-patterns      Comma separated patterns describing files to ignore. Patterns must match the .gitignore spec.

   --ignore-packages      A comma separated array containing package names to ignore. It can be glob expressions"

EXAMPLES
  $ yarn checkdeps
  $ yarn checkdeps --write
  $ yarn checkdeps --write --ignore-patterns={dist,coverage,*.log}
  $ yarn checkdeps --write --ignore-packages={eslint,babel-*}
```

## Features

- Uses depcheck to check for missing dependencies, it also ignores paths defined in tsconfig.json

- Can write missing dependencies into dependencies package.json, workspaces will
  have the range "workspace:\*" while regular dependencies will prefer any range
  available from other workspaces, otherwise "\*"
