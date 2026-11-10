# 截图索引与裁剪原则

**来源**：用户在本聊天中上传的“行测小助手”截图。**状态**：已裁剪，去掉 iOS 状态栏、手机电量/时间、顶部微信入口、底部系统手势条、部分无关大面积空白。保留对开发有意义的数字、题型、计时标准、键盘、自定义设置及答题完成后的成绩/逐题复盘界面。

- 这些截图是**设计/验收参考，不应直接作为网页UI素材**，第三方标识、按钮、配色应由Codex独立实现。
- 个别原图仅显示某题型的一道示例，**不能**推断其他算法的出题逻辑或时间门槛。
- 建议先浏览总览图（现含27张参考图）：[00-overview.jpg](screenshots/00-overview.jpg)。

| 原上传文件 | 裁剪后文件 | 目的/可读证据 |
|---|---|---|
| `IMG_9944.png` | [`01-flash-modes.png`](screenshots/01-flash-modes.png) | 闪电心算模式选择：闪电心算首页与难度分组 |
| `IMG_9945.png` | [`02-flash-card.png`](screenshots/02-flash-card.png) | 闪电心算单数字卡片：仅一张数字卡、进度条、点击切换 |
| `IMG_9946.png` | [`03-question-count-popup.png`](screenshots/03-question-count-popup.png) | 题量选择：快速10、正常15、自定义5～100（参考UI） |
| `IMG_9947.png` | [`04-two-digit-15-questions.png`](screenshots/04-two-digit-15-questions.png) | 两位数加减法15题：合格42秒/良好33秒/优秀27秒；完整答题页与键盘 |
| `IMG_9948.png` | [`05-two-digit-10-questions.png`](screenshots/05-two-digit-10-questions.png) | 两位数加减法10题：合格28秒/良好22秒/优秀18秒；完整答题页与键盘 |
| `IMG_9950.png` | [`06-reference-feature-menu.png`](screenshots/06-reference-feature-menu.png) | 参考应用功能列表：后续参考功能的原始菜单名称 |
| `IMG_9951.png` | [`07-three-digit-subtraction.png`](screenshots/07-three-digit-subtraction.png) | 三位数减法：10题：38/30/24秒 |
| `IMG_9952.png` | [`08-three-digit-addition.png`](screenshots/08-three-digit-addition.png) | 三位数加法：10题：40/32/26秒 |
| `IMG_9954.png` | [`09-three-by-one-multiplication.png`](screenshots/09-three-by-one-multiplication.png) | 三位数×一位数：10题：60/50/40秒 |
| `IMG_9955.png` | [`10-two-by-one-multiplication.png`](screenshots/10-two-by-one-multiplication.png) | 两位数×一位数：10题：38/30/24秒 |
| `IMG_9956(1).png` | [`11-three-minus-two.png`](screenshots/11-three-minus-two.png) | 三位数减两位数：10题：42/34/28秒 |
| `IMG_9957.png` | [`12-multiply-11.png`](screenshots/12-multiply-11.png) | 两位数×11：10题：38/30/24秒 |
| `IMG_9958.png` | [`13-two-by-one-variant.png`](screenshots/13-two-by-one-variant.png) | 两位数×一位数另一题：10题：38/30/24秒；与10号同类但不同算式 |
| `IMG_9959(1).png` | [`14-multiply-15.png`](screenshots/14-multiply-15.png) | 两位数×15：10题：38/30/24秒 |
| `IMG_9960.png` | [`15-two-by-two-multiplication.png`](screenshots/15-two-by-two-multiplication.png) | 两位数×两位数：10题：90/75/60秒 |
| `IMG_9961.png` | [`16-three-by-one-division.png`](screenshots/16-three-by-one-division.png) | 三位数÷一位数：10题：38/30/24秒 |
| `IMG_9962.png` | [`17-three-by-two-division.png`](screenshots/17-three-by-two-division.png) | 三位数÷两位数：10题：90/75/60秒 |
| `IMG_9963.png` | [`18-multiplication-estimation.png`](screenshots/18-multiplication-estimation.png) | 乘法估算：10题：48/40/32秒；原界面显示允许误差±5% |
| `IMG_9965.png` | [`19-five-by-three-division.png`](screenshots/19-five-by-three-division.png) | 五位数÷三位数：10题：90/75/60秒 |
| `IMG_9966.png` | [`20-fraction-to-percent.png`](screenshots/20-fraction-to-percent.png) | 分数→百分数：10题：90/75/60秒；原界面显示允许误差±3% |
| `IMG_9967.png` | [`21-custom-builder.png`](screenshots/21-custom-builder.png) | 自定义出题弹窗：首数位数、符号、后数位数/固定值/范围；仅参考交互 |
| `IMG_9948.png`（二次局部裁剪） | [`22-numeric-keyboard-detail.png`](screenshots/22-numeric-keyboard-detail.png) | 触屏数字键盘细节；清空、退格、确定等按钮 |

| `IMG_9968.png` | [`23-flash-result-summary.png`](screenshots/23-flash-result-summary.png) | **闪电心算答题完成页**：整组用时13.0秒、答案37、10个数字的两行回顾（含序号）、答对标记，以及“重新开始/返回选择”操作。 |
| `IMG_9969.png` | [`24-quiz-result-dialog.png`](screenshots/24-quiz-result-dialog.png) | **普通算式训练完成弹窗**：练习结果“共答对10道、答错0道、总用时0:0:53”、确定/返回按钮；半透明背景能看到逐题复盘列表。 |
| `IMG_9970.png` | [`25-quiz-answer-review.png`](screenshots/25-quiz-answer-review.png) | **逐题复盘页**：每行题目、正确答案、用户答案、✓对错标记、每题耗时（例如5.6s），整组时间在页头；底部“重来/返回”。 |

| `IMG_9971.png` | [`26-main-menu-random-order.png`](screenshots/26-main-menu-random-order.png) | **统一训练总菜单参考**：三列浅绿题型卡片、正序/倒序/乱序切换（当前选中乱序）、触控笔开关、题量、开始练习、导出题目与历史记录；**新站首页第1/2组应直接叫「个位数相加」「个位数相减」，不要增加「闪电心算」中转入口**。 |
| `IMG_9972.png` | [`27-mixed-add-sub-timing-10q.png`](screenshots/27-mixed-add-sub-timing-10q.png) | **第10组混合加减计时标准（用户明确指定）**：10题合格42秒/良好34秒/优秀28秒；展示题号、右上角计时、居中算式、数字键盘。原示例`1588−695`含四位数，**仅用其计时和界面作为证据，不改变第10组两个三位数的出题限制**。 |

## 去重记录

- `IMG_9964.png` 与 `IMG_9965.png` 对应相同 `17677/672=`、同样的90/75/60秒评定；仅保存 `17-three-by-two-division.png`，避免重复占用Git空间。
- `IMG_9955.png` 与 `IMG_9958.png` 都属于“两位数×一位数”但式子不同（`68×7`、`61×4`），所以两张均保留，以佐证同一题型标准。
- 用户曾重复上传 `IMG_9961(1).png` 等与无后缀文件字节相同的图片，按一份处理。

## 首页与混合加减截图的解释边界

- 26号图用于参考完整**统一总菜单**的布局，并非要求原封不动保留小程序全部旧按钮。网站首页必须有「个位数相加」「个位数相减」两项，进入后直接展示单数字闪卡。
- 27号图的**合格42秒/良好34秒/优秀28秒**由用户明确指定给第10组10题混合加减。该图示例是`1588−695`，不要因此产生四位数题目；第10组仍是三位数加减混合。
- 相关计时数据详见 `data/timing-reference.json` 与 `docs/timing-standards.md`，且自定义题量的线性外推应标注为推算。

## 答题完成交互的页面分工

- **23号是闪电心算完成页**：先统一计算10个数字，最终输入答案，再一次性展示总答案、用时、10个数字与重新开始/返回选择。图中的数字37和13.0秒仅为示例，不得写死。
- **24号是普通算式训练完成后的汇总弹窗**：明确显示正确题数、错误题数、总用时与关闭动作，弹窗背景为完整练习回顾页面。
- **25号是普通算式训练的逐题复盘页**：逐题保留算式、正确答案、输入答案、对错标识和单题秒数，整组用时在顶部；支持重新练习或返回。
- **复盘页中的原小程序示例不满足用户第3～5组的强制进借位要求**，因此参考的只是结果页面交互，不能把示例题目作为定制出题规则。
- **用户没有确认错题对合格/良好/优秀的具体影响**：UI应显示正确/错误统计，但不要把截图没有写出的分级算法伪装成已核实事实。

## 隐私与外观边界

- 文件不包含用户的 GitHub 凭证或任何私密训练记录。
- “裁剪截图”仍然取自第三方应用，公开仓库会使其对所有人可见。如果之后希望严格私密，应使用私有参考资料仓库，并将网站代码放在公开 Pages 仓库；这需要额外账户配置。
- 截图并不是产品设计规范的替代品：需要以 `docs/requirements.md` 中已确认用户规则为准。
