/** 文案与动作同源：不靠中文字符串匹配，不把轮播当作任务进度。 */
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

/** 共 100 条中英文文案：参考 WorkBuddy 的口语化语气，按实际工具类别改写。
 * 每组首句在工具切换时显示；其余只表达同类活动，不承诺完成或下一步。 */
export var RUNNING_CUES: Record<RunningGroup, RunningCue[]> = {
  idle: [
    {
      zh: '深度求索中',
      en: 'Deep diving',
      action: 'thinking',
    },
    {
      zh: '正在翻上下文',
      en: 'Reading the context',
      action: 'context',
    },
    {
      zh: '把线索串起来',
      en: 'Connecting the dots',
      action: 'connect',
    },
    {
      zh: '换个角度想想',
      en: 'Thinking from another angle',
      action: 'question',
    },
    {
      zh: '给思路松个结',
      en: 'Untangling a thought',
      action: 'thread',
    },
    {
      zh: '脑内草稿铺开了',
      en: 'Spreading out a mental draft',
      action: 'sketching',
    },
    {
      zh: '把问题拆小一点',
      en: 'Breaking the question into pieces',
      action: 'puzzle',
    },
    {
      zh: '追着小念头转一圈',
      en: 'Following a flutter of thought',
      action: 'butterfly',
    },
    {
      zh: '让想法排个队',
      en: 'Lining up the ideas',
      action: 'notes',
    },
    {
      zh: '一边嚼饭，一边琢磨',
      en: 'Having a bite and pondering',
      action: 'rice_eating',
    },
    {
      zh: '这条思路值得琢磨',
      en: 'Exploring this line of thought',
      action: 'question',
    },
    {
      zh: '沿着线头想一想',
      en: 'Following a thread of thought',
      action: 'thread',
    },
    {
      zh: '追着思路转个弯',
      en: 'Following a turn in the idea',
      action: 'butterfly',
    },
    {
      zh: '把前因后果连上',
      en: 'Linking causes and effects',
      action: 'puzzle',
    },
    {
      zh: '换副眼镜看问题',
      en: 'Looking through a different lens',
      action: 'binoculars',
    },
    {
      zh: '这口饭配点思考',
      en: 'A bite with a little thought',
      action: 'rice_ponder',
    },
    {
      zh: '在脑海里画张草图',
      en: 'Sketching an idea in mind',
      action: 'sketching',
    },
    {
      zh: '想法有点挤，理一理',
      en: 'Giving the ideas some room',
      action: 'gears',
    },
    {
      zh: '把重点从背景里挑出来',
      en: 'Picking out what matters',
      action: 'notes',
    },
    {
      zh: '给这个假设转个圈',
      en: 'Looking around this assumption',
      action: 'question',
    },
    {
      zh: '让几个方案碰个面',
      en: 'Bringing the options together',
      action: 'puzzle',
    },
    {
      zh: '沿着逻辑走一走',
      en: 'Walking through the logic',
      action: 'map',
    },
    {
      zh: '精神食粮也不能少',
      en: 'A little food for thought',
      action: 'rice_reading',
    },
    {
      zh: '嚼一嚼这条思路',
      en: 'Chewing over this idea',
      action: 'rice_cheeks',
    },
    {
      zh: '把问题摊开看清楚',
      en: 'Unfolding the question',
      action: 'question',
    },
    {
      zh: '在脑内摆一摆拼图',
      en: 'Arranging the mental puzzle',
      action: 'puzzle',
    },
    {
      zh: '追一追飘过的想法',
      en: 'Following a passing thought',
      action: 'butterfly',
    },
    {
      zh: '米饭配上小纸条',
      en: 'Rice with a few notes',
      action: 'rice_notes',
    },
    {
      zh: '把零散念头收拢',
      en: 'Gathering the scattered ideas',
      action: 'sketching',
    },
    {
      zh: '把直觉放到逻辑里看看',
      en: 'Examining the intuition with logic',
      action: 'ponder',
    },
    {
      zh: '跟着小灵感兜一圈',
      en: 'Taking a turn with a little idea',
      action: 'butterfly',
    },
    {
      zh: '让细节和全局碰个头',
      en: 'Putting details beside the big picture',
      action: 'notes',
    },
  ],
  edit: [
    {
      zh: '正在改文件',
      en: 'Editing files',
      action: 'writing',
    },
    {
      zh: '调整这几行',
      en: 'Adjusting these lines',
      action: 'writing',
    },
    {
      zh: '核对修改细节',
      en: 'Working through the changes',
      action: 'checking',
    },
    {
      zh: '把改动落在纸上',
      en: 'Putting the changes on the page',
      action: 'sketching',
    },
    {
      zh: '给代码修修边角',
      en: 'Refining the edges of the code',
      action: 'toolbox',
    },
    {
      zh: '让这段衔接自然些',
      en: 'Smoothing the connection here',
      action: 'writing',
    },
    {
      zh: '把意图写清楚',
      en: 'Making the intent clearer',
      action: 'writing',
    },
    {
      zh: '捋一捋修改的脉络',
      en: 'Tracing the changes through',
      action: 'notes',
    },
    {
      zh: '给细节挪个位置',
      en: 'Repositioning a detail',
      action: 'sketching',
    },
    {
      zh: '把这块拼得更贴合',
      en: 'Fitting this piece into place',
      action: 'puzzle',
    },
    {
      zh: '在改动里对齐线索',
      en: 'Aligning clues in the changes',
      action: 'notes',
    },
    {
      zh: '让命名少绕个弯',
      en: 'Making the naming more direct',
      action: 'writing',
    },
    {
      zh: '给这一处留好边界',
      en: 'Defining the boundary here',
      action: 'measuring',
    },
    {
      zh: '把修改范围圈清楚',
      en: 'Keeping the scope of changes clear',
      action: 'measuring',
    },
    {
      zh: '让新旧代码接上话',
      en: 'Joining the old and new code',
      action: 'gears',
    },
    {
      zh: '逐行照顾小细节',
      en: 'Tending to the details line by line',
      action: 'measuring',
    },
  ],
  shell: [
    {
      zh: '在敲命令',
      en: 'Running a command',
      action: 'typing',
    },
    {
      zh: '等它跑完',
      en: 'Waiting for output',
      action: 'watching',
    },
    {
      zh: '看着输出',
      en: 'Watching the output',
      action: 'watching',
    },
    {
      zh: '等终端回个信',
      en: 'Waiting to hear from the terminal',
      action: 'watching',
    },
    {
      zh: '命令在跑，我在旁边',
      en: 'Keeping the command company',
      action: 'watching',
    },
    {
      zh: '把这一程交给终端',
      en: 'Letting the terminal do this part',
      action: 'typing',
    },
    {
      zh: '等进程交回接力棒',
      en: 'Waiting for the process to hand back',
      action: 'watching',
    },
    {
      zh: '饭在碗里，眼在终端',
      en: 'Rice in the bowl, eyes on the terminal',
      action: 'rice_terminal',
    },
    {
      zh: '和命令一起等一会儿',
      en: 'Waiting alongside the command',
      action: 'watching',
    },
    {
      zh: '终端那头还在忙',
      en: 'The terminal is at work',
      action: 'typing',
    },
    {
      zh: '等输出冒个头',
      en: 'Waiting for output to appear',
      action: 'watching',
    },
    {
      zh: '给进程一点运行时间',
      en: 'Giving the process time to run',
      action: 'watching',
    },
    {
      zh: '看命令往哪走',
      en: 'Following the command as it runs',
      action: 'typing',
    },
    {
      zh: '守着这段运行过程',
      en: 'Keeping watch over the run',
      action: 'watching',
    },
  ],
  read: [
    {
      zh: '在翻代码',
      en: 'Reading the code',
      action: 'reading',
    },
    {
      zh: '找那一行',
      en: 'Finding that line',
      action: 'inspecting',
    },
    {
      zh: '顺着引用找',
      en: 'Following the references',
      action: 'reading',
    },
    {
      zh: '给调用链顺顺毛',
      en: 'Untangling the call chain',
      action: 'map',
    },
    {
      zh: '沿着函数往里看',
      en: 'Looking inside the function',
      action: 'flashlight',
    },
    {
      zh: '把入口和出口连起来',
      en: 'Connecting entry and exit points',
      action: 'reading',
    },
    {
      zh: '在代码里认认路',
      en: 'Finding a way through the code',
      action: 'map',
    },
    {
      zh: '看看这一层负责什么',
      en: 'Examining this layer’s role',
      action: 'flashlight',
    },
    {
      zh: '给关键分支放大一点',
      en: 'Zooming in on a key branch',
      action: 'binoculars',
    },
    {
      zh: '把引用关系铺开',
      en: 'Laying out the references',
      action: 'notes',
    },
    {
      zh: '顺着数据走一段',
      en: 'Following the data flow',
      action: 'map',
    },
    {
      zh: '把边界条件圈出来',
      en: 'Looking closely at boundary cases',
      action: 'measuring',
    },
    {
      zh: '抱着饭桶读两页',
      en: 'A couple of pages with a rice bucket',
      action: 'rice_reading',
    },
    {
      zh: '在细节里找线索',
      en: 'Looking for clues in the details',
      action: 'flashlight',
    },
    {
      zh: '把相邻几段一起看看',
      en: 'Reading the surrounding code',
      action: 'notes',
    },
    {
      zh: '让上下游接上话',
      en: 'Tracing the links upstream and down',
      action: 'binoculars',
    },
  ],
  search: [
    {
      zh: '在查资料',
      en: 'Searching references',
      action: 'searching',
    },
    {
      zh: '翻两页看看',
      en: 'Skimming results',
      action: 'context',
    },
    {
      zh: '给关键词换个问法',
      en: 'Trying another way to search',
      action: 'binoculars',
    },
    {
      zh: '在资料里找线头',
      en: 'Looking for a thread in the sources',
      action: 'flashlight',
    },
    {
      zh: '把相关页面摊开',
      en: 'Laying out relevant pages',
      action: 'notes',
    },
    {
      zh: '往原始出处靠一靠',
      en: 'Looking toward the original source',
      action: 'map',
    },
    {
      zh: '把说法放在一起看',
      en: 'Reading the accounts side by side',
      action: 'notes',
    },
    {
      zh: '沿着链接多看一眼',
      en: 'Following a link for a closer look',
      action: 'binoculars',
    },
    {
      zh: '给资料里的重点画圈',
      en: 'Picking out key details in the sources',
      action: 'flashlight',
    },
    {
      zh: '把背景信息补进来',
      en: 'Bringing in background information',
      action: 'map',
    },
    {
      zh: '把检索范围收一收',
      en: 'Narrowing the search',
      action: 'binoculars',
    },
    {
      zh: '从资料堆里找关联',
      en: 'Looking for connections in the sources',
      action: 'puzzle',
    },
  ],
  other: [
    {
      zh: '正在动手',
      en: 'Working on it',
      action: 'working',
    },
    {
      zh: '再理一理',
      en: 'Thinking it through',
      action: 'connect',
    },
    {
      zh: '给这件事搭把手',
      en: 'Lending a hand to this task',
      action: 'toolbox',
    },
    {
      zh: '把零散步骤串起来',
      en: 'Joining the scattered steps',
      action: 'gears',
    },
    {
      zh: '在这一步上花点心思',
      en: 'Giving this step some care',
      action: 'toolbox',
    },
    {
      zh: '边吃边理小纸条',
      en: 'Having a bite while sorting notes',
      action: 'rice_notes',
    },
    {
      zh: '把这件事稳稳接住',
      en: 'Handling this part with care',
      action: 'working',
    },
    {
      zh: '给任务理理线头',
      en: 'Untangling the task’s threads',
      action: 'thread',
    },
    {
      zh: '照看一下这块工作',
      en: 'Tending to this part of the work',
      action: 'toolbox',
    },
    {
      zh: '让手头的事情有条理',
      en: 'Keeping the work in order',
      action: 'gears',
    },
  ],
}
