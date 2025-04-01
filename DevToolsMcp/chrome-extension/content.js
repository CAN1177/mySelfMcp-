/**
 * 错误捕获MCP扩展 - 内容脚本
 * 注入到网页中捕获JavaScript错误
 */

// 错误存储
const errors = [];

// 初始化配置
let config = {
  enabled: true,
  serverUrl: "http://localhost:3000",
  captureGlobalErrors: true,
  capturePromiseRejections: true,
  captureConsoleErrors: true,
};

// 记录初始化状态
console.log("[错误捕获MCP] 内容脚本已加载");

// 注入可访问脚本
function injectAccessibleScript() {
  try {
    // 获取扩展中inject.js的URL
    const scriptURL = chrome.runtime.getURL("inject.js");

    // 创建script元素
    const scriptElement = document.createElement("script");
    scriptElement.src = scriptURL;
    scriptElement.onload = function () {
      // 脚本加载后移除，但它的代码会继续运行
      this.remove();
      console.log("[错误捕获MCP] inject.js 已加载并执行");
    };

    // 添加到文档中执行
    (document.head || document.documentElement).appendChild(scriptElement);

    // 监听自定义事件
    document.addEventListener("__ERROR_CATCHER_MCP_ERROR__", function (e) {
      if (e.detail && e.detail.error) {
        const errorData = e.detail.error;
        processError(errorData);
      }
    });

    console.log("[错误捕获MCP] 已注入可访问脚本");
  } catch (e) {
    console.error("[错误捕获MCP] 注入可访问脚本失败:", e);
  }
}

// 处理捕获到的错误
function processError(errorData) {
  // 添加时间戳
  const newError = {
    ...errorData,
    timestamp: errorData.timestamp || new Date().toISOString(),
  };

  // 检查是否重复错误
  const isDuplicate = errors.some(
    (error) => error.message === newError.message && error.url === newError.url
  );

  if (!isDuplicate) {
    // 添加到本地错误列表
    errors.push(newError);

    // 发送到后台脚本
    chrome.runtime.sendMessage({
      type: "NEW_ERROR",
      error: newError,
    });

    // 发送到MCP服务器
    try {
      fetch(`${config.serverUrl}/api/errors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newError),
      }).catch((err) => {
        console.error("[错误捕获MCP] 向服务器报告错误失败:", err);
      });
    } catch (e) {
      console.error("[错误捕获MCP] 向服务器报告错误失败:", e);
    }

    console.log("[错误捕获MCP] 已处理新错误:", newError.message);
  }
}

// 从存储中加载配置
chrome.storage.sync.get(["errorCatcherConfig"], function (result) {
  if (result.errorCatcherConfig) {
    config = { ...config, ...result.errorCatcherConfig };
    console.log("[错误捕获MCP] 已加载配置");
  }

  // 根据配置初始化
  if (config.enabled) {
    // 注入可访问脚本
    injectAccessibleScript();

    // 启用内容脚本中的捕获机制
    setupErrorCapture();

    console.log("[错误捕获MCP] 已启用错误捕获");
  }
});

// 设置内容脚本中的错误捕获
function setupErrorCapture() {
  // 直接在content脚本中捕获控制台错误
  const originalConsoleError = console.error;
  console.error = function () {
    // 调用原始方法
    originalConsoleError.apply(console, arguments);

    // 报告错误
    const errorMessage = Array.from(arguments)
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
      )
      .join(" ");

    const errorData = {
      message: errorMessage,
      url: window.location.href,
      context: "console.error (content script)",
      timestamp: new Date().toISOString(),
    };

    processError(errorData);
  };

  // 直接在content脚本中捕获全局错误
  window.addEventListener(
    "error",
    function (event) {
      const errorData = {
        message: event.message || "Unknown error",
        stack: event.error?.stack || "",
        url: event.filename || window.location.href,
        line: event.lineno,
        column: event.colno,
        source: "",
        context: "global error (content script)",
        timestamp: new Date().toISOString(),
      };

      processError(errorData);
    },
    true
  ); // 使用捕获阶段

  // 直接在content脚本中捕获Promise拒绝
  window.addEventListener("unhandledrejection", function (event) {
    const errorData = {
      message: event.reason?.message || "Unhandled Promise rejection",
      stack: event.reason?.stack || "",
      url: window.location.href,
      context: "unhandled rejection (content script)",
      timestamp: new Date().toISOString(),
    };

    processError(errorData);
  });

  // 使用MutationObserver扫描DOM中的错误元素
  setupErrorElementsObserver();

  // 监听来自页面的错误消息（通过postMessage）
  window.addEventListener("message", function (event) {
    // 确保消息来自当前窗口
    if (event.source !== window) return;

    if (event.data && event.data.type === "ERROR_CATCHER_ERROR") {
      const errorData = event.data.error;
      processError(errorData);
    }
  });

  // 定期扫描页面上的错误元素
  setInterval(scanPageForErrors, 5000);
}

// 使用MutationObserver监听控制台错误信息和DOM变化
function setupErrorElementsObserver() {
  // 监听DOM变化，查找新增的错误元素
  const observer = new MutationObserver(function (mutations) {
    let shouldScan = false;

    mutations.forEach(function (mutation) {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        shouldScan = true;
      }
    });

    if (shouldScan) {
      scanPageForErrors();
    }
  });

  // 开始观察整个文档
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

// 尝试在页面上查找可见的错误信息
function scanPageForErrors() {
  // 查找常见的错误元素选择器
  const errorSelectors = [
    ".error",
    ".exception",
    '[class*="error"]',
    '[class*="exception"]',
    ".message-error",
    ".alert-danger",
    ".has-error",
    '[role="alert"]',
  ];

  const errorElements = document.querySelectorAll(errorSelectors.join(","));

  if (errorElements.length > 0) {
    console.log(
      "[错误捕获MCP] 在页面上找到了 " +
        errorElements.length +
        " 个可能的错误元素"
    );

    errorElements.forEach((element) => {
      if (element.textContent && element.textContent.trim().length > 0) {
        const errorMessage = element.textContent.trim();

        const errorData = {
          message: errorMessage,
          url: window.location.href,
          context: "page DOM error element",
          timestamp: new Date().toISOString(),
        };

        // 添加到本地错误列表 (避免重复)
        if (!errors.some((e) => e.message === errorMessage)) {
          processError(errorData);
        }
      }
    });
  }

  // 特殊检查：浏览器中的控制台错误元素
  const consoleErrorElements = document.querySelectorAll(
    ".console-error-level, .console-error-message"
  );
  if (consoleErrorElements.length > 0) {
    consoleErrorElements.forEach((element) => {
      processError({
        message: element.textContent || "Console error element",
        url: window.location.href,
        context: "devtools console error element",
        timestamp: new Date().toISOString(),
      });
    });
  }
}

// 监听来自扩展的消息
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === "GET_ERRORS") {
    console.log(
      "[错误捕获MCP] 获取错误列表，当前有 " + errors.length + " 个错误"
    );
    sendResponse({ errors });
  } else if (message.type === "CLEAR_ERRORS") {
    errors.length = 0;
    console.log("[错误捕获MCP] 已清除所有错误");
    sendResponse({ success: true });
  } else if (message.type === "UPDATE_CONFIG") {
    config = { ...config, ...message.config };
    console.log("[错误捕获MCP] 配置已更新");

    // 重新初始化
    if (config.enabled) {
      setupErrorCapture();
      injectAccessibleScript();
    }

    sendResponse({ success: true });
  }

  return true; // 保持消息通道打开以进行异步响应
});

// 主动捕获页面上显示的错误
// 这对于已经渲染在DOM中的错误信息很有用
document.addEventListener("DOMContentLoaded", function () {
  if (config.enabled) {
    // 延迟一段时间，让页面完全加载
    setTimeout(scanPageForErrors, 1000);
  }
});

// 刷新页面时也重新扫描错误
window.addEventListener("load", function () {
  if (config.enabled) {
    setTimeout(scanPageForErrors, 1500);
  }
});
