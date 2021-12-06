import {
  Plugin,
  Configuration,
  Project,
  structUtils,
  StreamReport,
  Cache,
  Workspace,
  Descriptor,
  MessageName,
  formatUtils,
  FormatType,
} from "@yarnpkg/core";
import ignoreWalk from "ignore-walk";
import { Filename, PortablePath, ppath, npath, xfs } from "@yarnpkg/fslib";
import { BaseCommand, WorkspaceRequiredError } from "@yarnpkg/cli";
import { Option } from "clipanion";
import { suggestUtils } from "@yarnpkg/plugin-essentials";
import { parse } from "comment-json";

class CheckDepsCommand extends BaseCommand {
  static paths = [["checkdeps"]];
  ignorePatterns = Option.Array(`--ignore-patterns`, [], {
    description: `An array of glob patterns of files to ignore`,
  });
  async execute() {
    const configuration = await Configuration.find(
      this.context.cwd,
      this.context.plugins
    );
    const { workspace, project } = await Project.find(
      configuration,
      this.context.cwd
    );
    const { workspace: rootWorkspace, project: rootProject } =
      await Project.find(configuration, configuration.projectCwd);

    const cache = await Cache.find(configuration);
    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    const allWorkspaces = project.workspaces;
    const workspacesByName = new Map(
      allWorkspaces.map((workspace): [string, Workspace] => {
        const ident = structUtils.convertToIdent(workspace.locator);
        return [structUtils.stringifyIdent(ident), workspace];
      })
    );

    await project.restoreInstallState({
      restoreResolutions: false,
    });

    const allDeps = [
      ...rootWorkspace.manifest.dependencies.values(),
      ...rootWorkspace.manifest.devDependencies.values(),
    ];
    const depcheckExists = allDeps.find((dep) => dep.name === "depcheck");
    if (!depcheckExists) {
      const descriptor = structUtils.makeDescriptor(
        structUtils.makeIdent("", "depcheck"),
        "^1.4.2"
      );
      rootWorkspace.manifest[suggestUtils.Target.DEVELOPMENT].set(
        descriptor.identHash,
        descriptor
      );

      const afterWorkspaceDependencyAdditionList: Array<
        [
          Workspace,
          suggestUtils.Target,
          Descriptor,
          Array<suggestUtils.Strategy>
        ]
      > = [
        [
          rootWorkspace,
          suggestUtils.Target.DEVELOPMENT,
          descriptor,
          [suggestUtils.Strategy.LATEST],
        ],
      ];

      await configuration.triggerMultipleHooks(
        (hooks: any) => hooks.afterWorkspaceDependencyAddition,
        afterWorkspaceDependencyAdditionList
      );
      await StreamReport.start(
        {
          configuration,
          json: false,
          stdout: this.context.stdout,
        },
        async (report) => {
          await rootProject.install({ cache, report });
        }
      );
    }

    // Fake global require to not inline depcheck, since it tries to dynamically require
    // files during runtime which don't exists after yarn builder bundles the plugin.
    //@ts-ignore
    const depcheck = globalRequire("depcheck");

    const tsConfig = getTsConfig(workspace.cwd);

    const rootDirs = getRootDirs(workspace.cwd, tsConfig);
    const paths = getTsConfigPaths(tsConfig);
    await StreamReport.start(
      {
        configuration,
        json: false,
        stdout: this.context.stdout,
      },
      async (report) => {
        const gitIgnoreFiles = ignoreWalk.sync({
          ignoreFiles: [".gitignore"],
          path: npath.fromPortablePath(rootWorkspace.cwd),
        });
        const check = await depcheck(npath.fromPortablePath(workspace.cwd), {
          ignoreBinPackage: true,
          ignorePatterns: [...gitIgnoreFiles, ...this.ignorePatterns],
          ignoreMatches: [...rootDirs, ...paths],
        });
        report.reportInfo(
          null,
          formatUtils.pretty(
            configuration,
            JSON.stringify(
              {
                missing: check?.missing,
              },
              null,
              2
            ),
            FormatType.CODE
          )
        );
        const isRootWorkspace = workspace.cwd === rootWorkspace.cwd;
        const missingDeps = Object.keys(check?.missing || {});
        missingDeps.forEach((packageName) => {
          const isWorkspace = workspacesByName.has(packageName);

          const ident = structUtils.parseIdent(packageName);
          const descriptor = structUtils.makeDescriptor(
            structUtils.makeIdent(ident.scope, ident.name),
            isWorkspace ? "workspace:*" : "*"
          );
          (isRootWorkspace ? rootWorkspace : workspace).manifest[
            suggestUtils.Target.REGULAR
          ].set(descriptor.identHash, descriptor);
        });

        if (missingDeps.length) {
          await (isRootWorkspace ? rootProject : project).install({
            cache,
            report,
          });
        }
        report.exitCode();
      }
    );
  }
}

const plugin: Plugin = {
  commands: [CheckDepsCommand],
};

export default plugin;

const getTsConfig = (cwd: PortablePath): Record<string, any> | undefined => {
  try {
    const filePath = ppath.resolve(cwd, "tsconfig.json" as Filename);
    const content = xfs.existsSync(filePath)
      ? xfs.readFileSync(filePath, `utf8`)
      : `{}`;
    return parse(content);
  } catch (error) {
    console.log(error);
  }
};

const getRootDirs = (
  cwd: PortablePath,
  tsConfig?: Record<string, any>
): string[] => {
  const baseUrl = tsConfig?.compilerOptions?.baseUrl;
  if (!baseUrl) return [];
  try {
    const resolvedRoot = ppath.resolve(cwd, baseUrl as Filename);
    // file and directories
    const dirs = xfs.readdirSync(resolvedRoot);
    // files without extensions
    const dirNames = xfs
      .readdirSync(resolvedRoot)
      ?.map((path) => ppath.parse(path).name);
    return [...new Set([...dirs, ...dirNames])];
  } catch (error) {
    return [];
  }
};
const getTsConfigPaths = (tsConfig: Record<string, any>) => {
  const paths = tsConfig?.compilerOptions?.paths;
  if (!paths) return [];
  return Object.keys(paths);
};
