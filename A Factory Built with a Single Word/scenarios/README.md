# 仓库场景 JSON 文件

> 由负责人 B 在阶段 2 后填充，负责人 A 可在前端 mock-data 中引用。

每个场景文件命名规范：`scn-<场景类型>-<编号>.json`

最小字段：
```json
{
  "schema_version": "1.0",
  "scenario_id": "scn-ecom-001",
  "name": "电商中型仓-双波次拣选场景",
  ...
}
```
详见 `packages/contracts/src/index.ts` 的 `Scenario` 接口。
