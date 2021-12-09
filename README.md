# @yarnpkg/plugin-depcheck

- Check and add workspace dependencies

## Usage

```

USAGE
$ yarn checkdeps

OPTIONS
   --ignore-patterns      An array of glob patterns of files to ignore

   --write                Write missing dependencies into dependencies package.json, workspaces will have the range "workspace:\*" while regular dependencies will prefer any range available from other workspaces, otherwise "\*"

EXAMPLES
  $ yarn checkdeps
  $ yarn checkdeps --write
  $ yarn checkdeps --write --ignore-patterns={*.scss,*.css}
```

## Features

- Uses depcheck to check for missing dependencies, it also ignores paths defined in tsconfig.json

- Can write missing dependencies into dependencies package.json, workspaces will
  have the range "workspace:\*" while regular dependencies will prefer any range
  available from other workspaces, otherwise "\*"
