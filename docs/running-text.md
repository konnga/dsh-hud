# 运行文案

200 条中英文文案，按当前工具分为六组（思考 64、改文件 32、执行命令 32、读代码 32、搜索 24、其它 16）。配置在 `src/client/running-cues.ts`；文案与 30 种动作同源。

显示分两层，互不冒充：

- **主文案**：只陈述事实，来自当前会话的真实阶段（等待、模型思考、生成回复、准备工具调用、读取/修改文件、执行命令、搜索、等待确认、出错、已结束）。
- **趣味短语**：跟在主文案后面、样式更淡的一行。200 条口语短句共用一个池子，**不按当前工具筛选**——它是装饰，不是状态报告。每 6 秒从池子随机取一句，并保证不与屏幕上的上一句重复；鼠标悬停或键盘聚焦时暂停，移开后恢复；减少动态效果时停止轮换。

趣味短语会过滤掉 `正在…` 开头和「深度求索」这类复述事实的句子，避免读成第二条事实声明。表情在**新的事件身份**（新的模型阶段或新的工具调用）到来时，从该阶段的表情池里取下一张，同一次调用持续多久都不换图；时间和 Token 数都不会改变表情。

文案为本项目自行编写的短句，运行不依赖第三方应用或本地讨论记录。

## 思考 · 64 条

| 中文                           | English                                        | 动作           |
| ------------------------------ | ---------------------------------------------- | -------------- |
| 让我把这条线索从头到尾捋一遍   | Let me trace this thread from end to end       | `thinking`     |
| 脑子里先把这件事完整过一遍     | Running the whole thing through my head        | `context`      |
| 这题得慢慢想，你先别催我       | This needs time — no rushing me                | `connect`      |
| 抱歉，我还在认真想这件事       | Sorry — still thinking hard about this         | `question`     |
| 线索有点乱，我一条条理清楚     | Threads are tangled; tidying one by one        | `thread`       |
| 我先猜一下，然后再去验证       | Let me guess first, then go verify it          | `sketching`    |
| 把前因后果连起来看一遍         | Linking the cause back to its effect           | `puzzle`       |
| 这几个方案里挑一个最稳的       | Picking the steadiest of these options         | `butterfly`    |
| 想清楚再动手，省得回头返工     | Getting it right so we do not redo it          | `notes`        |
| 我在找那个最关键的前提假设     | Looking for the assumption underneath this     | `ponder`       |
| 别急，再让我琢磨一小会儿       | Not yet — letting it settle a bit longer       | `gears`        |
| 脑子在转，给我一小会儿时间     | Gears turning, give me a little time           | `map`          |
| 这问题有点意思，值得认真想想   | This one is interesting — worth a real think   | `binoculars`   |
| 让我掂量掂量这件事的分量       | Let me weigh how much this really matters      | `flashlight`   |
| 先在草稿纸上画两笔看看         | Sketching a couple of lines on the pad         | `measuring`    |
| 让我把这个问题拆开看清楚       | Let me take the question apart properly        | `rice_ponder`  |
| 换个角度，再把同一个问题看一次 | Trying the same problem from the side          | `rice_cheeks`  |
| 我先找找这件事的边界在哪       | Finding where the edges of this actually are   | `rice_notes`   |
| 这地方我还没完全拿准           | Not entirely sure about this part yet          | `rice_eating`  |
| 在心里先把它们排个先后         | Putting these in some kind of order            | `rice_reading` |
| 让我确认一下自己有没有读错     | Let me check I did not misread that            | `thinking`     |
| 有没有更简单的走法可以试       | Is there a shorter way through this            | `context`      |
| 想明白再动，能省掉一次返工     | Thinking first saves us one rework             | `connect`      |
| 脑子里先画一张潦草的草图       | Drawing a rough map in my head                 | `question`     |
| 这一步我想走得比平常慢些       | Taking this step slower than usual             | `thread`       |
| 零散的念头先收拢到一起         | Gathering the scattered thoughts together      | `sketching`    |
| 我在找一个真能站得住的理由     | Looking for a reason that actually holds up    | `puzzle`       |
| 先把几个名词的意思对齐         | Making sure we mean the same thing by these    | `butterfly`    |
| 我在猜你真正想要的是哪个       | Guessing which one you actually want           | `notes`        |
| 这一层再往下挖一挖看看         | Digging one layer further down here            | `ponder`       |
| 先把这个念头存着，等会儿用     | Holding that thought for use in a moment       | `gears`        |
| 把两种做法摆在一起比一比       | Putting two approaches side by side            | `map`          |
| 把假设一条条记下来再说         | Writing the assumptions down one by one        | `binoculars`   |
| 我在等那个想法自己落地         | Waiting for the idea to settle on its own      | `flashlight`   |
| 想得太投入，差点忘了说话       | Thought so hard I almost forgot to speak       | `measuring`    |
| 我在脑子里开一个很短的会       | Having a very short meeting in my head         | `rice_ponder`  |
| 这段话我前前后后读了两遍       | Read this section over twice now               | `rice_cheeks`  |
| 会不会有坑，得先想一想         | Checking for traps before committing here      | `rice_notes`   |
| 这步走得稳一点，别图快         | Better to be steady than fast on this          | `rice_eating`  |
| 先把整条主线抓出来再说         | Pulling out the main thread before anything    | `rice_reading` |
| 我在脑子里把它试跑一遍         | Running it once through my head first          | `thinking`     |
| 让我看看有没有现成的反例       | Let me look for an existing counterexample     | `context`      |
| 在这儿多停一会儿，想透一点     | Pausing here until I understand it fully       | `connect`      |
| 想想你以后会怎么用上它         | Thinking how you will use this later on        | `question`     |
| 我怕自己想得太浅了             | Worried I am thinking about this too shallowly | `thread`       |
| 把几种可能都列出来看看         | Laying all the possibilities out together      | `sketching`    |
| 把话说圆一点再回答你           | Getting the wording right before I answer      | `puzzle`       |
| 找那个最小、最安全的改动       | Looking for the smallest safe change here      | `butterfly`    |
| 脑子有点挤，先理一理           | Head is crowded — tidying it up first          | `notes`        |
| 先搞懂你到底想要什么           | First, working out what you actually want      | `ponder`       |
| 心里先做一次减法看看           | Simplifying rather than adding for once        | `gears`        |
| 让我把思路完整说给你听         | Let me lay out the whole line of thinking      | `map`          |
| 这地方得小心一点处理           | Careful with how I handle this bit             | `binoculars`   |
| 能不能再省点事、省点钱         | Can this be made cheaper to run somehow        | `flashlight`   |
| 心里盘算一下这件事的代价       | Weighing what this will cost us overall        | `measuring`    |
| 把话说得再清楚一点点           | Putting this a little more plainly             | `rice_ponder`  |
| 我盯着这块已经看了好一会儿     | Been staring at this for quite a while         | `rice_cheeks`  |
| 找一个合适的切入点进去         | Looking for a good place to start from         | `rice_notes`   |
| 这问题得让我慢慢啃完它         | This one needs chewing on until it is done     | `rice_eating`  |
| 先想一半，剩下的稍后再说       | Half the plan now, the rest later on           | `rice_reading` |
| 脑子里摆一摆这些拼图块         | Shuffling the puzzle pieces around in there    | `thinking`     |
| 让我把真正重要的挑出来         | Let me pick out the parts that matter          | `context`      |
| 想想最坏会坏到什么程度         | Considering how bad the worst case gets        | `connect`      |
| 想好了，就差把它说出口         | Got it — just finding the words for it         | `question`     |

## 修改文件 · 32 条

| 中文                     | English                                      | 动作         |
| ------------------------ | -------------------------------------------- | ------------ |
| 我在这个函数里动手改几行 | Working through a few lines in this function | `writing`    |
| 先把改动范围圈得越小越好 | Keeping the diff as small as I can make it   | `checking`   |
| 补上刚才漏掉的那个分支   | Filling in the branch I missed earlier       | `toolbox`    |
| 这一行我写得更直白一些   | Making this line a little plainer            | `notes`      |
| 把重复的部分先收拢起来   | Gathering the duplicated parts together      | `gears`      |
| 让我把这段拆成几个小块   | Splitting this block into smaller pieces     | `puzzle`     |
| 给这处改动补一句注释     | Adding a note beside this change             | `measuring`  |
| 把硬编码的地方换成参数   | Turning the hardcoded value into a param     | `inspecting` |
| 在这儿先留一个记号       | Leaving a small marker here for later        | `sketching`  |
| 我在核对接口两边对不对齐 | Checking both sides of the interface line up | `working`    |
| 把边界情况一并补齐       | Filling in the boundary cases while here     | `writing`    |
| 命名改得再容易读一点     | Making the names a bit easier to read        | `checking`   |
| 把多出来的空格删干净     | Clearing out the stray whitespace            | `toolbox`    |
| 这一处改动我做得比较小心 | Being careful with this particular edit      | `notes`      |
| 让我把这段逻辑搬个位置   | Moving this logic somewhere it fits better   | `gears`      |
| 顺手补一条兜底逻辑       | Adding a fallback while I am in here         | `puzzle`     |
| 把这段抽成单独的函数     | Extracting this into its own function        | `measuring`  |
| 理顺一下这里的前后顺序   | Fixing the order these run in                | `inspecting` |
| 把错误提示写得具体一点   | Making the error message more specific       | `sketching`  |
| 删掉一行已经用不上的     | Removing a line that is no longer used       | `working`    |
| 我把注释写得再明白些     | Writing the comment a bit more clearly       | `writing`    |
| 改掉那个不太对的边界判断 | Fixing that boundary check that looks off    | `checking`   |
| 把这一层单独包起来       | Wrapping this layer up on its own            | `toolbox`    |
| 顺手把整体风格统一一下   | Making the style consistent while here       | `notes`      |
| 补上了刚才那个遗漏的点   | Filled in the bit I had missed               | `gears`      |
| 只动这几行，别的不碰     | Touching only these lines and nothing else   | `puzzle`     |
| 让我把这个变量名换掉     | Renaming this variable to something clearer  | `measuring`  |
| 把条件写得更紧一点       | Tightening the condition a little            | `inspecting` |
| 我在修一个小毛病         | Fixing a small wart here                     | `sketching`  |
| 改两遍我才觉得自己踏实   | Editing twice before I feel sure about it    | `working`    |
| 把新逻辑放进原来的位置   | Dropping the new logic into place            | `writing`    |
| 这块改动我来收尾         | I will wrap up this part of the change       | `checking`   |

## 执行命令 · 32 条

| 中文                       | English                                    | 动作            |
| -------------------------- | ------------------------------------------ | --------------- |
| 命令还在跑，我在旁边等着   | Command is still running — standing by     | `typing`        |
| 盯着输出一行一行往下滚     | Watching the output scroll line by line    | `watching`      |
| 让我把这几个参数敲稳一点   | Typing these arguments more carefully      | `rice_terminal` |
| 等它自己把话完整说完       | Waiting for it to finish saying its piece  | `typing`        |
| 终端在忙，我陪它一会儿     | Terminal is busy, so I am too              | `watching`      |
| 看看这次退出码是几         | Checking what the exit code came back as   | `rice_terminal` |
| 这条命令我拆成两半来跑     | Splitting this command into two runs       | `typing`        |
| 听着风扇的声音慢慢变大     | Listening to the fans spin up louder       | `watching`      |
| 我先跑一条试试水再说       | Running one first just to see              | `rice_terminal` |
| 把完整路径老老实实敲出来   | Typing the full path out properly          | `typing`        |
| 等那一行慢慢打印完         | Waiting for that line to finish printing   | `watching`      |
| 这条跑得比预期久一些       | This one is taking longer than expected    | `rice_terminal` |
| 盯着光标一闪一闪地等       | Watching the cursor blink while I wait     | `typing`        |
| 让我把输出接住看看         | Catching whatever it prints out            | `watching`      |
| 看看这个目录里都有什么     | Seeing what is actually in this folder     | `rice_terminal` |
| 先看看再说，不用急着下结论 | Let me look before I say anything          | `typing`        |
| 把标准输出收好别弄乱       | Keeping stdout tidy and readable           | `watching`      |
| 等它自己慢慢安静下来       | Waiting for it to quiet down               | `rice_terminal` |
| 这段脚本估计要跑一会儿     | This script probably needs a little while  | `typing`        |
| 我盯着时间，也盯着它的输出 | Watching the clock and the output together | `watching`      |
| 把前后两条命令串起来       | Chaining the two commands together         | `rice_terminal` |
| 确认一下刚才那一步的结果   | Confirming how that last step turned out   | `typing`        |
| 参数我再从头核一遍         | Double-checking the arguments from the top | `watching`      |
| 这条命令得当心一点跑       | Running this command with some care        | `rice_terminal` |
| 在这儿等着它的返回结果     | Waiting here for it to return              | `typing`        |
| 让我把这份日志翻到底       | Reading this log all the way to the end    | `watching`      |
| 看看里面有没有报错痕迹     | Looking for any trace of an error in there | `rice_terminal` |
| 这一条我跑得比较谨慎       | Running this one with a bit more caution   | `typing`        |
| 终端先留在这儿别关         | Keeping the terminal here for now          | `watching`      |
| 等它跑完这一整轮           | Waiting out this whole round               | `rice_terminal` |
| 我把命令改得更稳一点       | Making the command a bit steadier          | `typing`        |
| 在这儿守着，看它跑完       | Standing guard until it finishes           | `watching`      |

## 阅读代码 · 32 条

| 中文                     | English                                      | 动作         |
| ------------------------ | -------------------------------------------- | ------------ |
| 我在翻这边的代码看看     | Reading through the code over here           | `reading`    |
| 顺着调用一层一层往下走   | Following the calls down level by level      | `inspecting` |
| 找那个类型定义到底在哪   | Finding where that type definition lives     | `map`        |
| 这一段我前后读了两遍     | Read this part over twice now                | `flashlight` |
| 拿灯照一下这里看清楚     | Shining a light on this bit to see clearly   | `binoculars` |
| 看看究竟是谁在调它       | Checking who actually calls this thing       | `notes`      |
| 让我把关键几行抄下来     | Copying the key lines out for reference      | `measuring`  |
| 摸一摸这里原有的约定     | Feeling out the conventions already in place | `context`    |
| 数一数一共几处调用       | Counting up all the call sites               | `checking`   |
| 在这个目录里先认认路     | Getting my bearings inside this tree         | `reading`    |
| 翻到具体实现那一层去     | Reading down into the actual implementation  | `inspecting` |
| 看看边界情况怎么处理     | Seeing how the edge cases get handled        | `map`        |
| 这个文件比想的要长       | This file is longer than I expected          | `flashlight` |
| 把相关的片段挑出来看     | Picking out the relevant snippets            | `binoculars` |
| 我在画它们之间的依赖关系 | Sketching the dependencies between them      | `notes`      |
| 先找到真正的入口在哪     | Locating where the real entry point is       | `measuring`  |
| 往前找找最初是从哪来的   | Tracing back to where this started           | `context`    |
| 这段注释写得还挺清楚     | This comment is actually quite helpful       | `checking`   |
| 先确认一下这个假设       | Confirming an assumption before going on     | `reading`    |
| 让我把这一节再读一遍     | Reading this section over again              | `inspecting` |
| 把两条路径摆一起对一对   | Comparing the two paths side by side         | `map`        |
| 看看有没有类似的先例     | Looking for a similar case elsewhere         | `flashlight` |
| 这一处得多看两眼才行     | This spot needs a second look from me        | `binoculars` |
| 把整条调用链梳理清楚     | Untangling the whole call chain              | `notes`      |
| 把缺的那点上下文补全     | Filling in the surrounding context           | `measuring`  |
| 我翻到了一个更旧的版本   | Found an even older version of this          | `context`    |
| 核对一下两边参数顺序     | Checking the argument order on both sides    | `checking`   |
| 这一段我还没完全看明白   | Still not fully clear on this part           | `reading`    |
| 让我把整段逻辑走一遍     | Walking through the whole piece of logic     | `inspecting` |
| 找找那个藏起来的副作用   | Hunting for that hidden side effect          | `map`        |
| 把这几处改动串起来看     | Connecting these few pieces together         | `flashlight` |
| 我读到最关键那一行了     | Getting to the line that really matters      | `binoculars` |

## 查资料 · 24 条

| 中文                     | English                                         | 动作         |
| ------------------------ | ----------------------------------------------- | ------------ |
| 我上网找找有没有现成的   | Looking online for something already out there  | `searching`  |
| 在资料里翻一翻相关部分   | Digging through the references for this part    | `context`    |
| 换个说法再搜一次看看     | Searching again with slightly different words   | `binoculars` |
| 找到一个看起来靠谱的出处 | Found a source that looks reliable              | `flashlight` |
| 看看别人是怎么解决它的   | Seeing how other people solved this             | `map`        |
| 把手上几份材料对一对     | Comparing the few sources I have                | `puzzle`     |
| 搜到一点眉目了，继续     | Getting somewhere with this search              | `notes`      |
| 关键词再重新捡一遍       | Picking the keywords again from scratch         | `inspecting` |
| 找找有没有相近的写法     | Looking for similar patterns elsewhere          | `reading`    |
| 顺着引用一层层往上找     | Following the references up one layer at a time | `searching`  |
| 这块资料少得有点意外     | The material here is thinner than expected      | `context`    |
| 让我把搜索范围放大点     | Widening the search a bit more                  | `binoculars` |
| 确认一下这说法靠不靠     | Checking whether this claim actually holds up   | `flashlight` |
| 我翻到了一份旧文档       | Found an older document on this                 | `map`        |
| 找找有没有现成的反例     | Checking whether a counterexample exists        | `puzzle`     |
| 核对一下这句话的出处     | Verifying where this sentence comes from        | `notes`      |
| 手上现在有两条线索       | Two leads to follow up on now                   | `inspecting` |
| 让我再搜一次看看         | Let me run one more search                      | `reading`    |
| 我在挑自己信得过的来源   | Picking the sources I actually trust            | `searching`  |
| 这份资料看起来有点旧     | This reference looks a little dated             | `context`    |
| 几个说法先对齐一下       | Lining up the differing claims first            | `binoculars` |
| 找找原始那段话在哪       | Looking for where the original text lives       | `flashlight` |
| 让我把这页看完再说       | Let me finish reading this page first           | `map`        |
| 确认过了，就是这一个     | Confirmed — that is the right one               | `puzzle`     |

## 其他工具 · 16 条

| 中文                   | English                                    | 动作         |
| ---------------------- | ------------------------------------------ | ------------ |
| 我手上的活还在继续做   | Still working my way through this          | `working`    |
| 把前后两件事接上       | Joining the earlier part to the later one  | `connect`    |
| 换一件更顺手的家伙     | Switching to a more comfortable tool       | `toolbox`    |
| 让几个齿轮慢慢咬合上   | Getting the gears to mesh properly         | `gears`      |
| 记一笔在小纸条上       | Jotting this down on a small note          | `thread`     |
| 让我把断掉的线头接回去 | Reconnecting the loose end that came apart | `rice_notes` |
| 按部就班、一步一步地做 | Working through it one step at a time      | `checking`   |
| 这一步我比较熟         | I know this step fairly well               | `inspecting` |
| 先把要用的工具摆好     | Lining up the tools I will need first      | `working`    |
| 我在检查刚才做完的部分 | Checking the part I just finished          | `connect`    |
| 手上还剩下两件事要做   | Two things left in hand to deal with       | `toolbox`    |
| 让我把这一件收拾干净   | Let me clean this one up properly          | `gears`      |
| 等这一步真正落定       | Waiting for this step to properly settle   | `thread`     |
| 把前后的顺序理了理     | Put the sequence back in order             | `rice_notes` |
| 我按原来的计划一步步走 | Following the original plan step by step   | `checking`   |
| 这一步我想做得稳当些   | I want this step to land solidly           | `inspecting` |
