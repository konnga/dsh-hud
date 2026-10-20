import { CHANNEL, imagePairKey } from '../shared.js'
import type { ImageRequest, ImagePayload } from '../shared.js'
import type { ImageSlice, ImageView, StoreContext } from './types.js'

/**
 * 「图片预览」这一片 store：二进制改动两侧的字节与尺寸，带一个同步缓存。
 */

export function createImageSlice(ctx: StoreContext): ImageSlice {
  var imagePairs = new Map<string, ImageView>()
  /** 这一片自己的缓存上限（照宿主半的 `CACHE_MAX_ENTRIES` 同一个量级）。 */
  var IMAGE_CACHE_MAX = 8

  /**
   * 同步看一眼缓存：命中就返回条目，否则 null。
   *
   * 有了它，`ImageDiff` 的**第一次渲染**就能把已经取过的图画出来 ——
   * 关掉再打开同一张图不该先闪一下"读取图片…"，也不该再发一次请求。
   */
  function cachedImagePair(request: ImageRequest): ImageView | null {
    if (request === null || request === undefined) return null
    var entry = imagePairs.get(imagePairKey(request))
    return entry === undefined ? null : entry
  }

  /** 供 `ImageDiff` 用：取一个二进制改动两侧的字节与尺寸（同一个请求只发一次）。 */
  function loadImagePair(request: ImageRequest): Promise<ImageView> {
    var key = imagePairKey(request)
    var cached = imagePairs.get(key)
    if (cached !== undefined) return Promise.resolve(cached)

    return Promise.resolve()
      .then(function () {
        return ctx.connection.rpc.call<ImagePayload>(CHANNEL, 'image', { args: request })
      })
      .then(function (result) {
        var entry: ImageView =
          result && result.ok === true && result.value
            ? { phase: 'ready', value: result.value }
            : {
                phase: 'error',
                code:
                  result && result.error && result.error.details ? result.error.details.code : null,
              }
        if (imagePairs.size >= IMAGE_CACHE_MAX) imagePairs.clear()
        imagePairs.set(key, entry)
        return entry
      })
      .catch(function () {
        return { phase: 'error', code: 'transport' }
      })
  }

  return { cachedImagePair: cachedImagePair, loadImagePair: loadImagePair }
}
