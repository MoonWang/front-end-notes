移动端 video 踩坑

# 一、自动播放

## 1、原生实现

原生属性 autoplay 支持度很高，但是受限于系统、浏览器策略、容器(如微信等 app 中的 webview)限制，表现并不一致，多数情况下并不好使。例如，一个大家熟知的策略，可以添加 muted 属性，设置成静音来配合自动播放实现，但常不能满足需要。

```html
<video autoplay></video>
```

常见报错：在用户手势操作前不能通过脚本调用 play() 方法。

```
Uncaught (in promise) DOMException: play() failed because the user didn't interact with the document first.
```

## 2、微信（IOS）

IOS 下的微信，可以通过脚本调用 `video.play()` 方法实现自动播放，但是该实现方式依赖于 `WeixinJSBridge`，所以需要判断是否加载完成，即监听 `WeixinJSBridgeReady` 事件。

```js
if(typeof WeixinJSBridge == "undefined"){
    document.addEventListener('WeixinJSBridgeReady', function() {
        video.play();
    }, false);
} else {
    video.play();
}
```

说明：安卓下依然可以调用 video.play() 方法，但是无法播放成功，在开始播放后会被立即暂停，进入`暂停状态`。（部分安卓机型可以播放成功，但不是 x5 内核）

## 3、退出全屏后暂停

在微信和 QQ 中常有以下表现：退出全屏时，会暂停播放。如果有需要连续播放，需要做些特殊处理。

```js
video.addEventListener('x5videoexitfullscreen', function() {
    video.play();
}, false);
```

# 二、播放控制

## 1、原生实现

通常如果需求简单的话，可以通过原生属性来实现基本的控制功能。

```html
<video controls></video>
```

实现简单粗暴，但是同时也有以下问题：UI 和交互可能会被产品嫌弃。。。

## 2、自定义实现

注意：有些不常见的浏览器(机型)会劫持自定义实现的控制条，直接显示原生的控制条，或者两种同时显示，这种情况暂无解决方案。

### 2.1 播放/暂停

考虑移动端控制条的尺寸问题，所以一般会有一大一小两种操作按钮，这个实现比较简单了

- 绑定点击事件，执行 play()/pause() 
- 监听 play/pause 事件来更新状态
- 如果有需要，还可以增加一个 loading 状态

### 2.2 全屏

见第三部分 2。

### 2.3 其他

比较常见的音量、播放进度，在此次直播 SDK 开发中未使用，如需用到可自行查阅相关文档，也都是从`绑定操作 + 监听对应事件`两点上进行需求定制。

# 三、全屏

## 1、屏蔽默认全屏

有些时候开始播放的默认表现会自动进入全屏，大多时候并不需要这一表现，需要主动屏蔽掉。

**IOS：**

```html
<video playsinline="true" webkit-playsinline="true"></video>
```

**QQ：**

```html
<video x5-playsinline="true"></video>
```

**微信：**

不要用同层播放器

## 2、切换全屏

### 2.1 原生进入全屏

**容器全屏：**

使用到的方法是：[Element.requestFullscreen()](https://developer.mozilla.org/zh-CN/docs/Web/API/Element/requestFullScreen)。

注意：
1. 调用此API并不能保证元素一定能够进入全屏模式。
    - 成功则 document 对象会收到一个 fullscreenchange 事件
    - 失败则收到一个 fullscreenerror 事件
2. 这里一般是操作的 video 外的 div `容器`
    - 容器都不支持的时候，会尝试下面的 video 全屏
3. 该方法有兼容性（移动端一般前两个够用了）
    - Element.requestFullscreen()
    - Element.webkitRequestFullScreen()
    - Element.mozRequestFullScreen()
    - Element.msRequestFullscreen()

**video 全屏：**

一般见于 IOS 

- 先尝试 video.requestFullscreen() 
- 再尝试 video.webkitEnterFullscreen()
    - 此时没有对应的监听事件（也可能是我没找到，有知道的麻烦补充）
    - 此时进入全屏后，会劫持自定义控制条，显示默认控制条（如果一定要自定义，你可能需要假全屏）
    - 一些延迟到退出全屏的操作，此时可以在这之后直接处理（如全屏按钮状态改变）

### 2.2 原生退出全屏

有进入，自然有退出

使用到的方法：[Document.exitFullscreen()](https://developer.mozilla.org/zh-CN/docs/Web/API/Document/exitFullscreen)

注意：
1. 此处不是 Element 而是 Document
2. 调用这个方法会让文档回退到上一个调用 Element.requestFullscreen() 方法进入全屏模式之前的状态。
3. 同样有兼容问题
    - document.exitFullscreen()
    - document.webkitExitFullscreen()
    - document.mozCancelFullScreen()
    - document.msExitFullscreen()

### 2.3 全屏对应事件

**原生事件：**

通用，但是检测不到 IOS 下的 video.webkitEnterFullscreen() 进入的全屏。

```js
document.addEventListener("fullscreenchange", function(){
    var el = document.fullscreen || document.fullscreenElement; //获取全屏元素
    if(el) {
        // 进入全屏
    } else {
        // 退出全屏
    }
}, false);
document.addEventListener('webkitfullscreenchange', function () {
    var el = document.webkitIsFullScreen || document.webkitFullscreenElement; //获取全屏元素
    if(el) {
        // 进入全屏
    } else {
        // 退出全屏
    }
}, false);
```

**X5事件：**

应用于`微信`中

```js
_t._video.addEventListener('x5videoenterfullscreen', function() {
    // 进入全屏
}, false);
_t._video.addEventListener('x5videoexitfullscreen', function() {
    // 退出全屏
}, false);
```

### 2.4 假全屏

当原生全屏不满足需求时，比如：显示 logo 、显示弹幕、控制条可控（前面提到的 ios 下全屏），你可能需要用假全屏来实现。

大概思路：设置 video 尺寸为屏幕尺寸，并旋转+定位。

这里有比较大的坑，如手势操作、返回键等。所以如果可以，尽量用原生的。

# 四、封面

## 1、原生封面

表现还算良好，只是不会 100% 覆盖 video 。

```html
<video poster="URL"></video>
```

## 2、自定义封面

在不需要自动播放的时候，可以考虑懒创建或延迟创建 video 实例，来提高访问性能。此时原生封面就不满足需要了，需要自定义。

实现上也比较简单，相同尺寸的图片展示+播放按钮展示，绑定点击事件进行需要的创建或者播放操作即可。

**注意：**

1. 关于封面移除的时机
    - 在开始播放到有画面，之间有一段时间（网速越慢就越明显），所以尽量不要立即移除封面
    - 移除的条件可以从点击触发，改为监听播放，当播放时长超过一定时间即认定为有画面存在（如 0.5s，没有固定标准，根据实际感受来处理）
    - 如果加载时间过长，可以考虑移除封面后，显示 loading 状态，避免用户感知不到正在加载而关闭页面
2. 关于懒创建和延迟创建选择
    - 如果需要点击后立即播放，就不能用懒创建 video 实例了，在部分情况下，会出现在 video 实例创建后，没有手势操作而无法自动播放的情况
3. 另一种 100% 封面
    - 前面提到原生封面无法满足 100% 覆盖 video，可以改用 css 背景图实现
        ```css
        .video {
            background-image: 'url(posterUrl)';
            background-size: '100% 100%';
        }
        ```
    - 上面方案存在缺点，如果视频源和 video 的尺寸比例不同，可以看到边缘图片内容，体验不好
    - 另，如果 video 设置背景可以设置成黑色

# 五、同层播放器

移动端浏览器中的 video 元素是比较特别的，早期无论是在 IOS 还是 Android 的浏览器中，它都位于页面的最顶层，无法被遮盖。后来这个问题在 IOS 下得到了解决，但是 Android 的浏览器则问题依旧。

此时无法实现自定义控制条、logo、弹幕等功能。（注：测试发现，未开始播放时，video 的层级还不是最高，依然可以被覆盖，前面提到的封面功能还是可以用的。）

腾讯基于 Webkit 开发了 X5 引擎，并提供了一种名叫`同层播放器`的特殊 video 元素以解决遮盖问题。

## 1、相关属性

```css
'x5-video-player-type' : 'h5'; /* 启用Ｈ5同层播放器 */
'x5-video-player-fullscreen': 'true'; /* 全屏方式，为 true 时改变播放时的视口大小，需要手动处理标题栏高度问题 */
'x5-video-orientation': 'portrait'; /* 控制横竖屏 landscape 横屏、portrait 竖屏、landscape|portrait 跟随手机旋转 */
```

## 2、相关说明

1. 只适用于 `Android` 下的腾讯产品
2. 此时播放就会进入全屏
3. 全屏状态下需要监听resize 事件实现自适应视口大小变化，因为视频播放时会调整视口大小
4. 可能用到的2个 css3 属性
    - [object-fit](https://developer.mozilla.org/zh-CN/docs/Web/CSS/object-fit)
        - 控制被替换元素的内容对象（视频画面）在元素框内的填充方式
        - 可以参考 background-size 记忆
    - [object-position](https://developer.mozilla.org/zh-CN/docs/Web/CSS/object-position)
        - 控制被替换元素的内容对象在元素框内的对齐方式
        - 可以参考 background-position 记忆
    - eg：
        ```css
        video {
            object-fit: contain;
            object-position: center 0;  /* 左右居中，上下贴顶 因为同层播放器设置的height是整个页面 */
        }
        ```

## 参考

- [官方文档](https://x5.tencent.com/tbs/guide/video.html)
- [X5浏览器内核同层播放器试用报告](https://www.jianshu.com/p/f164d92dcb78)

# 附

## 1、video 常用事件说明

```js
// 常见的事件类型
var eventsConfig = [
    'loadstart', // 在媒体开始加载时触发
    'progress', // 告知媒体相关部分的下载进度时周期性地触发。有关媒体当前已下载总计的信息可以在元素的buffered属性中获取到。
    'loadedmetadata',// 媒体的元数据已经加载完毕
    'loadeddata', // 媒体的第一帧已经加载完毕
    'canplay', // 在媒体数据已经有足够的数据（至少播放数帧）可供播放时触发
    'canplaythrough', // 表明媒体可以在保持当前的下载速度的情况下不被中断地播放完毕
    'play', // 在媒体回放被暂停后再次开始时触发。即，在一次暂停事件后恢复媒体回放。(不是真的在播放)
    'playing', // 在媒体开始播放时触发（不论是初次播放、在暂停后恢复、或是在结束后重新开始）。
    'pause', // 播放暂停时触发。
    'waiting', // 缓冲数据监听
    'abort', // 在播放被终止时触发，例如，当播放中的视频重新开始播放时会触发这个事件。
    'ended', // 播放结束时触发
    'error', // 在发生错误时触发。元素的error属性会包含更多信息
    'stalled', // 网络失速，在尝试获取媒体数据，但数据不可用时触发
    'timeupdate', // 时间改变监听
    'seeking', // 跳转至指定位置播放---寻找中
    'seeked', // 跳转至指定位置播放---寻找完毕
    'volumechange' // 音量改变监听
];
```

## 2、环境判断

```js
var ua  = navigator.userAgent.toLowerCase();

// 常见
var isAndroid = ua.indexOf('android') != -1;
var isIOS = ua.indexOf('iphone') != -1;
var isWechat = ua.indexOf('micromessenger') != -1;
var isQQ = ua.indexOf('qq/') != -1;
var isSafari = ua.indexOf('safari') != -1;
```
