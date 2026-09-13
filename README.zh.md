# dsh-skills-manager

[English](README.md) | 中文

一个 **非官方** 的 DeepSeek Harness 插件，用来管理
[技能（Agent Skills）](https://deepseek-harness.github.io/deepseek-harness/)：
在网页设置卡片或对话中新增、编辑、启用和删除技能，harness 会用它自带的
`skill` 工具把技能加载给模型。

> 本项目与 DeepSeek 没有隶属、背书或支持关系。署名见 [NOTICE.md](NOTICE.md)，
> 授权条款见 [LICENSE](LICENSE)。

## 它能做什么

- 维护一份技能清单，并通过一个 `ctx.skills` provider 发布出去，和 harness 自带的
  文件系统 provider 走同一个接口。
- 让每个启用的技能都能被 harness 自带的 `skill` 工具加载：模型会在会话技能目录里
  看到它，并像读取磁盘上的 `SKILL.md` 一样读取它的正文。从网页添加的技能是一等
  技能，而不是插件私有的清单条目。
- 不用改 YAML、不用重启，就能新增、编辑、删除、启用和停用技能。
- 可以从 GitHub 链接或 `.zip` 压缩包导入整套技能集合：先展示来源里有什么，再只
  安装你勾选的部分。
- 为不熟悉配置文件的用户提供一个网页表单。

## 环境要求

- 已安装带 `dsh` 命令的 DeepSeek Harness，版本 `0.1.5-rc.2` 或兼容版本。插件把它
  接入的 harness 包声明为 peer 依赖（`@deepseek-ai/dsh-skill`、`dsh-settings`、
  `dsh-tools`、`dsh-util-values`、`dsh-home-paths`、`@deepseek-ai/cordis`）；
  安装到的 profile 必须已经提供这些包，官方自带的 `web` profile 满足条件。
- 安装时需要联网，让 npm 解析这些 peer 依赖。

## 安装

```sh
dsh plugin --profile web add @ctl456/dsh-skills-manager
dsh --profile web
```

任何 profile 都可用；`web` 是带网页界面的那个。卸载：

```sh
dsh plugin --profile web remove @ctl456/dsh-skills-manager
```

如果要从打包好的 tarball 或本地代码安装：

```sh
npm pack                                   # 生成 dsh-skills-manager-<version>.tgz
dsh plugin --profile web add file:/绝对路径/dsh-skills-manager-0.2.0.tgz
```

## 在网页界面里使用

打开 **设置 → 技能（Skills）**，它是设置导航里独立的一页，位于 **Agent 预设**
下方。

![首次打开技能页：搜索框和“添加技能”按钮上方是空列表](docs/images/skills-card.png)

| 字段 | 含义 |
|---|---|
| 名称 | 技能的标识：小写字母、数字和单个连字符，最长 64 个字符。模型用这个名字调用技能。 |
| 描述 | 一句话说明这个技能做什么、什么时候用；模型据此决定是否加载。 |
| 何时使用（可选） | 补充触发场景，例如“当用户要求整理发布说明时”。 |
| 技能内容 | Markdown 格式的操作说明。写清模型加载后要照着做的步骤。 |
| 允许模型自动调用 | 关闭后技能仍会保存，但不会出现在模型的技能目录里。 |
| 允许用 / 唤出 | 关闭后技能不会出现在输入框的 / 技能列表中。 |

点 **添加技能** 会弹出卡片式对话框。填好按 **保存** 后立即生效，无需重启。

![添加对话框：名称、描述、何时使用、技能内容，以及两个调用开关](docs/images/skills-dialog.png)

页面会列出所有已配置技能及其描述、大小、启用状态，以及 **编辑**、
**启用/停用** 和 **删除** 按钮。名称重复时会覆盖原有条目。列表每页显示 5 条，
搜索框会同时匹配名称和描述。

![添加技能后的页面：每一行显示描述、大小和操作按钮](docs/images/skills-configured.png)

## 导入别人写好的技能

网上发布的技能大多放在仓库或 `.zip` 里，而不是一张表单里。工具栏的
**从 GitHub 导入** 会先读来源、不写任何东西，再安装你选择的部分。

来源可以是：

- 仓库地址：`https://github.com/owner/repo`。
- 仓库里的某个目录链接：
  `https://github.com/owner/repo/tree/main/skills/my-skill`。
- 简写 `owner/repo`。
- 本地 `.zip` 压缩包（最大 8 MB），来源不在 GitHub 时用。压缩包外面那层文件夹
  会被自动去掉。

点 **预览** 会读取来源，并列出它提供的每个技能：描述、文件数和将要写入的大小。
host 无法安装的技能会连同原因一起列出，并且不能勾选。

勾选想要的技能——可安装的默认全部勾上，所以只有一个技能的仓库不用再点第二次——
然后点 **安装**。对话框会就地确认识别到的结果，后面的列表也会自动刷新。

来源会按结构识别：根目录一个 `SKILL.md` 就是一个技能；`skills/<name>/SKILL.md`
这种容器、或 `<name>/SKILL.md` 这种集合，会整体识别为其中的多个技能；
`/tree/<ref>/<dir>` 链接则只读那一个目录。两个目录解析出同一个技能名时只安装
一次，被跳过的那一个会明确报出来，而不是静默覆盖。

仓库特别大、GitHub 只返回部分列表时，用 **限定目录** 缩小读取范围。

## 在对话里管理技能

`skills_manager_list` 读取当前清单；`skills_manager_add`、
`skills_manager_remove` 和 `skills_manager_set_enabled` 修改它。
`skills_manager_import` 与对话框走同一条读取路径：只给来源时是预览，同时给出
名称时是安装，因此模型可以先翻一遍集合再决定装什么。每次调用都会返回最新清单，
包含每个技能的调用开关和校验问题，所以你可以直接让模型帮你添加技能，而不用自己
填表。

## 配置保存在哪里

网页卡片和模型工具编辑的是 `$DSH_HOME/settings.yaml` 里同一个 `skills-manager`
配置节。`cordis.patch.yml` 里的 `skills` 数组是组合配置的 base 层，因此 profile 或
`--patch` 覆盖层可以预置技能，而最终生效的始终是设置文档里的值。

插件的组合条目还支持这些选项：

| 选项 | 默认值 | 含义 |
|---|---|---|
| `skills` | `[]` | 预置技能清单；设置文档里的值优先。 |
| `providerName` | `skills-manager` | 注册到 `ctx.skills` 上的名字。 |
| `rank` | 管理器自身的排序位 | 发现顺序。 |
| `tools` | `true` | 是否注册 `skills_manager_*` 工具。 |
| `githubToken` | 无 | 导入时读取 GitHub 用的 token。 |

`githubToken` 只在导入时需要。GitHub 对匿名 API 请求按地址限制每小时 60 次，预览
一个大集合就可能用光；私有仓库也必须靠它才能读取。不填时按匿名读取。

## 限制

- 一个受管技能就是一段 Markdown 正文。打包资源（脚本、模板、参考文件）不在这个
  注册表范围内，这类技能请继续使用磁盘上的 `SKILL.md` 目录。
- 技能正文以普通设置值保存，请不要把密钥写进去。导入技能的 `SKILL.md` 正文也会
  按同样方式保存，所以如果导入的技能正文里带着密钥，那个密钥就会被写进
  `$DSH_HOME/settings.yaml`。
- 导入写的是文件，不是实时链接：副本不会跟随来源仓库后续的提交。对已有名字再次
  导入会替换该技能，更新版本就是这么做的。
- 单次导入上限为 400 个文件、单文件 2 MB、单技能 24 MB，因此价值在于大数据集或
  二进制资源的技能不适合这种方式。

## 重新构建打包产物

`lib/` 和 `src/` 需要在 DeepSeek Harness 源码仓库里构建，因为上游构建链和工作区
耦合：host 产物来自仓库根目录的 `tsdown` 配置和 Typert 代码生成插件，浏览器产物
来自 `packages/client/tsdown.client.ts` 及其辅助模块。因此不支持在本仓库独立构建。

```sh
git clone https://github.com/deepseek-ai/deepseek-harness
cd deepseek-harness && pnpm install && pnpm run build
cd /path/to/dsh-skills-manager
scripts/sync-from-harness.sh /path/to/deepseek-harness
```

该脚本会刷新 `lib/`、`src/` 和 `cordis.patch.yml`，重新套用本仓库的包名，并把
harness 版本与提交写入 `PROVENANCE.md`。

该检出必须已经带有管理器包，而上游 DeepSeek Harness 并不包含它——
[docs/harness](docs/harness/README.zh.md) 里有把它装进去的集成补丁。

## 发布前的验证

```sh
npm run verify:install
```

它会打包 tarball、检查内容、用 `dsh plugin add file:<tarball>` 安装到一个临时
profile，并确认组合后的 profile 树里包含 `skills-manager` 这一行。这一步用来区分
“用 `link:` 挂本地代码能跑”和“用户按标准方式安装能跑”。

## 发布

`package.json` 里的 `version`、`v<version>` git tag 和 `CHANGELOG.md` 顶部这一节
必须一致；推送 tag 会触发 `.github/workflows/release.yml`，当该版本尚未发布时
发布到 npm，并创建 GitHub Release。完整流程（tag 规则、发布清单、npm token 配置）
见 [RELEASING.zh.md](RELEASING.zh.md)。

## 授权

MIT，保留上游版权声明——见 [LICENSE](LICENSE) 和 [NOTICE.md](NOTICE.md)。
