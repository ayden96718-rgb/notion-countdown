# GitHub Pages 免费部署

当前目标为现有公开仓库 `ayden96718-rgb/notion-countdown` 的 `susuan-trainer/` 子目录。用户v2.4明确批准，只新增此文件夹，保留根目录原倒计时、文件和Pages设置。实际发布结果见 `IMPLEMENTATION_REPORT.md`。

## 当前：沿用现有仓库Pages

现有Pages设置已经是 `main` 分支、根目录、legacy构建，无需修改设置或原文件。生产网址为该站点下的 `/susuan-trainer/`。

源码目录运行：

```bash
npm test
npm run build
node scripts/manifest.mjs
node scripts/prepare-pages-folder.mjs
```

将生成的 `artifacts/pages/susuan-trainer/` 同步到目标仓库的同名新文件夹。该文件夹根目录是生产网页资产，`project/` 是完整源码、文档、27张参考图和验收证据。推送main后沿用原Pages自动构建。

预计网址：`https://ayden96718-rgb.github.io/notion-countdown/susuan-trainer/`；必须实际访问成功才记录为已发布。原倒计时继续位于 `https://ayden96718-rgb.github.io/notion-countdown/`。后续只同步子文件夹，不能覆盖仓库根目录。

## 备选：未来独立仓库的GitHub Actions

最初独立仓库创建被当前连接的403权限限制阻止。以下模板保留作以后迁移使用；现有子目录交付不依赖此工作流，也不往原仓库根目录添加工作流。

1. 将本项目文件放在仓库根目录，默认分支为 `main`。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 推送 `main`，或在 **Actions → Test and deploy GitHub Pages → Run workflow** 手动运行。
4. 工作流在 Node 22 上执行 `npm test`、`npm run build`，只上传 `dist/`，再发布到 Pages。
5. 等待部署任务成功，访问工作流返回的实际网址。预期格式为 `https://ayden96718-rgb.github.io/susuan-trainer/`，最终以部署结果为准。

如果首次运行提示 Pages 未启用，请先完成第2步再重新运行。工作流仅需要标准 `GITHUB_TOKEN` 的 `contents: read`、`pages: write` 与 `id-token: write`，不需要另存任何密钥。Pages 是公开静态站；生产网页不连接数据库。

## 本地预览发布产物

```bash
npm test
npm run build
npm run preview
```

默认预览 <http://localhost:4173/susuan-trainer/>，也支持根路径。可用 `PORT=8080 npm run preview` 改端口。开发服务器不用于公网生产运行。

## 离线更新

`scripts/build.mjs` 根据完整站点资产计算缓存版本，并写入应用和Service Worker。缓存按站点路径隔离；更新只清理当前路径的旧版本。正在使用的客户端保持当前版本，全部关闭再打开后启用新版本。

离线验收：联网进入站点，等待页脚“离线已就绪”，切断网络，重新加载并完成一组。首次访问仍需网络。

## 发布边界

- 页面资产为原创HTML/CSS/JS及图标；第三方参考截图不复制进 `dist/`。
- GitHub仓库保存交接文档和参考图；测试证据全部为隔离浏览器生成的示例记录。真实个人训练记录不写入仓库。
- 无账号、跨设备同步、收费API、云数据库或运行服务器。
- `dist/` 为生成目录，不提交。GitHub工作流每次自行构建。
