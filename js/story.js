/* ================= 冒險模式：故事資料 ================= */
const STORY_INTRO_SEEN_KEY = profileStorageKey('wordworm_story_intro_seen_v1');

const ADVENTURE_STORY = {
  introTitle: '活字圖書館的裂縫',
  intro: [
    '午夜十二點，城市邊緣那座老圖書館沒有熄燈。',
    '書架在黑暗裡自己移動，書籤偷偷換位置，句號從頁尾滾到地上。你從破舊字典的書脊裡探出頭，看見《原初字典》裂開了一道黑色縫隙。',
    '從縫裡流出的不是墨水，而是一種會吞掉字母的空白。它讓書頁長出牙齒，讓標點開始叛逃，讓安靜的書本變成一群脾氣很差的紙製怪物。',
    '身為最後一隻還清醒的單字蟲蟲，你必須爬進活字圖書館，把散落的字母拼回單字。每拼出一個字，就等於替書本補回一段意義。',
    '今晚要加班了。'
  ],
  world: [
    '在活字圖書館裡，文字不是死的。單字是橋，句子是路，故事是城市。',
    '怪物並不全是邪惡的。很多怪物只是被錯字污染的書頁、書籤、墨水或故事角色。打敗牠們，不是消滅牠們，而是把牠們校正回原本的位置。',
    '字母磚是散落在書頁上的活字；長單字會形成更完整的活字咒；稀有字母像古老的重型字模，難排版，但打起來很痛。',
    '鎖定磚是被膠水、書釘或墨痕封住的字母；詛咒磚則被黑色空白污染，雖然能拼進單字，但會讓攻擊變弱。'
  ],
  chapters: {
    'dusty-library': {
      logline: '入口書庫堆滿灰塵與破紙。紙頁鼠偷走目錄卡，墨漬怪把註解糊成一團，蛀書蟲王在百科全書裡醒來。',
      goal: '修復入口書庫，讓圖書館重新認得自己的目錄。',
      quote: '目錄卡上的字母少了一半。很不幸，剩下那一半剛好在怪物嘴裡。'
    },
    'ink-gallery': {
      logline: '墨水在迴廊裡失去控制。灰塵抄寫員複製錯句，紫墨術士染壞字母，漏字幽靈躲在句子中間吃掉關鍵詞。',
      goal: '修復索引，讓圖書館的道路重新連起來。',
      quote: '這裡每個錯字都像剛被影印過三十次，還很有自信。'
    },
    'crooked-fairytale': {
      logline: '童話區受到污染後，故事角色開始不照劇本走。紙皇冠女王命令句子低頭，逗號巨人把故事拖成永遠不結束的一句話。',
      goal: '修復童話的順序，讓故事重新有開頭、轉折和結尾。',
      quote: '沒有分段的童話，比 Boss 還難打。'
    },
    'star-chart-room': {
      logline: '星圖室保存天空的名字。當文字失序，星星也迷路了；彗星撞進頁邊，月相書吏把日期排錯。',
      goal: '校正星圖，找出通往圖書館核心的路。',
      quote: '如果星座名稱拼錯，導航就會很有冒險精神。'
    },
    'forbidden-greenhouse': {
      logline: '禁書溫室裡的書會自己生長。書根藤纏住書架，花粉筆記讓字母亂跳，千頁曼陀羅散播詛咒花粉。',
      goal: '讓知識停止失控生長，該開花的開花，該剪掉的剪掉。',
      quote: '這裡的註解長得比正文還快，編輯看了會沉默。'
    },
    'storm-index-harbor': {
      logline: '圖書館地下有一座索引港。海鹽泡壞書籤，章節海怪拖走段落，暴風裝訂師讓所有故事無法翻頁。',
      goal: '修好索引港，讓失散的章節回到自己的書裡。',
      quote: '每一頁都想出航，但沒有一頁看過目錄。'
    },
    'living-type-core': {
      logline: '活字核心是圖書館真正的心臟。《原初字典》的裂縫就在這裡，終章活字巨像收到錯誤指令，準備刪除所有文字。',
      goal: '用最後的單字，把圖書館從錯誤指令中喚醒。',
      quote: '只要什麼都不寫，就永遠不會寫錯。但那樣，也不會有故事了。'
    }
  },
  bossQuotes: {
    'bookworm-king': '蛀書蟲王張開書頁大嘴：所有文字，都該被我吃掉。',
    'archive-book': '索引巨冊翻動空白頁：我記得所有位置，卻忘了每本書的名字。',
    'comma-giant': '逗號巨人踩著句子走來：故事不准結束，全部接下去。',
    'atlas-curator': '星圖館長抬起失焦的眼睛：方向已過期，請重新校正天空。',
    'thousand-page-mandrake': '千頁曼陀羅展開葉片：每一頁註解，都會長出新的錯誤。',
    'storm-binder': '暴風裝訂師拉緊書脊：翻頁會造成混亂，所以我把一切裝訂到死。',
    'final-type-golem': '終章活字巨像低聲說：錯誤無法被完全修正。刪除文字，即可刪除錯誤。'
  },
  endingTitle: '已由單字蟲蟲校正',
  ending: [
    '最後一個單字落下時，整座圖書館安靜了。',
    '不是死寂，而是那種深夜書庫該有的安靜：紙張微微呼吸，書架輕輕伸展，遠處的索引卡自己排回正確位置。',
    '終章活字巨像跪下來，胸口的《原初字典》慢慢合上。裂縫沒有完全消失，只留下一道細細的金色書痕，像被仔細修補過的舊頁。',
    '你爬回入口書庫。',
    '紙頁鼠把目錄卡推回原位。墨漬怪變成一滴乖巧的紫墨。逗號巨人縮成一枚正常大小的逗號，雖然看起來還是很想亂插話。',
    '館長的銅牌重新浮現完整句子：「當文字失序時，請找到仍願意拼字的人。」',
    '你打了個呵欠，鑽回字典書脊裡。',
    '明天圖書館會照常開門。讀者不會知道今晚發生過什麼。',
    '他們只會發現，某本很久以前讀不懂的書，突然變得清楚了一點。',
    '而在頁角，有一行小小的字：「已由單字蟲蟲校正。請勿餵食錯字。」'
  ]
};

const ADVENTURE_COMICS = {
  intro: {
    ribbon: 'Introduction',
    title: '活字圖書館的裂縫',
    fullImage: 'assets/story/intro-comic-fixed.webp',
    panels: [
      {
        size: 'half',
        scene: 'library',
        image: 'assets/story/intro-1-library.webp',
        ribbon: '午夜，活字圖書館...',
        actors: ['worm'],
        bubble: '書架在動？',
        bubbleClass: 'on-art intro-bubble-1',
        caption: '單字蟲蟲從破舊字典裡探出頭，發現整座書庫正在發抖。'
      },
      {
        size: 'half',
        scene: 'archive',
        image: 'assets/story/intro-2-crack.webp',
        actors: ['worm', 'codex'],
        bubble: '字典裂了！',
        bubbleClass: 'on-art intro-bubble-2',
        caption: '黑色空白從書頁縫隙流出，吞掉散落的字母。'
      },
      {
        size: 'wide',
        scene: 'open-book',
        image: 'assets/story/intro-3-spell.webp',
        actors: ['worm', 'book'],
        bubble: '今晚要加班了。',
        bubbleClass: 'on-art intro-bubble-3',
        caption: '每拼回一個單字，就能替書本補回一段意義。'
      }
    ]
  },
  ending: {
    ribbon: 'Finale',
    title: '已由單字蟲蟲校正',
    slides: [
      {
        image: 'assets/story/chapter-7-ending-1-golem-peace.webp',
        alt: '終章活字巨像跪在安靜下來的圖書館中，胸口的原初字典泛著金色修補光痕',
        paragraphs: [
          '最後一個單字落下時，整座圖書館安靜了。',
          '不是死寂，而是那種深夜書庫該有的安靜：紙張微微呼吸，書架輕輕伸展，遠處的索引卡自己排回正確位置。',
          '終章活字巨像跪下來，胸口的《原初字典》慢慢合上。裂縫沒有完全消失，只留下一道細細的金色書痕，像被仔細修補過的舊頁。'
        ]
      },
      {
        image: 'assets/story/chapter-7-ending-2-library-restored.webp',
        alt: '入口書庫恢復秩序，紙頁鼠整理目錄卡，紫墨與逗號角色安靜待在旁邊',
        paragraphs: [
          '你爬回入口書庫。',
          '紙頁鼠把目錄卡推回原位。墨漬怪變成一滴乖巧的紫墨。逗號巨人縮成一枚正常大小的逗號，雖然看起來還是很想亂插話。',
          '館長的銅牌重新浮現完整句子：',
          '「當文字失序時，請找到仍願意拼字的人。」'
        ]
      },
      {
        image: 'assets/story/chapter-7-ending-3-book-spine.webp',
        alt: '單字蟲蟲打著呵欠鑽回字典書脊，晨光照進恢復平靜的圖書館',
        paragraphs: [
          '你打了個呵欠，鑽回字典書脊裡。',
          '明天圖書館會照常開門。讀者不會知道今晚發生過什麼。',
          '他們只會發現，某本很久以前讀不懂的書，突然變得清楚了一點。',
          '而在頁角，有一行小小的字：',
          '「已由單字蟲蟲校正。請勿餵食錯字。」'
        ]
      }
    ]
  },
  finalBossIntro: {
    ribbon: 'Final Boss',
    scene: 'core',
    panels: [
      {
        size: 'wide',
        scene: 'core',
        className: 'final-boss-intro-panel',
        image: 'assets/story/chapter-7-final-boss-intro.webp',
        actors: ['worm', 'golem'],
        caption: '錯誤無法被完全修正。刪除文字，即可刪除錯誤。'
      }
    ]
  },
  chapters: {
    'dusty-library': {
      ribbon: 'Chapter 1',
      scene: 'library',
      panels: [
        { size: 'half', scene: 'library', image: 'assets/story/chapter-1-library.webp', actors: ['worm'], bubble: '目錄卡被啃掉了？', caption: '入口書庫堆滿灰塵與破紙，字母散得到處都是。' },
        { size: 'half', scene: 'paper', image: 'assets/story/chapter-1-paper-mouse.webp', actors: ['worm', 'mouse'], bubble: '把 E 還來。', caption: '紙頁鼠躲在書架間，嘴邊還沾著半個字母。' },
        { size: 'wide', scene: 'open-book', image: 'assets/story/chapter-1-catalog-repair.webp', actors: ['book'], bubble: '修復目錄，才能往深處走。', caption: '目標：讓圖書館重新認得自己的目錄。' }
      ]
    },
    'ink-gallery': {
      ribbon: 'Chapter 2',
      scene: 'ink',
      panels: [
        { size: 'half', scene: 'ink', image: 'assets/story/chapter-2-ink-gallery.webp', actors: ['worm'], bubble: '這墨水也太有主見。', caption: '墨痕迴廊裡，每個錯字都像剛被影印過三十次。' },
        { size: 'half', scene: 'archive', image: 'assets/story/chapter-2-missing-word-ghost.webp', actors: ['worm', 'blob'], bubble: '別把關鍵詞吃掉！', caption: '漏字幽靈躲在句子中間，專門吞掉重要的詞。' },
        { size: 'wide', scene: 'open-book', image: 'assets/story/chapter-2-index-repair.webp', actors: ['book'], bubble: '修復索引，路才會回來。', caption: '目標：讓圖書館的道路重新連起來。' }
      ]
    },
    'crooked-fairytale': {
      ribbon: 'Chapter 3',
      scene: 'fairy',
      panels: [
        { size: 'half', scene: 'fairy', image: 'assets/story/chapter-3-fairytale-chaos.webp', actors: ['worm'], bubble: '童話角色不照劇本走了。', caption: '餅乾士兵、睡帽貓與玻璃鞋影子都迷失在錯誤段落裡。' },
        { size: 'half', scene: 'paper', image: 'assets/story/chapter-3-paper-queen.webp', actors: ['worm', 'queen'], bubble: '句子不需要向妳低頭啦。', caption: '紙皇冠女王要求所有文字服從她的排版。' },
        { size: 'wide', scene: 'open-book', image: 'assets/story/chapter-3-story-order.webp', actors: ['book'], bubble: '故事需要結尾。真的。', caption: '目標：讓童話重新有開頭、轉折和結尾。' }
      ]
    },
    'star-chart-room': {
      ribbon: 'Chapter 4',
      scene: 'stars',
      panels: [
        { size: 'half', scene: 'stars', image: 'assets/story/chapter-4-star-room.webp', actors: ['worm'], bubble: '星座名稱拼錯，導航會很刺激。', caption: '星圖閱覽室裡，連星星都開始迷路。' },
        { size: 'half', scene: 'archive', image: 'assets/story/chapter-4-observatory-golem.webp', actors: ['worm', 'golem'], bubble: '請校正天空座標。', caption: '觀測塔魔像只相信過期的星圖。' },
        { size: 'wide', scene: 'open-book', image: 'assets/story/chapter-4-star-map.webp', actors: ['book'], bubble: '找到核心的路。', caption: '目標：校正星圖，找出通往圖書館核心的方向。' }
      ]
    },
    'forbidden-greenhouse': {
      ribbon: 'Chapter 5',
      scene: 'greenhouse',
      panels: [
        { size: 'half', scene: 'greenhouse', image: 'assets/story/chapter-5-greenhouse.webp', actors: ['worm'], bubble: '註解長得比正文快。', caption: '禁書溫室裡，知識像藤蔓一樣失控生長。' },
        { size: 'half', scene: 'ink', image: 'assets/story/chapter-5-mandrake.webp', actors: ['worm', 'plant'], bubble: '花粉不要污染字母！', caption: '千頁曼陀羅散播詛咒花粉，讓單字變得虛弱。' },
        { size: 'wide', scene: 'open-book', image: 'assets/story/chapter-5-trim-growth.webp', actors: ['book'], bubble: '該開花的開花，該剪掉的剪掉。', caption: '目標：讓禁書停止失控生長。' }
      ]
    },
    'storm-index-harbor': {
      ribbon: 'Chapter 6',
      scene: 'harbor',
      panels: [
        { size: 'half', scene: 'harbor', image: 'assets/story/chapter-6-index-harbor.webp', actors: ['worm'], bubble: '目錄居然有港口？', caption: '地下索引港裡，失散的章節在暴風中漂流。' },
        { size: 'half', scene: 'stars', image: 'assets/story/chapter-6-chapter-kraken.webp', actors: ['worm', 'kraken'], bubble: '別拖走還沒寫完的段落！', caption: '章節海怪躲在浪裡，專門拉扯書頁。' },
        { size: 'wide', scene: 'open-book', image: 'assets/story/chapter-6-harbor-repair.webp', actors: ['book'], bubble: '讓章節回到自己的書裡。', caption: '目標：修好索引港，讓故事重新能夠翻頁。' }
      ]
    },
    'living-type-core': {
      ribbon: 'Final Chapter',
      scene: 'core',
      panels: [
        { size: 'half', scene: 'core', image: 'assets/story/chapter-7-type-core.webp', actors: ['worm'], bubble: '這裡就是裂縫中心。', caption: '活字核心像一顆心臟，在黑暗中一下一下發光。' },
        { size: 'half', scene: 'core', image: 'assets/story/chapter-7-type-golem.webp', actors: ['worm', 'golem'], bubble: '刪除所有文字？這需求不行。', caption: '終章活字巨像收到錯誤指令，準備抹去整座圖書館。' },
        { size: 'wide', scene: 'open-book', image: 'assets/story/chapter-7-final-word.webp', actors: ['book'], bubble: '只要還有故事，就不能全數刪除。', caption: '目標：用最後的單字喚醒圖書館。' }
      ]
    }
  }
};
