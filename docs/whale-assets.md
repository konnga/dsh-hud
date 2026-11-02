# 鲸鱼娘资源维护

## 目录约定

| 路径 | 用途 | Git / 发布 |
| --- | --- | --- |
| `src/client/assets/whale-girl/*.webp` | 30 张实际使用的 112px 无损 WebP 动作图（含透明通道），唯一运行资源来源 | 进 Git；构建后嵌入 JS |
| `src/client/running-cues.ts` | 中英文文案及动作映射 | 进 Git |
| `src/client/whale-assets.ts` | WebP 转成 data URL 的生成模块 | Git 忽略；自动生成 |
| `lib/client.js` | DSH 实际加载的构建产物，已包含图片数据 | 沿用项目构建产物约定 |
| `docs/images/whale-girl-preview.webp` | README 的独立展示图 | 进 Git / 发布包 |
| `docs/images/whale-girl/` | 本地讨论、参考图、原始 API 输出、多尺寸导出、交互预览与检查工具 | 整目录 Git 忽略；不进发布包 |

运行与构建都不读取 `docs/images/whale-girl/`。删除或缺少本地讨论目录，不影响干净检出的构建、类型检查和测试。无需 Python、生图服务或 API 密钥。

## 更新运行图片

1. 把确认后的动作图放到 `src/client/assets/whale-girl/`：112 × 112px、无损 WebP（RGBA，保留透明度）；文件名对应动作 ID，如 `rice_eating.webp`。
2. 新增动作时同步更新 `src/client/running-cues.ts` 的 `WhaleAction` 与文案映射。
3. 执行：

```sh
pnpm build
pnpm test
pnpm format:check
```

`build`、`test`、`typecheck` 都会先运行 `scripts/generate-whale-assets.mjs`，从 `src` 自动生成内嵌模块。不要手改或提交生成的 `whale-assets.ts`；类型检查会核对动作映射，测试会核对原 WebP 与构建产物中的图片字节。

图片必须使用无损编码，不接受有损或动画 WebP。转换时启用 `lossless=True` 和 `exact=True`，逐张比较解码后的 RGBA，包含透明像素下的颜色。构建只校验 WebP 容器、无损编码、尺寸和透明标记，不执行格式转换，因此不依赖图片处理库。

客户端仍然使用 data URL 而不是运行时相对路径，适配 DSH 的经典脚本模块加载方式。图片在界面里显示为 56px；用时在文案上方。资源更新后重启本地 DSH 读取新构建。

## 文档与本地材料

README 需要展示图片时，复制或缩小一份到 `docs/images/` 顶层，不链接 Git 忽略的讨论目录。发布配置只纳入该目录顶层的 WebP 文档图，不附带原图、重复尺寸、离线预览或其他本地导出。

参考原图和高分辨率候选仍在本地保存，便于继续制作；它们不是生产依赖。旧导出与审图脚本已收进本地 `docs/images/whale-girl/v4/tools/`，只产生本地文件，不自动覆盖 `src` 中的正式资源。
