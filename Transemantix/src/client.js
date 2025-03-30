import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { spawn } from "child_process";
import readline from "readline";

// 创建命令行交互界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 创建MCP客户端
async function createClient(transportType = "stdio") {
  const client = new Client(
    {
      name: "transemantix-client",
      version: "1.0.0",
      description: "汉语翻译为符合语义化的英文命名工具客户端",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  let transport;

  if (transportType === "http") {
    // 使用HTTP传输
    transport = new SSEClientTransport(
      "http://localhost:3008/sse",
      "http://localhost:3008/messages"
    );
  } else {
    // 使用标准输入输出传输
    const serverProcess = spawn("node", ["src/server.js"], {
      stdio: ["pipe", "pipe", process.stderr],
      env: { ...process.env },
    });

    transport = new StdioClientTransport(
      serverProcess.stdin,
      serverProcess.stdout
    );

    // 处理服务器进程终止
    serverProcess.on("exit", (code) => {
      console.log(`服务器进程已退出，退出码: ${code}`);
      process.exit(code);
    });
  }

  await client.connect(transport);
  return client;
}

// 翻译中文为不同格式的英文
async function translateToEnglish(client, chinesePhrase, style = "camelCase") {
  try {
    const result = await client.callTool({
      name: "translate-to-english",
      arguments: {
        chinesePhrase,
        style,
      },
    });

    return result.content[0].text;
  } catch (error) {
    console.error("翻译失败:", error);
    return null;
  }
}

// 批量翻译
async function batchTranslate(client, chinesePhrases, style = "camelCase") {
  try {
    const result = await client.callTool({
      name: "batch-translate",
      arguments: {
        chinesePhrases,
        style,
      },
    });

    return JSON.parse(result.content[0].text);
  } catch (error) {
    console.error("批量翻译失败:", error);
    return null;
  }
}

// 添加自定义映射
async function addCustomMapping(client, chinese, english) {
  try {
    const result = await client.callTool({
      name: "add-custom-mapping",
      arguments: {
        chinese,
        english,
      },
    });

    return result.content[0].text;
  } catch (error) {
    console.error("添加自定义映射失败:", error);
    return null;
  }
}

// 交互式命令行界面
async function startInteractiveCLI() {
  console.log("正在启动 Transemantix 客户端...");
  const client = await createClient(process.env.CLIENT_TYPE || "stdio");
  console.log("客户端已连接到服务器!");
  console.log("=== Transemantix - 汉语翻译为语义化英文命名工具 ===");
  console.log("可用命令:");
  console.log(
    "  translate <中文短语> [风格]  - 翻译单个短语 (风格: camelCase, PascalCase, snake_case, kebab-case)"
  );
  console.log("  batch <中文短语1>,<中文短语2>... [风格] - 批量翻译多个短语");
  console.log("  add <中文> <英文> - 添加自定义映射");
  console.log("  exit - 退出程序");
  console.log("=================================================");

  // 主交互循环
  const promptUser = () => {
    rl.question("> ", async (input) => {
      const args = input.trim().split(" ");
      const command = args[0].toLowerCase();

      if (command === "exit") {
        console.log("再见!");
        rl.close();
        process.exit(0);
      } else if (command === "translate") {
        if (args.length < 2) {
          console.log("用法: translate <中文短语> [风格]");
        } else {
          const style = args.length >= 3 ? args[args.length - 1] : "camelCase";
          // 检查最后一个参数是否是有效的样式
          const validStyles = [
            "camelCase",
            "PascalCase",
            "snake_case",
            "kebab-case",
          ];

          let chinesePhrase;
          let actualStyle;

          if (validStyles.includes(style)) {
            // 如果最后一个参数是样式，那么中文短语是从第二个参数到倒数第二个参数
            chinesePhrase = args.slice(1, args.length - 1).join(" ");
            actualStyle = style;
          } else {
            // 如果最后一个参数不是样式，那么中文短语是从第二个参数到最后一个参数
            chinesePhrase = args.slice(1).join(" ");
            actualStyle = "camelCase";
          }

          const result = await translateToEnglish(
            client,
            chinesePhrase,
            actualStyle
          );
          if (result) {
            console.log(`翻译结果 (${actualStyle}): ${result}`);
          }
        }
      } else if (command === "batch") {
        if (args.length < 2) {
          console.log("用法: batch <中文短语1>,<中文短语2>... [风格]");
        } else {
          const style = args.length >= 3 ? args[args.length - 1] : "camelCase";
          const validStyles = [
            "camelCase",
            "PascalCase",
            "snake_case",
            "kebab-case",
          ];

          let phrasesInput;
          let actualStyle;

          if (validStyles.includes(style)) {
            phrasesInput = args.slice(1, args.length - 1).join(" ");
            actualStyle = style;
          } else {
            phrasesInput = args.slice(1).join(" ");
            actualStyle = "camelCase";
          }

          const chinesePhrases = phrasesInput.split(",").map((p) => p.trim());
          const results = await batchTranslate(
            client,
            chinesePhrases,
            actualStyle
          );

          if (results) {
            console.log(`批量翻译结果 (${actualStyle}):`);
            results.forEach((item) => {
              console.log(`  ${item.original} -> ${item.translated}`);
            });
          }
        }
      } else if (command === "add") {
        if (args.length < 3) {
          console.log("用法: add <中文> <英文>");
        } else {
          const chinese = args[1];
          const english = args[2];
          const result = await addCustomMapping(client, chinese, english);
          if (result) {
            console.log(result);
          }
        }
      } else {
        console.log("未知命令。可用命令: translate, batch, add, exit");
      }

      promptUser();
    });
  };

  promptUser();
}

// 启动交互式命令行界面
startInteractiveCLI().catch((error) => {
  console.error("运行时错误:", error);
  process.exit(1);
});
