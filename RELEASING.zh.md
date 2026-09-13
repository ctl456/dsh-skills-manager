# 发布流程

[English](RELEASING.md) | 中文

一次发布就是同一个版本号写在四个必须一致的地方。`prepublishOnly` 钩子和
tag 触发的 workflow 都会执行 `scripts/verify-release.mjs`，四者不一致时直接
让发布失败。

| 位置 | 规则 | 示例 |
|---|---|---|
| `package.json` 的 `version` | 纯 semver，不带 `v` | `0.1.0` |
| git tag | `v` + 同一个 semver，附注标签 | `v0.1.0` |
| GitHub Release | 由该 tag 创建，notes 由提交生成 | `v0.1.0` |
| `CHANGELOG.md` 标题 | `## [版本号] - YYYY-MM-DD` | `## [0.1.0] - 2026-09-12` |

## tag 规范

- 一律用附注标签（`git tag -a`），不用轻量标签：这样 tag 才带有发布说明、
  打标签的人和时间。
- tag 名必须正好是 `v<package.json 的 version>`。`v0.1.0` 和 `0.1.0` 是两个
  不同的 tag，这里只有前者是对的。
- tag 不可变。tag 推上去、版本进了 npm 之后就不要删除或移动它，改发下一个
  patch 版本，这样安装结果始终可复现。
- 预发布版本保留 semver 后缀，例如 `v0.2.0-rc.1`，并且发布到另一个
  npm dist-tag：`npm publish --tag next`。

## 发布步骤

```sh
# 1. 从跑过 pnpm run build 的 harness checkout 刷新打包产物
scripts/sync-from-harness.sh /path/to/deepseek-harness

# 2. 升版本号（只改 package.json，不提交、不打 tag）
npm version --no-git-tag-version patch     # 也可以是 minor / major

# 3. 把 CHANGELOG 里 "Unreleased" 的内容挪到新版本标题下，
#    补上日期，并更新文件底部两条比较链接

# 4. 验证 tarball 能像用户那样装进去（需要 dsh CLI）
npm run verify:install

# 5. 提交、打 tag、推送 —— 推送 tag 就会触发发布 workflow
git add -A
git commit -m "release: v0.1.1"
git tag -a v0.1.1 -m "Release v0.1.1"
git push origin main
git push origin v0.1.1
```

推送 tag 会运行 `.github/workflows/release.yml`：重新校验版本号，如果该版本
还不在 npm 上就发布，然后创建 GitHub Release 并生成 notes。两步都是幂等的，
重复运行 workflow 不会把同一个版本发两次。

## 双因素认证（2FA）

账号没开双因素认证时，npm 会拒绝发布：

```
E403 ... Two-factor authentication or granular access token with bypass 2fa
enabled is required to publish packages.
```

这是 npm 的政策，不是仓库的问题。去 npmjs.com → Account →
Two-Factor Authentication 开一次 2FA 就好。

之后 `npm publish` 的行为取决于你登记的方式：

- **验证器 App**：它会在终端里要一次性验证码。
- **安全密钥 / passkey**：它会打印一个 `https://www.npmjs.com/auth/cli/...`
  链接并等待。打开、批准，CLI 会自己继续；链接存活时间很短，要尽快确认。

只要把带 **Bypass 2FA** 的 granular token 写进 `~/.npmrc`，或者在 CI 里作为
`NPM_TOKEN` 提供，这个交互步骤就完全没有了。

需要无人值守发布时，创建一个勾选了 **Bypass 2FA**、并对本包有读写权限的
granular access token，当作下面说的 `NPM_TOKEN` secret 使用。

## 手动发布

workflow 发布不了的时候（还没配 `NPM_TOKEN`，或者 npm 出故障），可以用本机
发同一个版本：

```sh
npm publish                      # 通过 prepublishOnly 执行 verify-release.mjs
git tag -a v0.1.1 -m "Release v0.1.1"
git push origin v0.1.1           # workflow 发现版本已在 npm 上，只创建 Release
```

## 让 workflow 自动发布

在 npmjs.com 上创建一个勾选了 **Bypass 2FA**、并对本包有读写权限的 granular
token（Access Tokens → Generate New Token → Granular Access Token），把它作为
`NPM_TOKEN` secret 加到仓库里
（Settings → Secrets and variables → Actions → New repository secret）。

在这个 secret 存在之前，先手动发布再推 tag：workflow 会看到版本已在 npm 上，
跳过 npm 那一步，只创建 Release。如果版本不在 npm 上**且** secret 没配置，
workflow 会在这里故意失败，而不是留下一个没有产物的 tag。

除了长期 token，npm 还支持 trusted publishing：在本包的 npm 设置页把仓库和
`release.yml` workflow 关联起来，workflow 就用 OIDC 身份认证，不再需要 secret。

## 发布之后

- 看看包页面有没有正确渲染 README：<https://www.npmjs.com/package/@ctl456/dsh-skills-manager>。
- 看看 GitHub Release 是否已创建并指向对应 tag。
- 按用户的方式验证一次安装：

  ```sh
  dsh plugin --profile web add @ctl456/dsh-skills-manager@latest
  ```
