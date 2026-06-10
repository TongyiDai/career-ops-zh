# 模式：求职管道 tracker

## 目标

维护 `data/applications.md`、`data/followups.md`、`data/interviews.md` 和 `data/contacts.md`。默认以后者作为本地事实源；如果用户需要团队协作或移动端查看，可以使用可选的飞书多维表格后端。

## 状态

使用 `templates/states.yml` 中的状态。

## 原则

- 不重复创建同一公司同一岗位；
- 更新已有机会时保留历史备注；
- 面试、跟进、联系人分开记录；
- 每次推进都记录下一步动作和日期。

## 可选后端：飞书多维表格

配置模板：

```text
config/tracker-backends.example.json
```

初始化后可复制为：

```text
config/tracker-backends.json
```

推荐使用方式：

```bash
# 预览导出，不联网、不写飞书
npm run tracker:sync

# 使用用户自己的配置导出飞书 Base records package
npm run tracker:sync -- --config=config/tracker-backends.json --backend=lark-base

# 打印导入/去重操作计划
npm run tracker:sync -- --config=config/tracker-backends.json --backend=lark-base --print-cli
```

脚本会把本地 Markdown 表格转换为：

```text
output/tracker-lark-base-records-YYYY-MM-DD.json
```

### 同步边界

- `data/*.md` 仍是默认事实源，避免强绑定飞书账号；
- 飞书 Base 同步默认只生成 records package，不自动联网写入；
- 真正写入飞书前，必须按 `公司 + 岗位`、`姓名 + 公司 + 角色` 等 key fields 去重；
- 真实写入必须显式使用 `--execute-lark`，脚本会先 search 再 create/update；命中多条时拒绝写入；
- 不要把私密联系方式、薪资、面试评价同步到共享 Base，除非用户明确知道权限范围；
- 如果使用 lark-cli 或本项目的 lark-base 能力写入，优先创建草稿/测试表验证字段映射。
