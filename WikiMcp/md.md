# 1v1模式_0403 - 惠居 - 贝壳

  

<script type="text/javascript">//<![CDATA[ (function() { $ = AJS.$; var graphContainer = document.getElementById('drawio-macro-content-b6aaf832-e49c-4798-b938-ad609359b3c4'); DrawioProperties = { contextPath : AJS.contextPath(), buildNumber : 8100 }; var readerOpts = {}; readerOpts.loadUrl = '' + '/rest/drawio/1.0/diagram/crud/%E6%95%B0%E6%8D%AE%2D%E7%AD%96%E7%95%A5%2D%E5%8A%9F%E8%83%BD%E8%AE%BE%E8%AE%A1/1492153220?revision=4'; readerOpts.imageUrl = '' + '/download/attachments/1492153220/数据-策略-功能设计.png' + '?version=4&api=v2'; readerOpts.editUrl = '' + '/plugins/drawio/addDiagram.action?ceoId=1492153220&owningPageId=1492153220&diagramName=%E6%95%B0%E6%8D%AE%2D%E7%AD%96%E7%95%A5%2D%E5%8A%9F%E8%83%BD%E8%AE%BE%E8%AE%A1&revision=4&diagramDisplayName='; readerOpts.editable = true; readerOpts.canComment = true; readerOpts.stylePath = STYLE_PATH; readerOpts.stencilPath = STENCIL_PATH; readerOpts.imagePath = IMAGE_PATH + '/reader'; readerOpts.border = true; readerOpts.width = '1621'; readerOpts.simpleViewer = false; readerOpts.tbstyle = 'top'; readerOpts.links = 'auto'; readerOpts.lightbox = true; readerOpts.resourcePath = ATLAS_RESOURCE_BASE + '/resources/viewer'; readerOpts.disableButtons = false; readerOpts.zoomToFit = true; readerOpts.language = 'zh'; readerOpts.licenseStatus = 'OK'; readerOpts.contextPath = AJS.contextPath(); readerOpts.diagramName = decodeURIComponent('%E6%95%B0%E6%8D%AE%2D%E7%AD%96%E7%95%A5%2D%E5%8A%9F%E8%83%BD%E8%AE%BE%E8%AE%A1'); readerOpts.diagramDisplayName = ''; readerOpts.aspect = ''; readerOpts.ceoName = '1v1模式_0403'; readerOpts.attVer = '4'; readerOpts.attId = '1493631362'; readerOpts.lastModifierName = '刘佳悦'; readerOpts.lastModified = 'Mon Apr 07 16:15:07 CST 2025'; readerOpts.creatorName = '刘佳悦'; readerOpts.maxScale = parseFloat('1'); //Embed macro specific info readerOpts.extSrvIntegType = ''; readerOpts.gClientId = ''; readerOpts.oClientId = ''; readerOpts.service = ''; readerOpts.sFileId = ''; readerOpts.odriveId = ''; readerOpts.diagramUrl = ''; readerOpts.csvFileUrl = ''; readerOpts.pageId = '' || Confluence.getContentId(); readerOpts.aspectHash = ''; readerOpts.useExternalImageService = '' == 'true'; readerOpts.isTemplate = '' == 'true'; if (readerOpts.width == '') { readerOpts.width = null; } // LATER: Check if delayed loading of resources can be used for image placeholder mode var viewerPromise = createViewer(graphContainer, readerOpts); if(readerOpts.editable) { $(graphContainer).data('viewerConfig', readerOpts); $(graphContainer).on('drawioViewerUpdate', updateDrawioViewer); } })(); //]]></script>

  

**本期需要实现的开发清单如下：**

| --- | --- | --- |

|   |   | PM |
| 配置后台 | 圈人规则配置 | 程雪 |
|   | 推房内容配置 | 刘佳悦 |
|   | 推送策略配置 | 刘佳悦 |
| 企微推送 | \- | 刘佳悦 |

  

  

## **一、配置后台**

**位置：BMS租赁基础平台-托管去化，新增模块「推房配置」**

**三个tab：圈人规则、推房策略、推送策略**

### 1、圈人规则配置

| --- | --- | --- |

| 功能模块 | 需求详情 | 页面 |
| 开城配置 | 权限点 |   |
| 识别客户 | 1. 识别需求明确客户<br>    1. 定义需求明确  <br>        1. 客户范围：内容包含意向区域、预算、居室<br>2. 识别目前仍在租房的客户<br>    1. 客户未带看&客户未成交<br>    2. 客户非聚焦客<br>    3. 如果有最早入住时间：<br>        1. 客户最早入住时间-此刻 =<15天<br>    4. 如果没有最早入住时间，取最晚入住时间<br>        1. 客户最晚入住时间-此刻 =<15天 | ![](../../WikiImages/1v1_0403_-__-__613cffb1/1_table_image2025-4-3_17-7-42.png)<br><br>1. 圈人策略<br>    1. 使用场景：仅用于看占比，不应用于具体策略，具体生效条件用开城配置圈定经纪人<br>    2. 交互：<br>        1. 城市-总监-区域经理-经纪人，之间是层级关系<br>        2. 选了下级之后不能选上级<br>        3. 选了上级之后选的下级是上级的子集<br>        4. 下拉列表默认展示10个，多的用sug<br>2. 客户需求字段，取客户需求表，可多选<br>    1. 预算<br>    2. 找房区域<br>    3. 价格<br>3. 客户状态，两个字段且的关系（比如带看选是，成交选是，就是圈定既带看过又成交了的客户<br>    1. 带看：是/否/不限，默认不限<br>    2. 成交：是/否/不限，默认不限<br>4. 客户类型：<br>    1. 聚焦客：是/否/不限，默认不限<br>5. 入住时间：<br>    1. xx天计算规则：最早/最晚入住时间-「今天」（如果是查询规则是今天，如果是策略生效条件就是策略实施的那天）<br>6. 所有字段之间都是且的关系<br>7. 查询：查询后展示<br>    1. 企微客总数：总客户<br>    2. 有效企微客总数：未被删除的客户<br>    3. 圈定客户数：xxx个<br>    4. 圈定客户占比：xx.xx%（保留两位小数点，四舍五入）=圈定的客户/ 未被删除的客户 |
| 效果回收 | 1. 房卡推送小程序<br>    1. 展位保护：保护对应经纪人/客经的展位<br>    2. 数据回收：点击、约看房、电话、在线咨询、感兴趣数据记录 | 待与c端沟通 |

  

### 2、推房内容配置

![](../../WikiImages/1v1_0403_-__-__613cffb1/2_image2025-4-3_18-13-42.png)

#### **（1）不同「推房状态」对应的操作按钮**

| --- | --- | --- | --- | --- |

| 推房状态 | 状态说明 | 显示操作按钮 | 操作说明 | 示意图 |
| 待推送 | 当日按推房规则v1.0生成‘客/群-房’名单 | 修改 | - 点击修改出弹窗，在弹窗内进行修改<br><br>> 推房话术字符数上限200<br>> <br>> 按钮：取消、保存<br><br>- 点击保存需校验<br><br>> 编码不为空且能在link匹配到外网呈现的省心租出房编码，否则toast：请输出正确出房编码<br>> <br>> 对应推房话术不为空，否则toast：请输出推房话术<br><br>- 保存修改后，列表页刷新房源信息，但不刷新筛选条件 | ![](./WikiImages/1v1_0403_-__-__613cffb1/3_table_image2025-4-3_14-48-31.png) |
|   |   | 取消 | - 点击取消出二次确认弹窗<br><br>> 文案：是否确定取消本次推送？按钮：返回、确认取消<br><br>- 确认取消后推房状态变更为已取消，不予推送 |   |
| 已推送 | 推送出去的名单 | \- | \- |   |
| 已取消 | 已取消的名单 | 恢复（过当日自动推送时间后则隐藏） | - 点击恢复后toast：已恢复待推送状态<br>- 然后刷新页面，但不刷新筛选项 |   |

  

#### **（2）列表页**

| --- | --- |

| 需求描述 | 示意图 |
| **（1）通用规则**<br><br>- 默认态：默认筛选‘待推送’名单，其余选项不筛选（即为全部/空）<br><br>- 排序规则：按创建时间倒序排列，最新创建的排在最上面<br><br>- 展示数量：一页20条，支持下一页（通用组件即可）<br>- 列表展示字段为空则用‘-’占位<br>- 展示不下的...，hover显示全部 |   |
| **（2）列表展示字段**<br><br>- 推送信息<br><br>\| --- \| --- \|<br><br>\| 字段 \| 来源/定义 \|<br>\| 推房状态 \| 待推送、已推送、已取消 \|<br>\| 创建日期 \| 具体到日 \|<br>\| 模式 \| 群聊、私聊 \|<br><br>- 客经信息<br><br>\| --- \| --- \|<br><br>\| 字段 \| 来源/定义 \|<br>\| 城市 \| \- \|<br>\| 经纪人姓名 \| \- \|<br>\| 工号 \| \- \|<br><br>- 客户信息<br><br>\| --- \| --- \|<br><br>\| 字段 \| 来源/定义 \|<br>\| 群名 \| 本期无 \|<br>\| 群id \| 本期无 \|<br>\| 企微客昵称 \| 给客户的备注名称，customer\_remark\_name \|<br>\| 企微客id \| external\_customer\_id \|<br><br>- 房源信息<br><br>> 对标link-pc-房源，经纪人视角下信息<br>> <br>> API接口：问聪聪<br><br>\| --- \| --- \|<br><br>\| 字段 \| 来源定义 \|<br>\| 出房编码 \| 必须完整展示，可挤占商圈名占位 \|<br>\| 标题图 \| 实勘首图 \|<br>\| 楼盘/项目名称 \| 小区名称 \|<br>\| 商圈 \|   \|<br>\| 面积 \|   \|<br>\| 租金 \|   \|<br>\| 挂牌 \| link上是n天前，但我们用日期 \|<br>\| 房源详情 \| 点击查看，进入link-pc-房源详情页 \| | ![](./WikiImages/1v1_0403_-__-__613cffb1/4_table_image2025-4-2_17-13-1.png)<br><br>![](./WikiImages/1v1_0403_-__-__613cffb1/5_table_image2025-4-2_18-16-2.png) |
| **（3）筛选项**<br><br>> 就用通用组件  <br>> 筛选后联动更新列表内容<br><br>\| --- \| --- \| --- \| --- \|<br><br>\| 筛选项 \| 形式 \| 定义/枚举值 \|   \|<br>\| 推房状态 \| 单选 \| 待推送、已推送、已取消 \| 默认‘待推送’ \|<br>\| 创建日期 \| 日期选择器 \| 支持按日筛选，yyy-mm-dd \| 默认‘全部’ \|<br>\| 模式 \| 单选 \| 全部、群聊、私聊 \|   \|<br>\| 城市 \| 多选 \| 全部、城市枚举值 \|   \| |   |

  

### 3、推送策略配置

第三个tab：推送策略

| --- | --- |

| 需求描述 | 示意图 |
| - 支持按群运营模式&1v1模式分别配置，分别修改，分别保存生效<br>    - 点击‘修改’后在弹窗内修改<br>    - 保存后显示当前配置信息<br><br>- 支持配置内容<br><br>\| --- \| --- \| --- \|<br><br>\| 配置名称 \| 修改交互 \| 说明 \|<br>\| 推送数量 \| 本期仅做文案展示，不支持配置 \| - 本期文案：单次1套<br>- 本期设置为每次一个房源卡片<br>- 但后期支持配置单次推房数量 \|<br>\| 推送频率 \| 本期仅做文案展示，不支持配置 \| - 本期文案：每天<br>- 本期设置为每天触发定时推送 \|<br>\| 推送时间 \| 时间选择器，具体到分钟 \| - 本期设置为12:00 \|<br><br>- 更新后，次日生效 | ![](./WikiImages/1v1_0403_-__-__613cffb1/6_table_image2025-4-7_17-2-4.png) |

  

## **二、企微推送**

接口文档：[https://developer.work.weixin.qq.com/document/path/92135](https://developer.work.weixin.qq.com/document/path/92135)

| --- | --- |

|   |   |
| 客户接受数量限制 | 每位客户/每个客户群每月最多可接收条数为当月天数，超过接收上限的客户/客户群将无法再收到群发消息。 |
| 发送人 | 仅会推送给最后跟客户进行聊天互动的企业成员<br><br>这是指若客户跟两个客经产生过对话，我想给某个客户推房，这个推房确认信息将由最近一次跟客户交流的客经，即一个客户只会收到一位客经发来的推房卡片<br><br>前提：每个客的需求信息仅从最近产生互动的对话中获取，并应用于匹配策略 |
| 发送确认 | 调用该接口并不会直接发送消息给客户/客户群，需要成员确认后才会执行发送（客服人员的企业微信需要升级到2.7.5及以上版本）<br><br>![](./WikiImages/1v1_0403_-__-__613cffb1/7_table_image2025-4-7_16-58-19.png)![](./WikiImages/1v1_0403_-__-__613cffb1/8_table_image2025-4-7_16-58-35.png) |
| chat\_type | \= single |
| 发送内容 | - 小程序的房源详情页卡片<br>- 推送话术 |

  

  

<script>window.addEventListener('load', function() { try { var style = document.createElement('style') style.type = 'text/css' var css = document.createTextNode('.aui-button.keones:focus { background-color: transparent!important; }') style.appendChild(css) document.getElementsByTagName('head')[0].appendChild(style) function createButton(name, href,type) { var li = document.createElement('li'); li.className = 'ajs-button normal'; var a = document.createElement('a'); a.className= 'aui-button aui-button-subtle keones'; a.rel = 'nofollow'; a.target= '_blank'; a.href= href; var logo = document.createElement('img'); if(type === 'techpol'){ logo.src = 'http://img.ljcdn.com/beike/tech/images/1625735264545.png'; }else{ logo.src = 'http://s1.ljcdn.com/ke-ones/keones-logo-wiki.png'; } logo.style.display = 'inline-block'; logo.style.height = '16px'; logo.style.marginRight = '5px'; logo.style.verticalAlign = 'text-top'; var span = document.createElement('span'); span.style.padding = '0px'; var text = document.createTextNode(name); span.appendChild(text); a.appendChild(logo); a.appendChild(span); li.appendChild(a); return li; } var navMenu = document.getElementById('navigation').getElementsByClassName('ajs-menu-bar')[0]; var title = document.getElementById('title-text').getElementsByTagName('a')[0].textContent; var guideButton = createButton('使用指南','http://wiki.lianjia.com/pages/viewpage.action?pageId=8154057','techpol'); var reqButton = createButton('创建需求', 'http://ones.ke.com/project/requirement/create?wiki=' + encodeURIComponent(window.location.href) + '&reqName=' + encodeURIComponent(title)); navMenu.insertBefore(reqButton, navMenu.getElementsByTagName('li')[1]); navMenu.insertBefore(guideButton, reqButton); } catch (error) { console.error('KeOnes注入代码异常：', error) } })</script>

---

> 注意：文档中的 11 张图片（其中0张在表格中）已下载到本地文件夹 /Users/ke/Desktop/WikiImages/1v1_0403_-__-__613cffb1，并在Markdown中使用相对路径引用。