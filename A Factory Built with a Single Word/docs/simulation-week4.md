# 第 4 周：真实仿真运行与实时数据闭环

## 范围

负责人 B 的第 4 周交付把仿真从静态演示切换为可创建、可控制、可恢复的运行实例。每个运行实例有真实 `simulationId`，默认包含 10 台 AGV 和 20 个订单。

## 运行模型

`services/api/app/simulation_engine.py` 以 SimPy 每 tick 推进一秒：

1. 为空闲 AGV 分配待处理订单；低于电量阈值先进入充电调度。
2. 使用曼哈顿路径移动；道路封闭时增加绕行点。
3. 同一目标点由预约集合保护，冲突记为拥堵与事件。
4. 到达拣选点后转向投递点；完成后更新订单、能耗、利用率和时长。
5. 所有订单完成时写入 `simulation_completed` 并将运行置为 `finished`。

运行状态写入 `SimulationRun.config.runtime`，REST 快照与 WebSocket 断线重连均以该状态为准。

## 异常

| 类型 | 作用 |
| --- | --- |
| `road_closed` | 封闭中部通道并对运行路径重新规划 |
| `low_battery` | 将一台 AGV 降至低电量并转入充电调度 |
| `order_surge` | 增加待处理订单 |
| `station_down` | 增加拥堵风险指标 |

异常只能在 `running` 状态注入；成功后同步写入 `anomaly_injected` 事件和快照指标。

## 前端数据流

编辑器保存场景后调用 `POST /simulations`，把返回的真实 `simulationId` 放进路由和 Zustand 上下文。仿真页面：

- 首次与重连后读取 REST 快照；
- 连接 WebSocket 接收 tick、事件和完成消息；
- 用 `WsClient` 每 15 秒发送心跳，服务端返回 `pong`；
- 请求失败后客户端按 3 秒起步的退避重连，恢复后再次失效快照缓存。

## 模块级 Mock 切换

`VITE_USE_SIMULATION_MOCK` 优先于全局 `VITE_USE_MOCK`。本地联调推荐：

```dotenv
VITE_USE_MOCK=true
VITE_USE_SIMULATION_MOCK=false
```

这样其余仍未接入页面保持演示数据，仿真模块单独请求真实后端。

## 验收

```powershell
cd services/api
python -m pytest tests -q
```

其中第 4 周测试会验证 10 AGV/20 订单可完成、充电/完成事件存在、异常事件和智能体接口可读，以及 WebSocket 初始 tick 与 `ping`/`pong`。