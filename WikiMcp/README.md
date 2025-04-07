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
- **增强功能：**
  - 自动下载 Wiki 文档中的图片，保存到本地，并在 Markdown 中使用相对路径引用
  - 增强的表格支持，确保复杂表格结构正确转换
  - 特殊处理表格中的图片，确保在 Markdown 表格中正确显示
  - 正确处理表格的标题行和分隔符

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

服务器默认在 http://localhost:3331 运行。

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
- `cookie`: 完整的 Cookie 字符串（用于链家 Wiki 等需要 Cookie 认证的系统，可选）
- `token`: 访问令牌（用于链家 Wiki 等需要令牌认证的系统，可选）
- `downloadImages`: 是否下载文档中的图片（可选，默认为 true）

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

// 示例5：禁用图片下载功能
getWikiContent({
  url: "http://公司服务器地址:端口/confluence/pages/viewpage.action?pageId=123456",
  downloadImages: false,
});

// 示例6：使用Cookie访问链家Wiki
getWikiContent({
  url: "https://wiki.lianjia.com/pages/viewpage.action?pageId=123456",
  cookie: "完整的Cookie字符串",
});
```

### 支持的 URL 格式

系统能够自动解析以下格式的 Confluence URL：

1. `/display/SPACEKEY/Page+Title`
2. `/spaces/SPACEKEY/pages/123456/Page+Title`
3. `/pages/viewpage.action?pageId=123456`
4. `/pages/view.action?pageId=123456`

### 表格和图片处理

#### 增强的表格处理

- 支持复杂表格结构，包括嵌套表格和合并单元格
- 正确识别和处理表格标题行
- 使用标准的 Markdown 表格语法，确保在大多数 Markdown 查看器中正确显示
- 处理表格中的换行和其他格式化

#### 图片下载功能

当启用图片下载功能时（默认开启），系统会：

1. 自动识别 Wiki 文档中的所有图片（包括表格中的图片）
2. 下载图片到用户桌面上的`WikiImages/[文档标题_哈希值]`文件夹中
3. 在生成的 Markdown 中将图片链接替换为相对路径
4. 在文档末尾添加下载信息提示，包括图片总数和表格中图片数量
5. 特殊处理表格中的图片，确保在 Markdown 表格中正确显示

使用此功能的优势：

- 可以离线查看 Wiki 文档及其图片（包括表格中的图片）
- 避免因 Wiki 图片链接失效导致的内容丢失
- 图片文件名保留原始命名，便于管理和引用
- 确保表格中的图片在 Markdown 预览时能正确显示

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
- 图片下载功能需要网络连接和足够的磁盘空间
- 对于链家 Wiki 等需要特殊认证的站点，推荐使用 Cookie 认证方式
