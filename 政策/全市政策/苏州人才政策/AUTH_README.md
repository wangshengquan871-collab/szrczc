# 登录与注册页面

本次新增文件位于本目录，原政策首页、详情页、数据、Word和Excel没有修改。

- `登录注册.html`：独立登录页面。
- `注册.html`：独立注册页面。
- `css/auth.css`：浅米白、墨绿与浅金配色；桌面分栏、手机和平板上下布局；焦点、错误、加载和减少动画样式。
- `js/auth.js`：字段校验、密码显隐、加载状态、超时、页内错误及真实API调用。
- `账户.html`、`js/account.js`：受保护的账户状态页，调用me显示当前用户，调用logout退出。

两页直接复用 `assets/images/jiangnan-architecture.svg` 和 `portal-mark.svg`，没有复制或修改素材。可以双击HTML预览、用Live Server打开；直接文件预览不会提交账户数据。

## 路由预览

在上一级 `全市政策/` 执行：

```powershell
npm run preview:auth
```

浏览器访问 `http://127.0.0.1:3001/login` 或 `/register`。预览不需要MySQL或.env，没有硬编码账户，不模拟登录和注册成功。若Node尚未加入PATH，可按上级README使用已有便携Node。

正式后端已经接入真实认证API和MySQL Session Store；`npm start`需配置MySQL、SESSION_SECRET和APP_ORIGIN。后端公开新登录注册页及六个明确列出的账户素材；`/account`以及原首页、所有政策页面、政策资源和Word/Excel均需要有效Session。原目录的浏览器文件通过受保护白名单提供，README、清单和后端配置不公开。`/login/`、`/register/`及大小写变体会跳转到规范地址。

## API约定

- `GET /api/auth/csrf`：返回 `{ "csrfToken": "64位十六进制Token" }`。
- `POST /api/auth/login`：JSON字段 `identifier`、`password`、`returnTo`；成功返回同源 `redirect`。
- `POST /api/auth/register`：JSON字段 `username`、`email`、`password`、`confirmPassword`、`returnTo`；成功必须返回201，显示注册确认并提供登录链接。
- `GET /api/auth/me`：返回当前用户安全字段，包含`username`、MySQL注册时间`createdAt`及最近登录时间；登录后确认Cookie会话有效再进入`/index.html`。
- `POST /api/auth/logout`：携带CSRF Token销毁服务端会话并清除Cookie。
- POST使用会话Cookie和 `X-CSRF-Token`，不在浏览器存储密码或登录令牌。
- 失败响应可包含 `message`、`code`、`fields`；字段错误展示在相应输入框下。

正式后端已挂载认证API。本机MySQL 8.0.45已初始化，连接配置及随机Session密钥已写入上一级被忽略的`.env`；在`全市政策/`运行`npm start`，通过`http://localhost:3000/register`注册，再访问`http://localhost:3000/login`登录。使用现有本地配置时无需重复初始化数据库。Node不在PATH时，按上一级README设置便携运行环境。

真实数据库接口测试已覆盖原站页面和Excel访问；完整浏览器回归报告见工作区`.checks/policy-auth-browser-report.json`。测试账户已禁用，请自行注册账号。界面预览服务仍不连接数据库，提交会提示服务尚未开放；真实认证及受保护原站请使用3000端口的正式服务。前端校验不能替代服务端验证。登录成功固定进入`/index.html`，页面底部可以查看账户或退出；未登录的页面请求跳转登录页，资源、文档和受保护API返回401 JSON。退出后旧Session不能读取政策文件。

顶部用户中心已通过现有`css/navigation.css`和`js/navigation.js`接入全部原页面；显示API取得的图标/用户名，点击可查看我的账号、注册时间及退出登录。顶部退出仍使用CSRF和服务器Session，成功后跳转`/login`；未使用localStorage保存登录凭据。

当前回归通过36项自动化测试、单独的真实MySQL集成测试，以及11个原页面×3种宽度和两种桌面临界宽度的2757项浏览器检查，涵盖用户中心、原导航、筛选、比较篮、金额图、计算器、原表定位、11份下载和历史恢复保护。运行`npm run test:user-center`可复验，报告见工作区`.checks/user-center-browser-report.json`。

密码提示为8–64个字符，另外验证UTF-8不超过72字节，与已有bcrypt认证逻辑一致。用户名验证3–30个字符并规范化，邮箱规范化为小写。注册确认不自动登录。

页面支持Tab、Enter、空格激活按钮；输入框均关联标签与错误文本，密码显隐按钮提供按下状态。减少动态效果设置会关闭动画。禁用JavaScript时两页仍显示正确表单，但提交按钮禁用并提示启用JavaScript。


登录和注册页顶部左侧已加入上海交通大学·昆山未来产业创新院标识，复用pages/公共资源/昆山.png，与用户提供原图字节一致；公开URL为/auth-ui/assets/kunshan-institute.png。375/768/1440px下均保持完整比例；相对路径也支持本地文件预览。最新完整测试、环境限制和手动登录注册步骤见上一级README及.checks/full-audit-report.json。

2026-10-12用户中心修复：真实鼠标点击菜单项时，旧focusout微任务可能提前隐藏菜单，导致“我的账号”和“退出登录”失效；已使用relatedTarget保留内部焦点切换，并修复区域菜单同类处理。原来的DOM .click()测试没有覆盖该时序，新增`npm run test:user-center:pointer`验证真实鼠标/模拟触摸、账户API、MySQL Session删除及退出后所有原文件的旧Cookie拒绝。运行方式及结果见上一级README和工作区`.checks/user-center-pointer-report.json`。必须通过Node.js服务访问；Live Server或直接打开HTML不能提供真实登录/退出API。
