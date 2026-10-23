# 苏州人才政策平台 · 登录保护与真实身份验证

正式入口为 `server.js`，使用Express、mysql2/promise、dotenv、bcrypt、express-session和express-mysql-session。账户数据和Session均使用真实MySQL，不在启动失败时退回内存、SQLite或模拟账户。

界面来自 `苏州人才政策/登录注册.html`、`注册.html`、`账户.html`。登录成功固定进入原来的 `/index.html`；账户页保留在 `/account`。原首页、九个政策详情和政策对比页面已经接入Express服务端身份验证，所有政策脚本、CSS、图片、JSON及Word/Excel下载均在`requireAuth`之后提供。原政策页面、金额、数据、计算规则和资源相对位置保持原样。

## 接口

| 接口 | 作用 |
|---|---|
| `GET /api/auth/csrf` | 获取当前会话的CSRF Token |
| `POST /api/auth/register` | 创建真实账户，201成功、409重复、422字段错误 |
| `POST /api/auth/login` | 用户名或邮箱登录，200成功、401凭据错误、429限流 |
| `GET /api/auth/me` | 当前用户安全字段；未登录或会话失效返回401 |
| `POST /api/auth/logout` | 删除服务端Session、清除Cookie |
| `GET /api/health` | 检查真实数据库连接，失败返回503 |

POST请求必须包含同源Origin、当前会话Cookie和 `X-CSRF-Token`。新表单会自动先获取CSRF Token，再提交JSON；登录后再调用me确认Cookie会话有效，之后进入原首页。注册成功引导用户登录，不自动登录。

注册JSON：`username`、`email`、`password`、`confirmPassword`。登录JSON：`identifier`、`password`；`returnTo`经过站内校验，正式后端仍统一进入`/index.html`，不接受客户端选择外部跳转目的地。

## 原站接入与访问规则

没有移动网站目录，也没有在身份验证之前公开托管它。`server/routes/policy-site.js`仅提供原目录中明确允许的浏览器文件和11份文档：根目录的首页、Word和Excel，及`pages/`、`css/`、`js/`、`assets/`、`data/`中的对应资源。保留`pages/详情.html → ../文档名.docx`及原脚本相对URL，因此共享导航、图表和文档引用继续有效。README、源文件清单、认证HTML副本、后端代码、数据库脚本和.env不会通过政策资源路由下载。

公开入口仅为`/login`、`/register`、认证所需的6份指定素材、健康检查及登录注册/CSRF接口。访问`/`、`/index.html`及任意政策HTML时，未登录跳转`/login`；未登录请求受保护API、脚本、数据、图片或文档返回401 JSON。HEAD、Range、缓存验证和旧Session Cookie同样先通过身份验证；失效和被禁用账户不能读取文件。文件白名单、路径校验及真实路径检查阻止目录穿越、重复编码、Windows特殊路径和符号链接逃逸。

服务端只在HTML响应中加入页面底部的账户信息/退出入口及`/session-ui/`受保护样式和脚本。共享`css/navigation.css`和`js/navigation.js`在首页及所有子页的导航右侧增加用户中心；原HTML、政策数据和详情页原脚本未改写。受保护响应禁止缓存；历史恢复时重新验证会话，退出后旧Cookie失效。前端检查只是界面辅助，关闭JavaScript仍由Express决定是否允许访问。

用户中心通过`GET /api/auth/me`读取真实`username`和新增的`createdAt`字段；后者来自MySQL的`users.created_at`，不会用登录时间或客户端当前时间替代。下拉菜单提供“我的账号”、以北京时间显示的“注册时间”和“退出登录”，支持点击、Enter/空格、方向键、Home/End、Escape及焦点移出关闭。移动端保留图标和截断后的用户名，下拉菜单完整显示长用户名；原六个导航入口顺序及八地菜单保持原样。

顶部退出先获取CSRF Token，再调用`POST /api/auth/logout`，仅在服务器确认成功后跳转`/login`。原站底部退出入口继续可用。Session销毁和文件访问检查仍由Express执行；API和页面同时发送`Cache-Control: no-store`、`Pragma: no-cache`、`Expires: 0`，受保护文件另使用`private, no-store`。历史恢复时先隐藏旧页面，再检查真实会话。

正式访问必须使用`npm start`提供的地址。Live Server、双击HTML、其他静态服务器或代理直接暴露原文件都会跳过Node服务，不能用于发布这个受保护网站。生产代理只向Express转发请求，不要另设指向政策目录的静态文件规则；有本机文件读取权限的人仍可直接查看磁盘文件。

用户名采用NFKC规范化，长度3–30个字符，允许中文、字母、数字、下划线和短横线。邮箱小写并由后端验证。密码8–64个字符，UTF-8不超过72字节；两次密码必须一致。bcrypt成本默认为12，所有用户数据SQL使用参数。数据库唯一索引处理并发重复。

## 安装与配置

需要Node.js 22+、MySQL Server 8.0.16+。Workbench是管理工具，必须另有运行中的MySQL Server。

在PowerShell进入应用目录。先保证Node/npm可用，再安装依赖；本机没有全局Node时使用已有便携运行环境：

```powershell
cd 'C:\Users\11811\Desktop\网页\政策\全市政策'
# 已安装并配置Node.js PATH时可以跳过下面两行。
$runtimeDirectory = (Resolve-Path -LiteralPath '..\.tools\node-v24.21.0-win-x64').Path
$env:PATH = $runtimeDirectory + [IO.Path]::PathSeparator + $env:PATH
npm ci
if (!(Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
```

新电脑没有便携目录时先安装Node.js 22+并打开新的终端，再执行npm ci。已有`.env`请保留，不要覆盖本机密码或稳定的Session密钥。

填写 `.env` 中的 `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`。库名默认为 `suzhou_talent_policy`。密码占位值不能保留；含 `#` 等特殊字符时按dotenv规则加引号。远程MySQL必须启用 `DB_SSL=true` 并配置 `DB_SSL_CA`，验证证书链和主机名。

生成Session密钥，并仅在本地写入 `.env` 的 `SESSION_SECRET`：

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

正式启动现在必须填写 `SESSION_SECRET` 和 `APP_ORIGIN`。密钥至少32个字符，重启时保持不变；它不是前端Token。`APP_ORIGIN`必须与浏览器访问源完全一致，例如 `http://localhost:3000`，不能与 `http://127.0.0.1:3000` 混用。`.env`、证书和备份已被gitignore排除。

## 数据库初始化

`database/schema.sql` 使用utf8mb4和InnoDB，创建以下三张业务表：

- `users`：唯一用户名/邮箱、密码哈希、状态、角色、注册/更新/最近登录时间。
- `user_sessions`：Session ID、JSON会话数据、过期时间和可空用户外键；匿名CSRF会话也保存在此表。
- `login_logs`：登录成功/失败、时间、IP和User-Agent；登录标识采用HMAC，不记录密码。

保留的 `database/001-auth.sql` 是历史认证迁移，未改写。已经存在的用户数据不会清空。可在Workbench使用管理账户执行schema.sql；如果已有users表，初始化会追加缺失的Session/审计表。已有对象结构不符合要求时应制定数据迁移，不能删表重建。

也可临时在 `.env` 配置具备建库建表权限的账户：

```dotenv
MIGRATION_DB_USER=replace_with_your_migration_user
MIGRATION_DB_PASSWORD=replace_with_your_migration_password
```

替换占位值后执行：

```powershell
npm run db:init
```

初始化按 `.env` 的DB_NAME执行，建表后检查字段、字符集、唯一索引和Session主键。完成后移除临时迁移凭据。

通过Workbench管理账户创建运行账户，并授予所需权限。密码仅为操作占位值，必须在本地替换；账户已存在时不要重复创建：

```sql
CREATE USER 'suzhou_app'@'localhost' IDENTIFIED BY '请在本地替换为独立强密码';
GRANT SELECT, INSERT, UPDATE ON suzhou_talent_policy.users TO 'suzhou_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON suzhou_talent_policy.user_sessions TO 'suzhou_app'@'localhost';
GRANT INSERT ON suzhou_talent_policy.login_logs TO 'suzhou_app'@'localhost';
```

生产运行账户禁止使用root，建库迁移凭据不作为长期运行凭据。运行账户对users不需要DELETE权限。

## 启动

```powershell
npm run db:check
npm start
# 开发运行：npm run dev
```

默认端口3000。使用 `.env` 的APP_ORIGIN访问`/`或`/index.html`，未登录自动进入`/login`；可通过`/register`创建账号，登录后使用原站。启动会验证MySQL、用户和会话表，然后建立MySQL Session Store；缺少配置或数据库失败时以非零状态退出，不宣称成功。

`npm run preview:auth`仅在3001端口预览界面，不连接MySQL、不挂载认证API。真实注册和登录必须通过正式服务使用。

## 会话与安全

Session数据位于MySQL，浏览器仅持有HttpOnly Cookie，SameSite=Lax。默认登录绝对有效期8小时，API可按记住登录选项使用14天；刷新不会延长绝对到期时间。登录时销毁旧Session ID并重新生成，保存及关联用户成功后更新最近登录时间。会话写入失败不会返回成功；退出后旧Cookie不能获取me。

每次受保护请求重新读取用户状态，禁用账号会使会话失效。错误登录使用通用提示，未知账户仍执行bcrypt比较。登录按IP限制10次/15分钟，注册5次/小时；当前限流为单进程，部署多实例前需增加共享限流存储。

生产配置使用 `NODE_ENV=production`、HTTPS的APP_ORIGIN，Cookie自动使用Secure和 `__Host-` 名称。由本机HTTPS代理转发时使用 `TRUST_PROXY=loopback`，Express保持回环监听；代理应覆盖传入的转发头。远程代理应明确配置可信来源后再使用。

服务端响应禁止缓存。用户密码、Session Token不写入localStorage，表单及账户错误在页面内部显示。账户页调用me确认状态，退出调用csrf和logout；恢复历史页面时重新验证会话。

## 测试

```powershell
npm test
npm run test:backend
npm run test:policy
npm run test:user-center
npm run test:user-center:pointer
```

普通测试覆盖正常注册、重复注册、错误密码、正确登录、me、退出、CSRF、Session ID变化、失效会话、账号禁用、Cookie属性和限流。新认证测试使用真实bcrypt、真实MySQL Session Store适配器和明确的SQL测试替身；这不是MySQL连接或建表验收。生产代码不导入测试替身。

配置真实开发数据库并完成初始化后执行：

```powershell
npm run test:mysql
```

该命令使用 `.env` 中的真实连接验证六个认证流程，并重建应用/Session Store检查数据库持久化。它会创建一个随机测试账户，结束时禁用该账户并保留审计记录；请在独立开发数据库执行。普通npm test默认跳过此真实数据库测试。

本机已完成真实数据库验收：MySQL80服务运行中，版本8.0.45，地址127.0.0.1:3306；`suzhou_talent_policy`及三张认证表已经初始化。运行账号为`suzhou_app@localhost`，只具备上述表权限；独立随机数据库密码和Session密钥仅保存在被忽略的本地`.env`，没有保留root初始化凭据。已有本地配置无需重新复制或重新初始化。

原站接入后的接口验证：`npm test`通过36项，默认跳过1项真实数据库测试；单独执行`npm run test:mysql`已通过，覆盖真实注册入库、重复注册、错误密码、正确登录、me、退出、Session ID更新、政策页面访问、Excel下载和应用重建后的Session持久化。`test:policy`逐个验证受保护文件、HEAD/Range、退出/禁用状态、路径绕过和开放重定向，并核对原页面正文及资源字节一致。

本机Windows已安装Edge，可通过`npm run test:policy:browser`执行连接真实MySQL的完整浏览器回归；报告保存在工作区`.checks/policy-auth-browser-report.json`。它检查11个原页面在375/768/1440px下的导航、搜索、筛选、比较篮、图表、计算器、Excel定位、打印恢复、文档下载及退出保护。随机测试账户在结束时禁用，审计记录保留；没有预置可登录账号。生产HTTPS仍需部署时单独验收。

前次用户中心回归已通过：33组页面/宽度及1100/1290px桌面临界宽度检查，共2757项真实MySQL浏览器检查、576项原站静态检查。覆盖真实用户名/注册时间、长用户名、下拉交互、原菜单、原功能、顶部退出、旧Cookie和历史返回；36项普通自动化测试及单独的真实MySQL集成测试通过。原站基线81个文件中只有README及两份共享导航CSS/JS更新，另外78个政策页面、数据、资源和文档保持原字节；68个原始来源及复制文件的清单核对也通过。

`npm run test:user-center`使用本机Edge和真实MySQL，结果位于`.checks/user-center-browser-report.json`；完整文件核对见`.checks/user-center-summary.json`。桌面、移动端菜单截图为`.checks/user-center-open-1440.png`和`.checks/user-center-open-375.png`。

主要接入文件：`server/backend-app.js`、`server/routes/policy-site.js`、`server/routes/auth.js`、`server/middleware/security.js`、`auth/css/policy-session.css`、`auth/js/policy-session.js`、`test/policy-site.test.js`。

参考：[Express Session](https://expressjs.com/en/resources/middleware/session/)、[MySQL Session Store](https://github.com/chill117/express-mysql-session)、[bcrypt](https://github.com/kelektiv/node.bcrypt.js)。


## 本轮完整测试与登录注册标识更新（2026-10-12）

登录、注册页新增顶部导航，左侧使用用户提供的机构标识，直接复用pages/公共资源/昆山.png；已核对它与工作区根目录昆山.png完全一致。图片保持完整比例，未裁剪或修改；登录前通过指定路径/auth-ui/assets/kunshan-institute.png提供。原政策页面、数据、金额、图表规则和文档保持原样。

本轮实际执行npm run db:check、npm ls --omit=dev --depth=0、npm test、npm run test:mysql和npm run test:browser；浏览器为本机真实Microsoft Edge，接口及Session使用真实MySQL。普通测试37项通过、0失败，默认跳过1项MySQL测试；该MySQL测试另行执行通过。浏览器33组原页面/尺寸检查，加6组登录注册图片检查及桌面临界宽度检查，共2802项通过。576项静态检查通过，68个原文件来源及副本哈希核对无变化。

| 测试内容 | 结果与实际验证方式 |
| --- | --- |
| 1. MySQL连接 | 通过：本机MySQL 8.0.45，认证表和唯一索引检查通过 |
| 2. 注册新用户 | 通过：真实API创建随机用户，确认实际数据库记录 |
| 3. 重复用户名/邮箱 | 通过：同名、同邮箱、两者重复分别返回409 |
| 4. 密码哈希 | 通过：数据库保存bcrypt哈希，compare及配置成本验证通过 |
| 5. 正确密码登录 | 通过：用户名及邮箱登录，进入原首页 |
| 6. 错误密码拒绝 | 通过：真实接口返回401，不建立用户会话 |
| 7. 登录Session | 通过：登录更换SID，MySQL记录关联用户，旧匿名SID无权访问 |
| 8. 刷新保持登录 | 通过：375/768/1440px实际浏览器reload保持同一有效会话；重建应用/Store后仍可读取 |
| 9. 退出失效 | 通过：数据库Session删除，旧Cookie不能继续访问 |
| 10. 原站匿名拦截 | 通过：首页、九详情、对比页均跳转登录 |
| 11. 匿名资料/数据拦截 | 通过：Word、Excel、JSON、脚本、图片返回401 |
| 12. 九个政策入口 | 通过：真实浏览器实际导航到市级及八地详情 |
| 13. 共享导航 | 通过：六个入口顺序、区域菜单、用户中心及键盘交互 |
| 14. 对比图表 | 通过：四类金额图、缺失值、真实零、排序和源单元格定位 |
| 15. 筛选/比较篮 | 通过：组合筛选、空结果、2/4地限制、页面传递和返回保留 |
| 16. Word/Excel下载 | 通过：10份Word和1份Excel实际响应、ZIP签名、大小及原文件字节核对 |
| 17. 布局 | 通过：Edge检查375/768/1440px，额外检查1100/1290px；机构标识比例完整、无横向溢出 |
| 18. JavaScript错误 | 通过：原站回归未发现浏览器JavaScript/CSP异常 |
| 19. 资源路径 | 通过：本地静态引用、浏览器资源响应、图片公开路径和文件预览相对路径核对 |
| 20. URL绕过登录 | 通过：直接路径、大小写、编码、Windows特殊路径、HEAD/Range及旧Cookie检查 |
| CSRF | 通过：真实MySQL会话下，缺少/错误Token、外部Origin均403；合法会话不会因此被退出 |
| 登录限流 | 通过：独立开发应用连续10次错误密码401，第11次请求429并携带Retry-After |
| Cookie安全 | 通过：本机HttpOnly/SameSite=Lax；生产Secure、__Host-、Path和无Domain用代理配置测试验证 |
| Session过期 | 通过：仅将随机QA会话写为已过期，真实服务器拒绝me、页面和数据 |
| 恶意跳转/SQL输入 | 通过：外部URL、双斜杠、反斜杠、重复编码均不能改变首页目的地；SQL攻击字符串不能登录 |

发现并已修复：预览服务在图片传输取消时可能重复发送响应头，产生ERR_HTTP_HEADERS_SENT。已在文件发送回调处理客户端取消，并在错误中间件检查headersSent；新增真实中断图片下载回归测试，复验通过。当前未解决失败为0。

无法在当前本地环境实际验收：生产域名/证书/反向代理的HTTPS全链路，以及真实iOS/Android设备。生产Cookie验证是配置与代理头测试，移动端验证是Edge视口模拟，不能作为这些环境已经验收的声明。没有等待完整8小时/14天自然到期，过期测试使用仅属于随机QA用户的真实MySQL会话过期状态。普通npm test默认跳过的MySQL项已经单独运行，不计为未完成。

复验命令为npm test、npm run test:mysql、npm run test:browser；浏览器测试需本机Edge。测试会创建随机账户，结束后禁用它们并保留审计；不改动真实用户或原政策资料。证据见工作区.checks/full-audit-report.json和.checks/full-audit-browser-report.json，图片截图为.checks/auth-logo-login-1440.png和.checks/auth-logo-register-375.png。

## 用户中心真实点击修复（2026-10-12）

已复现并修复“我的账号”和“退出登录”在真实点击时失效的问题：浏览器切换焦点时，`document.activeElement`可能暂为body，旧focusout微任务会提前隐藏菜单，后续鼠标释放无法命中菜单项。共享`js/navigation.js`改为检查`event.relatedTarget`，菜单内切换焦点时保持打开，外部点击/聚焦仍关闭；区域菜单同步修复同类问题。Escape在菜单打开时支持关闭与恢复焦点，点击注册时间也不会打断操作。账户API、服务器Session及政策资料没有改动。

原来的浏览器测试使用DOM `.click()`激活账户/退出，没有覆盖这次真实鼠标焦点时序。因此新增`npm run test:user-center:pointer`，使用本机Edge的浏览器输入协议发送真实鼠标和触摸事件，在1440/768/375px逐个进入首页、九个政策页和对比页的账户菜单。测试连接`.env`中的真实MySQL，检查账户信息、顶部退出POST、Session删除、旧Cookie对全部政策文件的拒绝、Tab/Enter/Escape、区域导航与后退保护；后退断言先等待实际导航事件，避免在旧登录页面提前通过。证据保存在工作区`.checks/user-center-pointer-report.json`。测试结束禁用随机QA账户，不提供预置登录账号；移动设备使用Edge模拟，未声称已经测试真实手机。

本次复验：新增真实鼠标/触摸检查564项通过，覆盖33组页面/宽度；原用户中心与政策交互回归2757项通过；普通测试37项通过、0失败、1项真实MySQL集成测试默认跳过（本次新增浏览器检查已实际连接MySQL并完成注册/登录/退出）；原站576项静态检查通过，68份原文件及副本完整。修复前真实鼠标账户点击失败已复现，修复后未解决失败为0。本次没有再次执行独立`npm run test:mysql`或生产HTTPS/真实手机验收。

## 手动测试登录注册

1. 在全市政策目录运行npm run db:check，然后npm start；使用.env中的APP_ORIGIN，默认http://localhost:3000。
2. 访问/register，使用新的用户名、邮箱及至少8字符的密码注册；确认两次密码一致，注册成功后前往/login。
3. 使用相同用户名加另一邮箱、或相同邮箱加另一用户名尝试注册，应在页面内提示重复；不要连续大量提交，注册有5次/小时限流。
4. 使用错误密码登录应被拒绝；正确用户名/邮箱和密码登录后进入/index.html，顶部用户中心显示真实用户名和注册时间。
5. 刷新首页，打开九个详情入口、对比页，验证筛选、比较篮、图表与文档下载。
6. 点击用户中心的退出登录，再刷新/后退或直接粘贴政策页及文档URL；页面要求登录，资料/API返回401。
7. 需要自动复验CSRF、限流、过期、恶意跳转时执行npm run test:mysql；开发限流按进程计数，普通浏览器的重复测试可能返回429。
