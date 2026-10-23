# szrczc

苏州人才政策平台，包含政策查询、地区对比、资料下载及基于 Node.js / MySQL 的登录注册功能。

## 本地运行

需要 Node.js 22+ 和 MySQL 8.0.16+。

```powershell
cd 政策/全市政策
npm ci
Copy-Item .env.example .env
# 按本地数据库环境填写 .env，再初始化数据库
npm run db:init
npm start
```

已有本地 `.env` 时请保留原配置。详细配置、接口和测试说明见 [项目 README](政策/全市政策/README.md)。

项目保留原目录结构；浏览器检查脚本位于 `政策/.checks`。数据库密码和会话密钥通过本地 `.env` 配置。
