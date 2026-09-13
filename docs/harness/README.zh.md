# harness 侧集成补丁

`dsh-skills-manager` 是在 DeepSeek Harness 检出里构建的——见[重新构建打包产物](../../README.zh.md)。
但本管理器包以及它需要的接线并不属于上游 DeepSeek Harness，因此
`scripts/sync-from-harness.sh` 需要一个已经带上这些内容的 harness 检出。

[`manager-plugins-worktree.patch`](manager-plugins-worktree.patch) 把该检出状态
记录成一个可用 `git apply` 应用的补丁，取自已发布产物所对应的那份工作区。

## 补丁包含什么

- `packages/skill/skills-manager/`——本包的上游源码、测试与构建配置。
- 让它可构建、可加载的接线：`tsconfig.base/client/host`、`apps/cli/package.json`、
  `pnpm-lock.yaml`、`scripts/gen-tool-catalog.ts`、
  `scripts/package-dependency-policy.ts`，以及生成的客户端 slot 目录。
- 文档面：包 README、技能组 README、带截图的用户指南页、功能 Agent Note，
  以及生成的工具、配置与模块目录。
- 位于 `apps/cli/config/examples/skills-manager/` 的 CLI overlay 示例。

补丁同时包含同门的 `@deepseek-ai/dsh-mcp-manager` 插件。两个管理器共用若干文件——
`tsconfig.*`、`apps/cli/package.json`、`scripts/gen-tool-catalog.ts`、
`scripts/package-dependency-policy.ts` 以及生成的目录——这些 hunk 一旦拆分就会让补丁
失效，因此应用它会同时装上两个管理器。

## 应用方式

```sh
# run this first from a checkout of this repository, which records the base commit
commit="$(sed -n 's/^- Harness commit: `\(.*\)`$/\1/p' PROVENANCE.md)"

git clone https://github.com/deepseek-ai/deepseek-harness
cd deepseek-harness
git checkout "$commit"
git apply /path/to/dsh-skills-manager/docs/harness/manager-plugins-worktree.patch
pnpm install
pnpm run build
```

然后把构建产物同步回本仓库：

```sh
cd /path/to/dsh-skills-manager
scripts/sync-from-harness.sh /path/to/deepseek-harness
```

## 说明

- 该补丁已针对它取自的那个上游提交做过 `git apply --check` 校验，可干净应用。
- 补丁不含构建产物与 `node_modules`；`pnpm install` 与 `pnpm run build` 会生成它们。
- `docs/` 不进入发布的 npm tarball，因此该补丁不会改变
  `npm install @ctl456/dsh-skills-manager` 下载到的内容。
