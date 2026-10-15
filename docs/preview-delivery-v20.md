# v20：资源交付排查与 Pages 发布准备

> **历史记录，已接续：** 用户已完成Pages切源，当前发布开发分支，无需重复操作。v21已完成真实Pages浏览器检查，见[当前交付说明](preview-delivery-v21.md)。以下保留当时排查过程，不代表当前状态。

2026-10-15。用户反馈 raw.githack 预览中平面地图、3D地球及其他图片均无法加载。

## 已核实

- 远端开发分支提交 `ab349075652cda67cadf0ea9b5a7691af8578e2f` 的666个文件对象与本地Git对象一致，其中501项为图片、模型、HDR或字体资源；不是只保存了HTML而遗漏所有图片。
- 使用不带认证的GitHub公开API实际下载了地形底图、球面贴图和学院GLB，分别约5.16MB、3.22MB、14.12MB，三个文件均与本地逐字节一致。完整记录：[public-asset-audit-v20.json](public-asset-audit-v20.json)。
- raw.githack的公开配置在[固定提交30d6b829](https://github.com/neoascetic/rawgithack/blob/30d6b829b667034240a7b700ab6cf4379c20805b/rawgithack.conf)中，仅代理MIME映射内的类型。PNG/JPG/WebP/GLB/HDR不在该映射内，未知类型会301转跳到原始资源域名。页面能打开不等于二进制资源经过同一个预览服务。
- 对HTML的公开访问还可能出现该服务的确认中间页。服务说明见其[首页](https://raw.githack.com/)。不能把该中间页或本地测试当作真实在线应用加载成功。
- 以上确认了交付链路存在风险，但没有获取用户设备的失败请求，**不宣称已证明具体网络故障，更不宣称用户设备已经恢复**。

## 用户授权与阻挡

用户已明确允许GitHub Pages暂时发布当前开发分支，而不合并或修改main。原Pages源为`main`、目录`/`，最近确认的已发布提交为`fef9c73c5e4dd006b9dbd2df5f4916cc7e279588`。

尝试调用Pages更新API后，GitHub返回403 `Resource not accessible by integration`。因此此次API修改没有生效，不能把“用户已授权”写成“部署已完成”。Arena当前GitHub连接需要相应Pages写入权限，或由仓库所有者手动修改设置。

已在开发分支添加根目录`.nojekyll`，供Pages按静态文件发布；应用文件、图片、3D模型、材质与渲染质量没有改动，也未重复上传或降采样已有资源。

## 历史切源步骤（用户已完成）

打开：<https://github.com/xoqnapgf-dot/ynxz/settings/pages>

在 **Build and deployment** 中：

1. Source保持 **Deploy from a branch**。
2. Branch从`main`改成 **`arena/4c4cfaac-ynxz`**，目录选择 **`/ (root)`**，点击 **Save**。

这会让现有Pages网址展示开发分支版本；不会合并main。需要恢复正式版时，把来源改回`main`即可。

## 当时的验收计划（结果见v21）

需要确认Pages构建完成、发布源及提交正确，再检查下列地址的实际页面和资源，而不是只确认Git仓库中有文件：

- 平面地图：<https://xoqnapgf-dot.github.io/ynxz/map.html>
- 3D地球：<https://xoqnapgf-dot.github.io/ynxz/globe.html>
- 平面底图、球面纹理、GLB及人物图片的HTTP响应、类型与浏览器解码。
- 父页面与3D iframe的同源通信、资源失败提示、返回入口。

在v20记录时，API切源被权限阻挡，线上新版本尚未验收；用户后续已完成切源，v21补上了线上验收。历史v19报告仅证明其本地页面测试，不证明raw.githack或Pages的交付链路。
