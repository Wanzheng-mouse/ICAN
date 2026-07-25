# Agnes 语义需求分析

## 运行链路

1. 前端将用户输入的仓储需求和已上传资料的元数据提交至 `POST /api/v1/generation/analyze`。
2. 后端从 `services/api/.env` 读取 `ICAN_AGNES_API_KEY`，调用 Agnes API 的 `POST /v1/chat/completions`。
3. 默认模型 `agnes-2.0-flash` 根据严格 JSON Schema 输出业务画像、事实缺口、风险、运行设计建议和三套候选策略。
4. 后端将结构化结果保存到 `generation_jobs.analysis`；候选生成接口再读取模型给出的策略建议，构造并验证可编辑的仓库场景。
5. 前端只展示已验证的分析和候选方案；浏览器不会接触 API Key，也不会直接调用 Agnes。

## 配置

在 `services/api/.env` 填入 Agnes 的实际密钥（不要写入前端 `.env`、`VITE_*` 变量或 Git）：

```dotenv
ICAN_AGNES_API_KEY=你的_Agnes_服务端密钥
ICAN_AGNES_BASE_URL=https://apihub.agnes-ai.com/v1
ICAN_LLM_MODEL=agnes-2.0-flash
ICAN_AGNES_REQUEST_TIMEOUT_SECONDS=300
ICAN_LLM_MAX_TOKENS=8192
```

修改后重启 FastAPI 服务。未配置密钥时，接口明确返回 `503 LLM_ANALYSIS_NOT_CONFIGURED`，不会伪造规则分析结果。

## 输出约束

请求使用 Chat Completions 的 `response_format.json_schema` 约束模型只输出 JSON。核心字段包括：

- `profile`：仓库面积、订单与峰值、SKU、料箱/托盘 AGV、机械臂、工位、充电桩、区域、流程和 KPI。
- `assumptions`、`questions`、`risks`：未提供的事实、需要确认的业务条件与工程风险。
- `operational_design`：单向交通、避碰、充电和作业链的设计建议。
- `candidate_guidance`：`balanced`、`throughput`、`energy_saver` 三个候选方案的名称、理由及注意项。

模型不得直接写入数据库或执行操作。后端仍会校验结构化响应、补齐可推导数据、生成无重叠场景，并使用现有场景校验器复核。

展示给用户的可信度由后端依据模型**实际成功提取**的关键业务字段、区域/流程/目标信息和资料来源数量统一校准；它不是模型随意生成的自评分，因此不会再出现 `0%` 或超出范围的展示错误。

## 故障处理

- 认证错误、限流、上游错误或超时：返回可识别的 `502` 错误，不伪装为成功分析。
- 无效 JSON 或不完整业务画像：返回 `502 LLM_ANALYSIS_INVALID_STRUCTURED_OUTPUT` / `LLM_ANALYSIS_SCHEMA_VALIDATION_FAILED`。
- 密钥缺失：返回 `503`；在后端 `.env` 填入密钥并重启即可。
