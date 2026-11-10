# 速算 · 个人心算练习室

网站入口：<https://ayden96718-rgb.github.io/notion-countdown/susuan-trainer/>

本目录的HTML、CSS、JS、图标与计时资料是生产发布产物。

- [完整源码及使用说明](project/README.md)
- [唯一权威需求](project/docs/requirements.md)
- [实施与验收报告](project/docs/IMPLEMENTATION_REPORT.md)
- [原27张参考截图索引](project/docs/SCREENSHOT_INDEX.md)

在现有 notion-countdown 仓库中只新增此文件夹，保留原倒计时首页及Pages设置。现有 main 分支根目录Pages会发布本目录，源码保存在 project/ 下。

更新时在源码目录执行 npm test、npm run build、node scripts/manifest.mjs、node scripts/prepare-pages-folder.mjs，再将生成的 artifacts/pages/susuan-trainer/ 整体同步到目标同名文件夹。project/.github/workflows/pages.yml 是独立仓库部署备选模板，在此嵌套位置不运行。
