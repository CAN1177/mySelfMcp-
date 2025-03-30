# Transemantix - 汉语翻译为符合语义化的英文命名工具

Transemantix 是一个基于 Model Context Protocol (MCP) 的工具，专门用于将中文短语翻译成编程中常用的、符合语义的英文命名。它支持多种命名风格，包括驼峰命名法（camelCase）、帕斯卡命名法（PascalCase）、下划线命名法（snake_case）和烤串命名法（kebab-case）。

## 功能特点

- 将中文短语翻译为符合语义的英文命名
- 支持多种命名风格（camelCase、PascalCase、snake_case、kebab-case）
- 提供批量翻译功能
- 允许添加自定义映射，扩展词汇库
- 支持命令行交互式使用

## 安装与使用

### 安装依赖

```bash
npm install
```

### 启动服务器（可选）

如果你想单独启动服务器，可以使用：

```bash
# 使用标准输入输出（默认）
npm start

# 或者使用 HTTP 服务器
SERVER_TYPE=http npm start
```

### 使用客户端

```bash
# 使用标准输入输出连接到服务器（默认）
npm run client

# 或者连接到 HTTP 服务器
CLIENT_TYPE=http npm run client
```

## 命令行使用示例

```
# 启动客户端
npm run client

# 翻译单个短语（默认为驼峰命名法）
> translate 用户名称
翻译结果 (camelCase): userName

# 指定输出样式
> translate 用户名称 PascalCase
翻译结果 (PascalCase): UserName

> translate 用户名称 snake_case
翻译结果 (snake_case): user_name

> translate 用户名称 kebab-case
翻译结果 (kebab-case): user-name

# 批量翻译
> batch 用户名称,用户列表,添加用户
批量翻译结果 (camelCase):
  用户名称 -> userName
  用户列表 -> userList
  添加用户 -> addUser

# 添加自定义映射
> add 客户 client
成功添加映射: 客户 -> client

# 退出程序
> exit
```

## 已支持的常用词汇

工具内置了大量常见的编程词汇映射，包括：

- 数据类型：字符串、数字、整数、浮点数、布尔、数组、对象等
- 常见变量名：用户、名称、标题、描述、列表、索引、计数等
- 常见函数动词：获取、设置、创建、删除、更新、添加、移除等

如果内置词汇不满足需求，可以使用 `add` 命令添加自定义映射。

## 技术实现

Transemantix 基于 Model Context Protocol (MCP) TypeScript SDK 构建，使用 Node.js 实现。它可以作为独立的命令行工具运行，也可以作为 HTTP 服务对外提供 API。

## 贡献

欢迎贡献更多的词汇映射和功能改进！
