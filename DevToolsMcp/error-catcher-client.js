/**
 * 错误捕获MCP客户端
 * 用于嵌入到网页中以捕获JavaScript错误并发送到MCP服务器
 */
(function () {
  // 配置选项
  const defaultOptions = {
    serverUrl: "http://localhost:3000", // MCP服务器URL
    captureGlobalErrors: true, // 是否捕获全局错误
    capturePromiseRejections: true, // 是否捕获Promise拒绝
    captureConsoleErrors: true, // 是否捕获console.error调用
    maxStackLength: 1000, // 最大堆栈长度
    throttleDelay: 1000, // 错误报告节流延迟（毫秒）
    onErrorCaptured: null, // 错误捕获回调
    ignoredErrors: [], // 忽略的错误消息（字符串数组或正则表达式）
  };

  // 存储最后一次错误报告的时间戳，用于节流
  let lastErrorTime = 0;

  // 初始化错误捕获器
  window.ErrorCatcherMCP = {
    init: function (customOptions = {}) {
      // 合并选项
      const options = { ...defaultOptions, ...customOptions };

      // 存储选项
      this.options = options;

      // 初始化捕获器
      if (options.captureGlobalErrors) {
        this.setupGlobalErrorCapture();
      }

      if (options.capturePromiseRejections) {
        this.setupPromiseRejectionCapture();
      }

      if (options.captureConsoleErrors) {
        this.setupConsoleErrorCapture();
      }

      console.log("错误捕获客户端已初始化");

      return this;
    },

    // 设置全局错误捕获
    setupGlobalErrorCapture: function () {
      window.addEventListener("error", (event) => {
        const errorData = {
          message: event.message || "Unknown error",
          stack: event.error?.stack || "",
          url: event.filename || window.location.href,
          line: event.lineno,
          column: event.colno,
          source: "",
          context: document.title || window.location.pathname,
        };

        this.reportError(errorData);

        // 调用用户回调（如果有）
        if (typeof this.options.onErrorCaptured === "function") {
          this.options.onErrorCaptured(errorData, "global");
        }
      });
    },

    // 设置Promise拒绝捕获
    setupPromiseRejectionCapture: function () {
      window.addEventListener("unhandledrejection", (event) => {
        const errorData = {
          message: event.reason?.message || "Unhandled Promise rejection",
          stack: event.reason?.stack || "",
          url: window.location.href,
          context: document.title || window.location.pathname,
        };

        this.reportError(errorData);

        // 调用用户回调（如果有）
        if (typeof this.options.onErrorCaptured === "function") {
          this.options.onErrorCaptured(errorData, "promise");
        }
      });
    },

    // 设置控制台错误捕获
    setupConsoleErrorCapture: function () {
      const originalConsoleError = console.error;
      console.error = (...args) => {
        // 调用原始方法
        originalConsoleError.apply(console, args);

        // 报告错误
        const errorMessage = Array.from(args)
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ");

        const errorData = {
          message: errorMessage,
          url: window.location.href,
          context: "console.error",
        };

        this.reportError(errorData);

        // 调用用户回调（如果有）
        if (typeof this.options.onErrorCaptured === "function") {
          this.options.onErrorCaptured(errorData, "console");
        }
      };
    },

    // 报告错误
    reportError: function (errorData) {
      // 检查是否应忽略此错误
      if (this.shouldIgnoreError(errorData.message)) {
        return;
      }

      // 节流错误报告
      const now = Date.now();
      if (now - lastErrorTime < this.options.throttleDelay) {
        return;
      }
      lastErrorTime = now;

      // 限制堆栈长度
      if (
        errorData.stack &&
        errorData.stack.length > this.options.maxStackLength
      ) {
        errorData.stack =
          errorData.stack.substring(0, this.options.maxStackLength) + "...";
      }

      // 发送错误到服务器
      fetch(this.options.serverUrl + "/api/errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(errorData),
      })
        .then((response) => response.json())
        .then((data) => {
          console.log("错误已报告，ID:", data.errorId);
        })
        .catch((err) => {
          console.log("错误报告失败:", err);
        });
    },

    // 检查是否应忽略错误
    shouldIgnoreError: function (message) {
      return this.options.ignoredErrors.some((pattern) => {
        if (pattern instanceof RegExp) {
          return pattern.test(message);
        }
        return message.includes(pattern);
      });
    },

    // 手动报告错误
    report: function (error, context = "") {
      const errorData = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : "",
        url: window.location.href,
        context: context || document.title || window.location.pathname,
      };

      this.reportError(errorData);

      return errorData;
    },

    // 获取错误列表
    getErrors: function () {
      return fetch(this.options.serverUrl + "/api/errors").then((response) =>
        response.json()
      );
    },

    // 清除所有错误
    clearErrors: function () {
      return fetch(this.options.serverUrl + "/api/errors", {
        method: "DELETE",
      }).then((response) => response.json());
    },
  };
})();
