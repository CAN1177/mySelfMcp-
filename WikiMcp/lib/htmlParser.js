// htmlParser.js - HTML内容解析模块
import { JSDOM } from "jsdom";
import { logToFile } from "./logger.js";

/**
 * 从HTML中提取有意义的内容
 * 使用JSDOM而不是正则表达式，以确保更准确地解析HTML
 * @param {string} htmlContent - 完整的HTML内容
 * @returns {Object} - 提取的内容 {title, content, dom}
 */
export function extractContentFromHtml(htmlContent) {
  try {
    // 创建JSDOM实例
    const dom = new JSDOM(htmlContent, {
      runScripts: "outside-only", // 不运行脚本但可以访问DOM
      resources: "usable", // 允许加载资源
      pretendToBeVisual: true, // 假装是可视环境
    });

    const document = dom.window.document;

    // 尝试获取标题
    let pageTitle = "";
    const titleElement = document.querySelector("title");
    if (titleElement) {
      pageTitle = titleElement.textContent.trim();
    } else {
      const h1 = document.querySelector("h1");
      if (h1) {
        pageTitle = h1.textContent.trim();
      }
    }

    // 尝试按优先级获取内容 - 但增加更多的选择器并调整优先级
    const contentSelectors = [
      // Confluence特定选择器
      "#main-content",
      "#content",
      ".wiki-content",
      ".confluence-content",
      "#wiki-content",
      ".page-content",
      ".pageSection",
      "#page",
      // 通用选择器
      "article",
      "main",
      ".article-content",
      "#main",
      // 最后的后备，直接获取完整页面内容
      ".container",
      ".content",
    ];

    let mainContent = null;

    // 按优先级尝试不同的选择器
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element && element.innerHTML.trim().length > 100) {
        // 只选择非空的有意义内容
        mainContent = element;
        logToFile(`成功使用选择器 ${selector} 找到内容`);
        break;
      }
    }

    // 如果没有找到任何特定的内容容器或找到的内容过少，回退到使用整个body
    if (!mainContent || mainContent.innerHTML.trim().length < 200) {
      mainContent = document.body;
      logToFile("未找到特定内容容器或内容过少，使用整个body作为内容");
    }

    // 返回提取的内容
    return {
      title: pageTitle,
      content: mainContent ? mainContent.outerHTML : htmlContent,
      dom: dom, // 返回DOM对象，方便图片处理
    };
  } catch (error) {
    logToFile(`使用JSDOM提取内容时出错: ${error.message}`);
    return {
      title: "无法解析标题",
      content: htmlContent, // 返回原始HTML作为后备
      dom: null,
    };
  }
}
