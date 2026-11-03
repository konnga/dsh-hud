/** 文案与动作同源：不靠中文字符串匹配，不把短句当作任务进度。
 * 事实由主文案负责（见 running-activity-cues.ts），这些短句只做旁白式装饰，
 * 因此允许玩笑、自嘲和「快了」这类语气——它们不被读成系统进度。 */
export type RunningGroup = 'idle' | 'edit' | 'shell' | 'read' | 'search' | 'other'
export type WhaleAction =
  | 'thinking'
  | 'context'
  | 'connect'
  | 'ponder'
  | 'writing'
  | 'checking'
  | 'typing'
  | 'watching'
  | 'reading'
  | 'inspecting'
  | 'searching'
  | 'working'
  | 'question'
  | 'butterfly'
  | 'gears'
  | 'puzzle'
  | 'thread'
  | 'sketching'
  | 'flashlight'
  | 'binoculars'
  | 'map'
  | 'measuring'
  | 'toolbox'
  | 'notes'
  | 'rice_eating'
  | 'rice_cheeks'
  | 'rice_terminal'
  | 'rice_ponder'
  | 'rice_reading'
  | 'rice_notes'

export interface RunningCue {
  zh: string
  en: string
  action: WhaleAction
}

/** 共 200 条中英文文案，按实际工具类别分组，全部为本项目自写。
 * 语气偏口语：约三成带「我」，允许自嘲与玩笑；不写具体秒数或百分比。 */
export var RUNNING_CUES: Record<RunningGroup, RunningCue[]> = {
  idle: [
    {
      zh: '让我把这条线索从头到尾捋一遍',
      en: 'Let me trace this thread from end to end',
      action: 'thinking',
    },
    {
      zh: '脑子里先把这件事完整过一遍',
      en: 'Running the whole thing through my head',
      action: 'context',
    },
    {
      zh: '这题得慢慢想，你先别催我',
      en: 'This needs time — no rushing me',
      action: 'connect',
    },
    {
      zh: '抱歉，我还在认真想这件事',
      en: 'Sorry — still thinking hard about this',
      action: 'question',
    },
    {
      zh: '线索有点乱，我一条条理清楚',
      en: 'Threads are tangled; tidying one by one',
      action: 'thread',
    },
    {
      zh: '我先猜一下，然后再去验证',
      en: 'Let me guess first, then go verify it',
      action: 'sketching',
    },
    {
      zh: '把前因后果连起来看一遍',
      en: 'Linking the cause back to its effect',
      action: 'puzzle',
    },
    {
      zh: '这几个方案里挑一个最稳的',
      en: 'Picking the steadiest of these options',
      action: 'butterfly',
    },
    {
      zh: '想清楚再动手，省得回头返工',
      en: 'Getting it right so we do not redo it',
      action: 'notes',
    },
    {
      zh: '我在找那个最关键的前提假设',
      en: 'Looking for the assumption underneath this',
      action: 'ponder',
    },
    {
      zh: '别急，再让我琢磨一小会儿',
      en: 'Not yet — letting it settle a bit longer',
      action: 'gears',
    },
    {
      zh: '脑子在转，给我一小会儿时间',
      en: 'Gears turning, give me a little time',
      action: 'map',
    },
    {
      zh: '这问题有点意思，值得认真想想',
      en: 'This one is interesting — worth a real think',
      action: 'binoculars',
    },
    {
      zh: '让我掂量掂量这件事的分量',
      en: 'Let me weigh how much this really matters',
      action: 'flashlight',
    },
    {
      zh: '先在草稿纸上画两笔看看',
      en: 'Sketching a couple of lines on the pad',
      action: 'measuring',
    },
    {
      zh: '让我把这个问题拆开看清楚',
      en: 'Let me take the question apart properly',
      action: 'rice_ponder',
    },
    {
      zh: '换个角度，再把同一个问题看一次',
      en: 'Trying the same problem from the side',
      action: 'rice_cheeks',
    },
    {
      zh: '我先找找这件事的边界在哪',
      en: 'Finding where the edges of this actually are',
      action: 'rice_notes',
    },
    {
      zh: '这地方我还没完全拿准',
      en: 'Not entirely sure about this part yet',
      action: 'rice_eating',
    },
    {
      zh: '在心里先把它们排个先后',
      en: 'Putting these in some kind of order',
      action: 'rice_reading',
    },
    {
      zh: '让我确认一下自己有没有读错',
      en: 'Let me check I did not misread that',
      action: 'thinking',
    },
    {
      zh: '有没有更简单的走法可以试',
      en: 'Is there a shorter way through this',
      action: 'context',
    },
    {
      zh: '想明白再动，能省掉一次返工',
      en: 'Thinking first saves us one rework',
      action: 'connect',
    },
    {
      zh: '脑子里先画一张潦草的草图',
      en: 'Drawing a rough map in my head',
      action: 'question',
    },
    {
      zh: '这一步我想走得比平常慢些',
      en: 'Taking this step slower than usual',
      action: 'thread',
    },
    {
      zh: '零散的念头先收拢到一起',
      en: 'Gathering the scattered thoughts together',
      action: 'sketching',
    },
    {
      zh: '我在找一个真能站得住的理由',
      en: 'Looking for a reason that actually holds up',
      action: 'puzzle',
    },
    {
      zh: '先把几个名词的意思对齐',
      en: 'Making sure we mean the same thing by these',
      action: 'butterfly',
    },
    {
      zh: '我在猜你真正想要的是哪个',
      en: 'Guessing which one you actually want',
      action: 'notes',
    },
    {
      zh: '这一层再往下挖一挖看看',
      en: 'Digging one layer further down here',
      action: 'ponder',
    },
    {
      zh: '先把这个念头存着，等会儿用',
      en: 'Holding that thought for use in a moment',
      action: 'gears',
    },
    {
      zh: '把两种做法摆在一起比一比',
      en: 'Putting two approaches side by side',
      action: 'map',
    },
    {
      zh: '把假设一条条记下来再说',
      en: 'Writing the assumptions down one by one',
      action: 'binoculars',
    },
    {
      zh: '我在等那个想法自己落地',
      en: 'Waiting for the idea to settle on its own',
      action: 'flashlight',
    },
    {
      zh: '想得太投入，差点忘了说话',
      en: 'Thought so hard I almost forgot to speak',
      action: 'measuring',
    },
    {
      zh: '我在脑子里开一个很短的会',
      en: 'Having a very short meeting in my head',
      action: 'rice_ponder',
    },
    {
      zh: '这段话我前前后后读了两遍',
      en: 'Read this section over twice now',
      action: 'rice_cheeks',
    },
    {
      zh: '会不会有坑，得先想一想',
      en: 'Checking for traps before committing here',
      action: 'rice_notes',
    },
    {
      zh: '这步走得稳一点，别图快',
      en: 'Better to be steady than fast on this',
      action: 'rice_eating',
    },
    {
      zh: '先把整条主线抓出来再说',
      en: 'Pulling out the main thread before anything',
      action: 'rice_reading',
    },
    {
      zh: '我在脑子里把它试跑一遍',
      en: 'Running it once through my head first',
      action: 'thinking',
    },
    {
      zh: '让我看看有没有现成的反例',
      en: 'Let me look for an existing counterexample',
      action: 'context',
    },
    {
      zh: '在这儿多停一会儿，想透一点',
      en: 'Pausing here until I understand it fully',
      action: 'connect',
    },
    {
      zh: '想想你以后会怎么用上它',
      en: 'Thinking how you will use this later on',
      action: 'question',
    },
    {
      zh: '我怕自己想得太浅了',
      en: 'Worried I am thinking about this too shallowly',
      action: 'thread',
    },
    {
      zh: '把几种可能都列出来看看',
      en: 'Laying all the possibilities out together',
      action: 'sketching',
    },
    {
      zh: '把话说圆一点再回答你',
      en: 'Getting the wording right before I answer',
      action: 'puzzle',
    },
    {
      zh: '找那个最小、最安全的改动',
      en: 'Looking for the smallest safe change here',
      action: 'butterfly',
    },
    {
      zh: '脑子有点挤，先理一理',
      en: 'Head is crowded — tidying it up first',
      action: 'notes',
    },
    {
      zh: '先搞懂你到底想要什么',
      en: 'First, working out what you actually want',
      action: 'ponder',
    },
    {
      zh: '心里先做一次减法看看',
      en: 'Simplifying rather than adding for once',
      action: 'gears',
    },
    {
      zh: '让我把思路完整说给你听',
      en: 'Let me lay out the whole line of thinking',
      action: 'map',
    },
    {
      zh: '这地方得小心一点处理',
      en: 'Careful with how I handle this bit',
      action: 'binoculars',
    },
    {
      zh: '能不能再省点事、省点钱',
      en: 'Can this be made cheaper to run somehow',
      action: 'flashlight',
    },
    {
      zh: '心里盘算一下这件事的代价',
      en: 'Weighing what this will cost us overall',
      action: 'measuring',
    },
    {
      zh: '把话说得再清楚一点点',
      en: 'Putting this a little more plainly',
      action: 'rice_ponder',
    },
    {
      zh: '我盯着这块已经看了好一会儿',
      en: 'Been staring at this for quite a while',
      action: 'rice_cheeks',
    },
    {
      zh: '找一个合适的切入点进去',
      en: 'Looking for a good place to start from',
      action: 'rice_notes',
    },
    {
      zh: '这问题得让我慢慢啃完它',
      en: 'This one needs chewing on until it is done',
      action: 'rice_eating',
    },
    {
      zh: '先想一半，剩下的稍后再说',
      en: 'Half the plan now, the rest later on',
      action: 'rice_reading',
    },
    {
      zh: '脑子里摆一摆这些拼图块',
      en: 'Shuffling the puzzle pieces around in there',
      action: 'thinking',
    },
    {
      zh: '让我把真正重要的挑出来',
      en: 'Let me pick out the parts that matter',
      action: 'context',
    },
    {
      zh: '想想最坏会坏到什么程度',
      en: 'Considering how bad the worst case gets',
      action: 'connect',
    },
    {
      zh: '想好了，就差把它说出口',
      en: 'Got it — just finding the words for it',
      action: 'question',
    },
  ],
  edit: [
    {
      zh: '我在这个函数里动手改几行',
      en: 'Working through a few lines in this function',
      action: 'writing',
    },
    {
      zh: '先把改动范围圈得越小越好',
      en: 'Keeping the diff as small as I can make it',
      action: 'checking',
    },
    {
      zh: '补上刚才漏掉的那个分支',
      en: 'Filling in the branch I missed earlier',
      action: 'toolbox',
    },
    {
      zh: '这一行我写得更直白一些',
      en: 'Making this line a little plainer',
      action: 'notes',
    },
    {
      zh: '把重复的部分先收拢起来',
      en: 'Gathering the duplicated parts together',
      action: 'gears',
    },
    {
      zh: '让我把这段拆成几个小块',
      en: 'Splitting this block into smaller pieces',
      action: 'puzzle',
    },
    {
      zh: '给这处改动补一句注释',
      en: 'Adding a note beside this change',
      action: 'measuring',
    },
    {
      zh: '把硬编码的地方换成参数',
      en: 'Turning the hardcoded value into a param',
      action: 'inspecting',
    },
    {
      zh: '在这儿先留一个记号',
      en: 'Leaving a small marker here for later',
      action: 'sketching',
    },
    {
      zh: '我在核对接口两边对不对齐',
      en: 'Checking both sides of the interface line up',
      action: 'working',
    },
    {
      zh: '把边界情况一并补齐',
      en: 'Filling in the boundary cases while here',
      action: 'writing',
    },
    {
      zh: '命名改得再容易读一点',
      en: 'Making the names a bit easier to read',
      action: 'checking',
    },
    {
      zh: '把多出来的空格删干净',
      en: 'Clearing out the stray whitespace',
      action: 'toolbox',
    },
    {
      zh: '这一处改动我做得比较小心',
      en: 'Being careful with this particular edit',
      action: 'notes',
    },
    {
      zh: '让我把这段逻辑搬个位置',
      en: 'Moving this logic somewhere it fits better',
      action: 'gears',
    },
    {
      zh: '顺手补一条兜底逻辑',
      en: 'Adding a fallback while I am in here',
      action: 'puzzle',
    },
    {
      zh: '把这段抽成单独的函数',
      en: 'Extracting this into its own function',
      action: 'measuring',
    },
    {
      zh: '理顺一下这里的前后顺序',
      en: 'Fixing the order these run in',
      action: 'inspecting',
    },
    {
      zh: '把错误提示写得具体一点',
      en: 'Making the error message more specific',
      action: 'sketching',
    },
    {
      zh: '删掉一行已经用不上的',
      en: 'Removing a line that is no longer used',
      action: 'working',
    },
    {
      zh: '我把注释写得再明白些',
      en: 'Writing the comment a bit more clearly',
      action: 'writing',
    },
    {
      zh: '改掉那个不太对的边界判断',
      en: 'Fixing that boundary check that looks off',
      action: 'checking',
    },
    {
      zh: '把这一层单独包起来',
      en: 'Wrapping this layer up on its own',
      action: 'toolbox',
    },
    {
      zh: '顺手把整体风格统一一下',
      en: 'Making the style consistent while here',
      action: 'notes',
    },
    {
      zh: '补上了刚才那个遗漏的点',
      en: 'Filled in the bit I had missed',
      action: 'gears',
    },
    {
      zh: '只动这几行，别的不碰',
      en: 'Touching only these lines and nothing else',
      action: 'puzzle',
    },
    {
      zh: '让我把这个变量名换掉',
      en: 'Renaming this variable to something clearer',
      action: 'measuring',
    },
    {
      zh: '把条件写得更紧一点',
      en: 'Tightening the condition a little',
      action: 'inspecting',
    },
    {
      zh: '我在修一个小毛病',
      en: 'Fixing a small wart here',
      action: 'sketching',
    },
    {
      zh: '改两遍我才觉得自己踏实',
      en: 'Editing twice before I feel sure about it',
      action: 'working',
    },
    {
      zh: '把新逻辑放进原来的位置',
      en: 'Dropping the new logic into place',
      action: 'writing',
    },
    {
      zh: '这块改动我来收尾',
      en: 'I will wrap up this part of the change',
      action: 'checking',
    },
  ],
  shell: [
    {
      zh: '命令还在跑，我在旁边等着',
      en: 'Command is still running — standing by',
      action: 'typing',
    },
    {
      zh: '盯着输出一行一行往下滚',
      en: 'Watching the output scroll line by line',
      action: 'watching',
    },
    {
      zh: '让我把这几个参数敲稳一点',
      en: 'Typing these arguments more carefully',
      action: 'rice_terminal',
    },
    {
      zh: '等它自己把话完整说完',
      en: 'Waiting for it to finish saying its piece',
      action: 'typing',
    },
    {
      zh: '终端在忙，我陪它一会儿',
      en: 'Terminal is busy, so I am too',
      action: 'watching',
    },
    {
      zh: '看看这次退出码是几',
      en: 'Checking what the exit code came back as',
      action: 'rice_terminal',
    },
    {
      zh: '这条命令我拆成两半来跑',
      en: 'Splitting this command into two runs',
      action: 'typing',
    },
    {
      zh: '听着风扇的声音慢慢变大',
      en: 'Listening to the fans spin up louder',
      action: 'watching',
    },
    {
      zh: '我先跑一条试试水再说',
      en: 'Running one first just to see',
      action: 'rice_terminal',
    },
    {
      zh: '把完整路径老老实实敲出来',
      en: 'Typing the full path out properly',
      action: 'typing',
    },
    {
      zh: '等那一行慢慢打印完',
      en: 'Waiting for that line to finish printing',
      action: 'watching',
    },
    {
      zh: '这条跑得比预期久一些',
      en: 'This one is taking longer than expected',
      action: 'rice_terminal',
    },
    {
      zh: '盯着光标一闪一闪地等',
      en: 'Watching the cursor blink while I wait',
      action: 'typing',
    },
    {
      zh: '让我把输出接住看看',
      en: 'Catching whatever it prints out',
      action: 'watching',
    },
    {
      zh: '看看这个目录里都有什么',
      en: 'Seeing what is actually in this folder',
      action: 'rice_terminal',
    },
    {
      zh: '先看看再说，不用急着下结论',
      en: 'Let me look before I say anything',
      action: 'typing',
    },
    {
      zh: '把标准输出收好别弄乱',
      en: 'Keeping stdout tidy and readable',
      action: 'watching',
    },
    {
      zh: '等它自己慢慢安静下来',
      en: 'Waiting for it to quiet down',
      action: 'rice_terminal',
    },
    {
      zh: '这段脚本估计要跑一会儿',
      en: 'This script probably needs a little while',
      action: 'typing',
    },
    {
      zh: '我盯着时间，也盯着它的输出',
      en: 'Watching the clock and the output together',
      action: 'watching',
    },
    {
      zh: '把前后两条命令串起来',
      en: 'Chaining the two commands together',
      action: 'rice_terminal',
    },
    {
      zh: '确认一下刚才那一步的结果',
      en: 'Confirming how that last step turned out',
      action: 'typing',
    },
    {
      zh: '参数我再从头核一遍',
      en: 'Double-checking the arguments from the top',
      action: 'watching',
    },
    {
      zh: '这条命令得当心一点跑',
      en: 'Running this command with some care',
      action: 'rice_terminal',
    },
    {
      zh: '在这儿等着它的返回结果',
      en: 'Waiting here for it to return',
      action: 'typing',
    },
    {
      zh: '让我把这份日志翻到底',
      en: 'Reading this log all the way to the end',
      action: 'watching',
    },
    {
      zh: '看看里面有没有报错痕迹',
      en: 'Looking for any trace of an error in there',
      action: 'rice_terminal',
    },
    {
      zh: '这一条我跑得比较谨慎',
      en: 'Running this one with a bit more caution',
      action: 'typing',
    },
    {
      zh: '终端先留在这儿别关',
      en: 'Keeping the terminal here for now',
      action: 'watching',
    },
    {
      zh: '等它跑完这一整轮',
      en: 'Waiting out this whole round',
      action: 'rice_terminal',
    },
    {
      zh: '我把命令改得更稳一点',
      en: 'Making the command a bit steadier',
      action: 'typing',
    },
    {
      zh: '在这儿守着，看它跑完',
      en: 'Standing guard until it finishes',
      action: 'watching',
    },
  ],
  read: [
    {
      zh: '我在翻这边的代码看看',
      en: 'Reading through the code over here',
      action: 'reading',
    },
    {
      zh: '顺着调用一层一层往下走',
      en: 'Following the calls down level by level',
      action: 'inspecting',
    },
    {
      zh: '找那个类型定义到底在哪',
      en: 'Finding where that type definition lives',
      action: 'map',
    },
    {
      zh: '这一段我前后读了两遍',
      en: 'Read this part over twice now',
      action: 'flashlight',
    },
    {
      zh: '拿灯照一下这里看清楚',
      en: 'Shining a light on this bit to see clearly',
      action: 'binoculars',
    },
    {
      zh: '看看究竟是谁在调它',
      en: 'Checking who actually calls this thing',
      action: 'notes',
    },
    {
      zh: '让我把关键几行抄下来',
      en: 'Copying the key lines out for reference',
      action: 'measuring',
    },
    {
      zh: '摸一摸这里原有的约定',
      en: 'Feeling out the conventions already in place',
      action: 'context',
    },
    {
      zh: '数一数一共几处调用',
      en: 'Counting up all the call sites',
      action: 'checking',
    },
    {
      zh: '在这个目录里先认认路',
      en: 'Getting my bearings inside this tree',
      action: 'reading',
    },
    {
      zh: '翻到具体实现那一层去',
      en: 'Reading down into the actual implementation',
      action: 'inspecting',
    },
    {
      zh: '看看边界情况怎么处理',
      en: 'Seeing how the edge cases get handled',
      action: 'map',
    },
    {
      zh: '这个文件比想的要长',
      en: 'This file is longer than I expected',
      action: 'flashlight',
    },
    {
      zh: '把相关的片段挑出来看',
      en: 'Picking out the relevant snippets',
      action: 'binoculars',
    },
    {
      zh: '我在画它们之间的依赖关系',
      en: 'Sketching the dependencies between them',
      action: 'notes',
    },
    {
      zh: '先找到真正的入口在哪',
      en: 'Locating where the real entry point is',
      action: 'measuring',
    },
    {
      zh: '往前找找最初是从哪来的',
      en: 'Tracing back to where this started',
      action: 'context',
    },
    {
      zh: '这段注释写得还挺清楚',
      en: 'This comment is actually quite helpful',
      action: 'checking',
    },
    {
      zh: '先确认一下这个假设',
      en: 'Confirming an assumption before going on',
      action: 'reading',
    },
    {
      zh: '让我把这一节再读一遍',
      en: 'Reading this section over again',
      action: 'inspecting',
    },
    {
      zh: '把两条路径摆一起对一对',
      en: 'Comparing the two paths side by side',
      action: 'map',
    },
    {
      zh: '看看有没有类似的先例',
      en: 'Looking for a similar case elsewhere',
      action: 'flashlight',
    },
    {
      zh: '这一处得多看两眼才行',
      en: 'This spot needs a second look from me',
      action: 'binoculars',
    },
    {
      zh: '把整条调用链梳理清楚',
      en: 'Untangling the whole call chain',
      action: 'notes',
    },
    {
      zh: '把缺的那点上下文补全',
      en: 'Filling in the surrounding context',
      action: 'measuring',
    },
    {
      zh: '我翻到了一个更旧的版本',
      en: 'Found an even older version of this',
      action: 'context',
    },
    {
      zh: '核对一下两边参数顺序',
      en: 'Checking the argument order on both sides',
      action: 'checking',
    },
    {
      zh: '这一段我还没完全看明白',
      en: 'Still not fully clear on this part',
      action: 'reading',
    },
    {
      zh: '让我把整段逻辑走一遍',
      en: 'Walking through the whole piece of logic',
      action: 'inspecting',
    },
    {
      zh: '找找那个藏起来的副作用',
      en: 'Hunting for that hidden side effect',
      action: 'map',
    },
    {
      zh: '把这几处改动串起来看',
      en: 'Connecting these few pieces together',
      action: 'flashlight',
    },
    {
      zh: '我读到最关键那一行了',
      en: 'Getting to the line that really matters',
      action: 'binoculars',
    },
  ],
  search: [
    {
      zh: '我上网找找有没有现成的',
      en: 'Looking online for something already out there',
      action: 'searching',
    },
    {
      zh: '在资料里翻一翻相关部分',
      en: 'Digging through the references for this part',
      action: 'context',
    },
    {
      zh: '换个说法再搜一次看看',
      en: 'Searching again with slightly different words',
      action: 'binoculars',
    },
    {
      zh: '找到一个看起来靠谱的出处',
      en: 'Found a source that looks reliable',
      action: 'flashlight',
    },
    {
      zh: '看看别人是怎么解决它的',
      en: 'Seeing how other people solved this',
      action: 'map',
    },
    {
      zh: '把手上几份材料对一对',
      en: 'Comparing the few sources I have',
      action: 'puzzle',
    },
    {
      zh: '搜到一点眉目了，继续',
      en: 'Getting somewhere with this search',
      action: 'notes',
    },
    {
      zh: '关键词再重新捡一遍',
      en: 'Picking the keywords again from scratch',
      action: 'inspecting',
    },
    {
      zh: '找找有没有相近的写法',
      en: 'Looking for similar patterns elsewhere',
      action: 'reading',
    },
    {
      zh: '顺着引用一层层往上找',
      en: 'Following the references up one layer at a time',
      action: 'searching',
    },
    {
      zh: '这块资料少得有点意外',
      en: 'The material here is thinner than expected',
      action: 'context',
    },
    {
      zh: '让我把搜索范围放大点',
      en: 'Widening the search a bit more',
      action: 'binoculars',
    },
    {
      zh: '确认一下这说法靠不靠',
      en: 'Checking whether this claim actually holds up',
      action: 'flashlight',
    },
    {
      zh: '我翻到了一份旧文档',
      en: 'Found an older document on this',
      action: 'map',
    },
    {
      zh: '找找有没有现成的反例',
      en: 'Checking whether a counterexample exists',
      action: 'puzzle',
    },
    {
      zh: '核对一下这句话的出处',
      en: 'Verifying where this sentence comes from',
      action: 'notes',
    },
    {
      zh: '手上现在有两条线索',
      en: 'Two leads to follow up on now',
      action: 'inspecting',
    },
    {
      zh: '让我再搜一次看看',
      en: 'Let me run one more search',
      action: 'reading',
    },
    {
      zh: '我在挑自己信得过的来源',
      en: 'Picking the sources I actually trust',
      action: 'searching',
    },
    {
      zh: '这份资料看起来有点旧',
      en: 'This reference looks a little dated',
      action: 'context',
    },
    {
      zh: '几个说法先对齐一下',
      en: 'Lining up the differing claims first',
      action: 'binoculars',
    },
    {
      zh: '找找原始那段话在哪',
      en: 'Looking for where the original text lives',
      action: 'flashlight',
    },
    {
      zh: '让我把这页看完再说',
      en: 'Let me finish reading this page first',
      action: 'map',
    },
    {
      zh: '确认过了，就是这一个',
      en: 'Confirmed — that is the right one',
      action: 'puzzle',
    },
  ],
  other: [
    {
      zh: '我手上的活还在继续做',
      en: 'Still working my way through this',
      action: 'working',
    },
    {
      zh: '把前后两件事接上',
      en: 'Joining the earlier part to the later one',
      action: 'connect',
    },
    {
      zh: '换一件更顺手的家伙',
      en: 'Switching to a more comfortable tool',
      action: 'toolbox',
    },
    {
      zh: '让几个齿轮慢慢咬合上',
      en: 'Getting the gears to mesh properly',
      action: 'gears',
    },
    {
      zh: '记一笔在小纸条上',
      en: 'Jotting this down on a small note',
      action: 'thread',
    },
    {
      zh: '让我把断掉的线头接回去',
      en: 'Reconnecting the loose end that came apart',
      action: 'rice_notes',
    },
    {
      zh: '按部就班、一步一步地做',
      en: 'Working through it one step at a time',
      action: 'checking',
    },
    {
      zh: '这一步我比较熟',
      en: 'I know this step fairly well',
      action: 'inspecting',
    },
    {
      zh: '先把要用的工具摆好',
      en: 'Lining up the tools I will need first',
      action: 'working',
    },
    {
      zh: '我在检查刚才做完的部分',
      en: 'Checking the part I just finished',
      action: 'connect',
    },
    {
      zh: '手上还剩下两件事要做',
      en: 'Two things left in hand to deal with',
      action: 'toolbox',
    },
    {
      zh: '让我把这一件收拾干净',
      en: 'Let me clean this one up properly',
      action: 'gears',
    },
    {
      zh: '等这一步真正落定',
      en: 'Waiting for this step to properly settle',
      action: 'thread',
    },
    {
      zh: '把前后的顺序理了理',
      en: 'Put the sequence back in order',
      action: 'rice_notes',
    },
    {
      zh: '我按原来的计划一步步走',
      en: 'Following the original plan step by step',
      action: 'checking',
    },
    {
      zh: '这一步我想做得稳当些',
      en: 'I want this step to land solidly',
      action: 'inspecting',
    },
  ],
}
