// markdownConverter.js - HTML到Markdown的转换模块
import TurndownService from "turndown";
import { logToFile } from "./logger.js";
import path from "path";

/**
 * 配置并返回Turndown服务实例
 * @returns {TurndownService} 配置好的Turndown服务实例
 */
export function setupTurndownService() {
  // 创建HTML到Markdown的转换器，使用完整的配置选项
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    hr: "---",
    emDelimiter: "_",
    strongDelimiter: "**",
    linkStyle: "inlined",
    linkReferenceStyle: "full",
    preformattedCode: true,
  });

  // 添加自定义规则，确保更多HTML元素能够被正确转换
  turndownService.addRule("strikethrough", {
    filter: ["del", "s", "strike"],
    replacement: (content) => `~~${content}~~`,
  });

  turndownService.addRule("underline", {
    filter: ["u"],
    replacement: (content) => `<u>${content}</u>`,
  });

  // 改进图片处理，确保表格中的图片也能被正确识别和处理
  turndownService.addRule("image", {
    filter: "img",
    replacement: function (content, node) {
      const alt = node.alt || "";
      let src = node.getAttribute("src") || "";

      // 给每个图片节点添加自定义属性，以便后续能够标识它们
      if (src) {
        // 使用data-attributes记录原始src以便后续处理
        node.setAttribute("data-original-src", src);

        // 记录这个图片节点是否在表格中
        let inTable = false;
        let parent = node.parentNode;
        while (parent) {
          if (parent.nodeName === "TD" || parent.nodeName === "TH") {
            inTable = true;
            break;
          }
          parent = parent.parentNode;
        }

        if (inTable) {
          node.setAttribute("data-in-table", "true");
          logToFile(`识别到表格中的图片: ${src}`);
        }
      }

      // 处理相对路径
      if (src && !src.startsWith("http") && !src.startsWith("data:")) {
        logToFile(`保留相对图片路径: ${src}`);
      }

      const title = node.title || alt;
      const titlePart = title ? ` "${title}"` : "";
      return `![${alt}](${src}${titlePart})`;
    },
  });

  // 修改表格处理，确保符合Markdown标准格式
  turndownService.addRule("tableCells", {
    filter: ["th", "td"],
    replacement: function (content, node) {
      // 检查内容是否为空
      let cellContent = content.trim() || " ";

      // 如果内容中有换行符，用<br>替换以确保表格渲染正确
      cellContent = cellContent.replace(/\n/g, "<br>");

      // 确保表格单元格中的 | 符号不会破坏表格结构
      cellContent = cellContent.replace(/\|/g, "\\|");

      // 标准Markdown表格单元格格式
      return ` ${cellContent} |`;
    },
  });

  turndownService.addRule("tableRow", {
    filter: "tr",
    replacement: function (content, node) {
      // 确保每行以 | 开始
      let output = `|${content}\n`;

      // 如果是表头行，添加分隔行
      if (node.parentNode && node.parentNode.tagName === "THEAD") {
        const cellCount = node.children.length;
        let separatorRow = "|";
        for (let i = 0; i < cellCount; i++) {
          separatorRow += " --- |";
        }
        output += separatorRow + "\n";
      }

      return output;
    },
  });

  turndownService.addRule("table", {
    filter: function (node) {
      return node.nodeName === "TABLE";
    },
    replacement: function (content, node) {
      // 获取表格的所有行
      const rows = node.querySelectorAll("tr");

      // 如果表格没有行，返回空内容
      if (rows.length === 0) {
        return "";
      }

      // 确保表格有正确的表头和分隔符
      let tableContent = content.trim();

      // 如果表格没有thead，手动构建标准的表头分隔符
      if (!node.querySelector("thead") && rows.length > 0) {
        const firstRow = rows[0];
        const cellCount = firstRow.children.length;

        if (cellCount > 0) {
          // 计算分隔行
          let separator = "|";
          for (let i = 0; i < cellCount; i++) {
            separator += " --- |";
          }

          // 在第一行后添加分隔行
          const firstRowIndex = tableContent.indexOf("\n");
          if (firstRowIndex !== -1) {
            tableContent =
              tableContent.substring(0, firstRowIndex) +
              "\n" +
              separator +
              tableContent.substring(firstRowIndex);
          } else if (tableContent.trim()) {
            tableContent += "\n" + separator;
          }
        }
      }

      // 确保表格前后有空行，以便正确渲染
      return "\n\n" + tableContent + "\n\n";
    },
  });

  // 处理列表
  turndownService.addRule("listItem", {
    filter: "li",
    replacement: function (content, node, options) {
      content = content
        .replace(/^\n+/, "") // 移除开头的换行
        .replace(/\n+$/, "\n") // 确保只有一个结尾换行
        .replace(/\n/gm, "\n    "); // 缩进内容

      let prefix = options.bulletListMarker + " ";
      let parent = node.parentNode;

      if (parent.nodeName === "OL") {
        const start = parent.getAttribute("start");
        const index = Array.prototype.indexOf.call(parent.children, node);
        const defaultStart = start ? parseInt(start, 10) : 1;
        prefix = defaultStart + index + ". ";
      }

      return (
        prefix +
        content +
        (node.nextSibling && !/\n$/.test(content) ? "\n" : "")
      );
    },
  });

  // 保留某些需要保持HTML原样的元素
  turndownService.keep(["iframe", "embed", "script", "style", "canvas", "svg"]);

  return turndownService;
}

/**
 * 提取HTML中的所有图片URL
 * @param {Document} dom - 页面的DOM对象
 * @returns {Array<Object>} - 图片信息数组，包含src和是否在表格中
 */
export function extractImagesFromHtml(dom) {
  if (!dom || !dom.window || !dom.window.document) {
    logToFile("无法从HTML提取图片：DOM对象无效");
    return [];
  }

  const document = dom.window.document;
  const images = document.querySelectorAll("img");
  const imageInfos = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const src = img.getAttribute("src");

    if (!src || src.startsWith("data:")) {
      // 跳过空路径或base64编码的图片
      continue;
    }

    // 检查图片是否在表格中
    let inTable = false;
    let parent = img.parentNode;
    while (parent) {
      if (parent.nodeName === "TD" || parent.nodeName === "TH") {
        inTable = true;
        break;
      }
      parent = parent.parentNode;
    }

    imageInfos.push({
      src: src,
      inTable: inTable,
    });

    logToFile(`提取到图片URL: ${src}${inTable ? " (在表格中)" : ""}`);
  }

  return imageInfos;
}

/**
 * 修改Markdown中的图片路径，使用下载后的本地路径
 * @param {string} markdown - 原始Markdown内容
 * @param {Map<string, string>} imageMap - 图片URL到本地路径的映射
 * @returns {string} - 修改后的Markdown内容
 */
export function updateImagePathsInMarkdown(markdown, imageMap) {
  let updatedMarkdown = markdown;

  // 如果没有需要替换的图片，直接返回原始内容
  if (!imageMap || imageMap.size === 0) {
    return markdown;
  }

  // 获取用户桌面路径
  const desktopPath = path.join(
    process.env.HOME || process.env.USERPROFILE,
    "Desktop"
  );

  // 替换所有图片的URL
  imageMap.forEach((localPath, originalUrl) => {
    try {
      // 处理URL中的特殊字符，创建安全的正则表达式
      const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // 生成相对于当前目录的路径
      let relativePath = localPath;
      if (localPath.startsWith("./")) {
        // 使用相对路径
        relativePath = localPath;
      } else if (path.isAbsolute(localPath)) {
        // 转换绝对路径为相对路径
        const relativeToCurrent = path.relative(process.cwd(), localPath);
        if (!relativeToCurrent.startsWith("..")) {
          relativePath = `./${relativeToCurrent}`;
        } else {
          relativePath = localPath;
        }
      }

      // 标准的Markdown图片语法匹配
      const imgRegex = new RegExp(
        `!\\[([^\\]]*)\\]\\(${escapedUrl}([^\\)]*)\\)`,
        "g"
      );

      // 替换标准Markdown中的图片
      updatedMarkdown = updatedMarkdown.replace(
        imgRegex,
        (match, alt, titlePart) => {
          return `![${alt}](${relativePath}${titlePart})`;
        }
      );

      // 处理表格中的图片路径替换
      const tableImgRegex = new RegExp(
        `\\|([^|]*)${escapedUrl}([^|]*)\\|`,
        "g"
      );

      updatedMarkdown = updatedMarkdown.replace(
        tableImgRegex,
        (match, before, after) => {
          return `|${before}${relativePath}${after}|`;
        }
      );

      logToFile(`替换图片路径: ${originalUrl} -> ${relativePath}`);
    } catch (error) {
      logToFile(`替换图片路径出错: ${error.message}`);
    }
  });

  return updatedMarkdown;
}
