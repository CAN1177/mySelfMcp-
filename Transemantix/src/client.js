import readline from "readline";
import fetch from "node-fetch";

// 创建命令行交互界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 直接调用 DeepSeek API 进行翻译
async function translateWithDeepSeek(chineseText, style) {
  try {
    console.log(`开始翻译: ${chineseText}, 样式: ${style}`);

    // 这里应该使用您的 API 密钥，这里使用的是 .env 中的 DEEPSEEK_API_KEY
    const apiKey =
      process.env.DEEPSEEK_API_KEY || "sk-c2bfccd2df4e43efb055e25d33ee199d";

    const prompt = `请将以下中文文本翻译成适合编程使用的英文命名：${chineseText}
要求：
1. 翻译要准确表达原意
2. 使用专业的编程术语
3. 返回格式为 ${style}
4. 只返回翻译结果，不要其他解释`;

    const response = await fetch(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content:
                "你是一个专业的编程命名翻译助手。请直接返回翻译结果，不要添加任何解释。",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 100,
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(`API 错误: ${data.error.message}`);
    }

    const result = data.choices[0].message.content.trim();
    console.log(`翻译结果: ${result}`);
    return result;
  } catch (error) {
    console.error("翻译 API 调用失败:", error);
    throw new Error(`翻译服务暂时不可用: ${error.message}`);
  }
}

// 交互式命令行界面
async function startInteractiveCLI() {
  console.log("=== Transemantix - 汉语翻译为语义化英文命名工具 ===");
  console.log("可用命令:");
  console.log(
    "  translate <中文短语> [风格]  - 翻译单个短语 (风格: camelCase, PascalCase, snake_case, kebab-case)"
  );
  console.log("  batch <中文短语1>,<中文短语2>... [风格] - 批量翻译多个短语");
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

          console.log(
            `翻译中文短语: "${chinesePhrase}" 为 ${actualStyle} 风格`
          );

          try {
            const result = await translateWithDeepSeek(
              chinesePhrase,
              actualStyle
            );
            console.log(`翻译结果 (${actualStyle}): ${result}`);
          } catch (error) {
            console.error(`翻译错误: ${error.message}`);
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
          console.log(`批量翻译结果 (${actualStyle}):`);

          try {
            // 依次翻译每个短语
            for (const phrase of chinesePhrases) {
              const result = await translateWithDeepSeek(phrase, actualStyle);
              console.log(`  ${phrase} -> ${result}`);
            }
          } catch (error) {
            console.error(`批量翻译错误: ${error.message}`);
          }
        }
      } else {
        console.log("未知命令。可用命令: translate, batch, exit");
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
