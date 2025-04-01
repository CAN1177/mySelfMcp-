/**
 * 错误捕获MCP扩展 - 可访问注入脚本
 * 此脚本通过web_accessible_resources被页面访问，避免CSP限制
 */

// 创建自定义事件通道
const ERROR_EVENT_NAME = "__ERROR_CATCHER_MCP_ERROR__";

// 初始化错误捕获
(function () {
  console.log("[错误捕获MCP] 独立注入脚本已加载");

  // 默认配置
  const config = {
    captureGlobalErrors: true,
    capturePromiseRejections: true,
    captureConsoleErrors: true,
  };

  // 最后一次错误报告的时间戳（用于节流）
  let lastErrorTime = 0;
  const throttleDelay = 1000;

  // 定义自定义事件，用于向扩展发送错误
  const sendErrorToExtension = function (errorData) {
    // 节流错误报告
    const now = Date.now();
    if (now - lastErrorTime < throttleDelay) {
      return;
    }
    lastErrorTime = now;

    // 创建自定义事件
    const errorEvent = new CustomEvent(ERROR_EVENT_NAME, {
      detail: { error: errorData },
    });

    // 分发事件
    document.dispatchEvent(errorEvent);

    // 同时也通过postMessage发送（兼容性保障）
    try {
      window.postMessage(
        {
          type: "ERROR_CATCHER_ERROR",
          error: errorData,
        },
        "*"
      );
    } catch (e) {
      // 忽略错误
    }
  };

  // 捕获全局错误
  if (config.captureGlobalErrors) {
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
          context: "global error from inject.js",
        };

        sendErrorToExtension(errorData);
      },
      true
    ); // 使用捕获阶段
  }

  // 捕获Promise拒绝
  if (config.capturePromiseRejections) {
    window.addEventListener("unhandledrejection", function (event) {
      const errorData = {
        message: event.reason?.message || "Unhandled Promise rejection",
        stack: event.reason?.stack || "",
        url: window.location.href,
        context: "unhandled rejection from inject.js",
      };

      sendErrorToExtension(errorData);
    });
  }

  // 重写console.error
  if (config.captureConsoleErrors) {
    try {
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
          context: "console.error from inject.js",
        };

        sendErrorToExtension(errorData);
      };
    } catch (e) {
      // 忽略错误
    }
  }

  // 扫描DOM中的错误
  function scanForDOMErrors() {
    try {
      // 查找常见的错误元素
      const errorElements = document.querySelectorAll(
        '.error, .exception, [class*="error"], [class*="exception"]'
      );

      errorElements.forEach((element) => {
        if (element.textContent && element.textContent.trim().length > 0) {
          sendErrorToExtension({
            message: element.textContent,
            url: window.location.href,
            context: "DOM error element from inject.js",
          });
        }
      });

      // 延迟再次扫描
      setTimeout(scanForDOMErrors, 5000);
    } catch (e) {
      // 忽略错误
    }
  }

  // 延迟启动DOM错误扫描
  setTimeout(scanForDOMErrors, 2000);

  // 特殊处理：捕获已在控制台显示的错误
  function captureExistingConsoleErrors() {
    // 这只能在特定条件下工作，但值得一试
    if (
      window.console &&
      window.console._commandLineAPI &&
      window.console._commandLineAPI.getEventListeners
    ) {
      try {
        const errorListeners = window.console._commandLineAPI.getEventListeners(
          window,
          "error"
        );
        if (errorListeners && errorListeners.length > 0) {
          // 已有错误监听器，可能有错误已被捕获
          // 这里可以尝试获取控制台日志
        }
      } catch (e) {
        // 忽略错误
      }
    }
  }

  // 尝试捕获已存在的错误
  captureExistingConsoleErrors();

  // 检查页面中的错误文本
  function findErrorTextsInDOM() {
    const textsToFind = [
      "error",
      "exception",
      "failed",
      "failure",
      "invalid",
      "uncaught",
      "unhandled",
      "undefined",
      "null",
      "NaN",
    ];

    // 获取所有文本节点
    const walker = document.createTreeWalker(
      document.body || document.documentElement,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const errorNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.toLowerCase();
      if (textsToFind.some((term) => text.includes(term))) {
        errorNodes.push(node);
      }
    }

    // 处理找到的可能包含错误的节点
    errorNodes.forEach((node) => {
      const parentEl = node.parentElement;
      if (
        parentEl &&
        !errorNodes.some((n) => n !== node && n.parentElement === parentEl)
      ) {
        sendErrorToExtension({
          message: node.textContent,
          url: window.location.href,
          context: "text node containing error keywords",
        });
      }
    });
  }

  // 延迟查找错误文本
  setTimeout(findErrorTextsInDOM, 3000);

  console.log("[错误捕获MCP] 已完成初始化");
})();
