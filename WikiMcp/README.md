# WikiMcp

通过 MCP 协议获取 Confluence wiki 内容并转换为 Markdown 格式的服务器

## 功能特点

- 通过 MCP 工具获取 Confluence Wiki 内容
- 支持直接粘贴 Confluence 页面 URL，自动解析参数
- 支持按空间键、文档标题或 ID 获取内容
- 将 HTML 内容自动转换为 Markdown 格式
- 支持基本认证（用户名/密码）
- 从环境变量加载认证信息，提高安全性
- 提供 SSE 连接方式，兼容 MCP 客户端

## 安装与使用

1. 安装依赖：

```bash
npm install
```

2. 配置认证信息：

复制 `.env.example` 文件并重命名为 `.env`，然后编辑其中的认证信息：

```
CONFLUENCE_USERNAME=your_username
CONFLUENCE_PASSWORD=your_password_or_api_token
```

3. 启动服务器：

```bash
npm start
```

服务器默认在 http://localhost:3002 运行。

## MCP 接口

### 工具：getWikiContent

获取 Confluence Wiki 内容并转换为 Markdown 格式。

参数：

- `url`: Confluence Wiki 页面的完整 URL（推荐使用，系统会自动解析出必要参数）
- `baseUrl`: Confluence 服务器的基本 URL（如果提供了 URL，则可选）
- `spaceKey`: Wiki 空间的键值（如果提供了 URL，则可选）
- `title`: 文档的标题（可选）
- `contentId`: 文档的 ID（如果提供了 URL，则可选）
- `username`: Confluence 用户名（可选，如不提供则使用环境变量中的配置）
- `password`: Confluence 密码或 API 令牌（可选，如不提供则使用环境变量中的配置）
- `expand`: 要扩展的内容字段（可选，默认为"body.storage,space,version"）

示例：

```javascript
// 示例1：直接使用页面URL（推荐方式）
getWikiContent({
  url: "http://公司服务器地址:端口/confluence/pages/viewpage.action?pageId=123456",
});

// 示例2：使用单独参数
getWikiContent({
  baseUrl: "http://公司服务器地址:端口/confluence",
  spaceKey: "DEV",
  title: "项目说明文档",
});

// 示例3：获取特定ID的文档
getWikiContent({
  baseUrl: "http://公司服务器地址:端口/confluence",
  contentId: "123456",
});

// 示例4：显式提供认证信息（如环境变量未配置）
getWikiContent({
  url: "http://公司服务器地址:端口/confluence/pages/viewpage.action?pageId=123456",
  username: "用户名",
  password: "密码或API令牌",
});
```

### 支持的 URL 格式

系统能够自动解析以下格式的 Confluence URL：

1. `/display/SPACEKEY/Page+Title`
2. `/spaces/SPACEKEY/pages/123456/Page+Title`
3. `/pages/viewpage.action?pageId=123456`
4. `/pages/view.action?pageId=123456`

### 资源：wiki

通过 URI 模式获取 Wiki 内容。

URI 格式：`wiki://{baseUrl}/{spaceKey}/{contentId?}`

参数：

- `baseUrl`: Confluence 服务器的基本 URL
- `spaceKey`: Wiki 空间的键值
- `contentId`: 文档的 ID（可选，如不提供则获取空间中的文档列表）

认证信息会自动从环境变量中读取，也可以通过查询参数提供：
`wiki://{baseUrl}/{spaceKey}/{contentId?}?username={username}&password={password}`

示例：

```
wiki://http://公司服务器地址:端口/confluence/DEV/123456
```

## 注意事项

- 本服务器需要有效的 Confluence 账户或 API 令牌
- 认证信息优先从环境变量加载，提高安全性
- 确保有适当的权限访问目标 Wiki 内容
- 密码在传输过程中应使用 HTTPS 以确保安全
- API 令牌通常比密码更安全，建议使用 API 令牌
