const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET_COUNT = 732;
const OUT = path.join(ROOT, 'data', 'daily-words.json');
const TODO_OUT = path.join(ROOT, 'data', 'daily-words-template-todo.md');
const QUALITY_WINDOW_START = '2026-07-13';
const QUALITY_WINDOW_END = '2026-08-12';

const CURATED = `
aberration abeyance abject abjure abnegation abrogate abscond abstruse acerbic
acquiesce acrimony adroit adulation adulterate adventitious aesthetic affable
affinity aggrandize alacrity albeit alienate allay allude aloof altruism amalgam
ambivalent ameliorate amenable anomaly antecedent antipathy antithetical apathy
apocryphal appease appellation apprise approbation arbitrary arcane archetype
arduous artifice ascetic assiduous assuage astute atrophy attenuate audacious
austere autonomy avarice banal bellicose beneficent benign bequeath bombastic
brazen brusque burgeon cacophony capricious castigate catharsis caustic censure
chicanery circumspect clandestine clemency cogent commensurate complacent
compunction conciliatory concomitant confluence conjecture connoisseur consensus
construe consummate contentious contrition conundrum convivial copious corroborate
credulous cursory dearth debacle debunk decorum deferential deleterious demagogue
denigrate derivative desiccate despondent despot destitute didactic diffident
dilettante discern disparate dissemble docile dogmatic ebullient eclectic efficacy
egregious elated elicit eloquent elucidate embellish emollient empirical emulate
enervate engender enigmatic ennui ephemeral equanimity equivocal erudite esoteric
eulogy exacerbate exacting exculpate exigent extrapolate facetious fastidious
fatuous felicity fervent fetter flippant florid foment fortuitous frugal furtive
garrulous grandiloquent gratuitous gregarious guile harangue hegemony heterodox
hubris hyperbole iconoclast idiosyncrasy ignominious immutable impassive impecunious
imperious imperturbable implacable implicit impudent inchoate incongruous incumbent
indefatigable indigenous indolent ineffable inexorable ingenuous inimical innocuous
inscrutable insipid insular intrepid intransigent invective irascible itinerant
jocular judicious juxtapose laconic languid latent laudable lethargy levity lucid
lugubrious magnanimous malaise malign malleable mendacious mercurial meticulous
misanthrope mitigate modicum morose munificent nascent nefarious nebulous nuanced
obdurate obfuscate oblique obstinate officious onerous opaque opprobrium oscillate
ostentatious pacify palliate palpable panacea paradigm parsimonious paucity
pedantic perfunctory pernicious perspicacious pervasive phlegmatic placate platitude
plethora polemic pragmatic precipitate preclude precocious predilection prevaricate
pristine prodigal prolific propensity prosaic prudent pugnacious querulous quixotic
recalcitrant recondite refute relegate repudiate resilience reticent reverence
sagacious salient sanctimonious sanguine sardonic scrupulous seminal serendipity
solicitous soporific spurious stoic stringent sublime succinct supercilious
surreptitious tacit taciturn tantamount temerity tenuous tirade torpor transient
trenchant ubiquitous umbrage unequivocal untenable vacillate venerate verbose
vicarious vilify vindicate virulent visceral vociferous volition whimsical zealous
abstemious acumen adamant admonish anachronism animus apotheosis approbatory
arrogate axiomatic belated belligerent blithe cadenced cajole calumny canonical
capacious catalyze cerebral chimera circumscribe coalesce coercion cognizant
collusion compendium complicit concordant conflagration conjoin connote contravene
convoluted credence culpable debilitate defunct demarcate demure deride digress
disabuse disavow disconsolate disenfranchise disingenuous disinterested dissonance
divest divulge doctrinaire duplicity efface effrontery elegy embolden encumber
endemic ennoble entrench ephemeralize epistolary epithet epitomize equivocate
evince exegesis exemplary exhort exonerate exorbitant expedient expunge extol
fallacy floridness foible galvanize gainsay germane gravitas hallowed halcyon
hierarchy homogeneity iconography impervious impetuous importune impugn inane
incisive inculcate indemnity indeterminate indict indomitable infernal ingenuousness
inimicality interpolate inveterate irrefutable lacuna laudatory liminal litigate
magnate malevolent malfeasance manifold meander metaphysical metonymy mordant
neologism nihilism nominal nonchalant normative obviate opulent orthodoxy
parochial pathos patronize penitent peremptory peripatetic perspicuity pertinacious
philanthropy polemical portentous postulate precipitous preeminent preponderance
prescient probity proclivity promulgate proponent providential proximity qualm
quandary quiescent quotidian rarefied rectitude remonstrate renounce replete
reproach repugnant rescind resolute salubrious saturnine schism scrutinize
sedulous sententious simile solipsism specious stratagem strident subjugate
substantiate subterfuge surmise sycophant synthesis temerous transgress travesty
truculent turpitude usurp utopian vacuous venerable vestige vicissitude vitriolic
watershed winsome alchemy allegory amelioration antithesis aporia apportion
arbitration ascertain belittle byzantine catalyst circumlocution codify cogitation
commiserate commutation compartmentalize comport composure concision conditionality
consequential contextualize contingency contrarian convergence correlate declamation
deconstruct defamation deference delusion denouement depreciation dialectic
dichotomy diffuse dilatory diminution disambiguate discredit disinclination
disparity disseminate divergence dogma eclecticism effusive embargo emancipate
embitter embodiment encroachment enfranchise epigram equipoise eradication
erudition euphemism exasperate excoriate extemporaneous fallacious fecund
forestall fulminate gentrification grandiosity haphazard hermetic heuristic
histrionic hypercritical illegible illusory immaterial impartial imprecision
inalienable incapacitate incremental indifference indoctrinate inference inflection
infrastructure ingratiate inhibit insidious insurgent interoperability
interventionist inviolable irreverent jurisprudence legitimise leverage litany
loquacious macrocosm marginalize materiality mechanistic mediation melancholy
meritocracy microcosm misconstrue monumental multifaceted nebulosity negation
obsolescence omnipresent ontology paradigmatic parity pejorative permutation
personification pervasive placebo pluralism polarize polysemy posthumous
pragmatism precedence presumptuous privation prognosticate proliferation
quarantine ramification rationalize reciprocal recourse recursion redundancy
referential reification relativism remediate renunciation repertoire restitution
retroactive rhetoric sanctity segmentation semantic semiotic sequential
skepticism sobriety sociopolitical soliloquy sovereignty spatialize stipulate
stoicism subjectivity sublimation subordination supersede supposition teleology
totalitarian transcend trajectory transitory triangulate typology unilateral
verisimilitude vindication virtuosity volatility
`.trim().split(/\s+/);

const MANUAL = {
  ephemeral: {
    ipa: '/ɪˈfɛmərəl/',
    pos: 'adj.',
    zh: '短暫的、朝生暮死的',
    en: 'lasting for only a short time',
    academic_example: 'The study found that social media attention can be ephemeral rather than cumulative.',
    life_example: 'The rainbow was beautiful but ephemeral.'
  },
  ubiquitous: {
    ipa: '/juːˈbɪkwɪtəs/',
    pos: 'adj.',
    zh: '無所不在的、到處可見的',
    en: 'present or found everywhere',
    academic_example: 'Mobile devices have become ubiquitous in contemporary learning environments.',
    life_example: 'Coffee shops are ubiquitous near the station.'
  },
  umbrage: {
    ipa: '/ˈʌmbrɪdʒ/',
    pos: 'n.',
    zh: '因覺得被冒犯、輕視或不尊重而產生的不悅、怒意',
    en: 'offence or resentment caused by something perceived as insulting, disrespectful, or unfair',
    academic_example: 'The minister took umbrage at the report\'s implication that the policy had been drafted without proper consultation.',
    life_example: 'Mia took umbrage when her teammate dismissed her idea before she had finished explaining it.'
  },
  desiccate: {
    ipa: '/ˈdɛsɪkeɪt/',
    pos: 'v.',
    zh: '使乾燥、脫水；使失去活力',
    en: 'to dry something thoroughly or remove its vitality',
    academic_example: 'The preservation protocol used silica gel to desiccate the specimens before storage.',
    life_example: 'The summer heat can desiccate herbs left on the windowsill.'
  },
  sobriety: {
    ipa: '/səˈbraɪəti/',
    pos: 'n.',
    zh: '清醒、節制；嚴肅克制的狀態',
    en: 'the state of being sober, restrained, or serious',
    academic_example: 'The committee\'s report was praised for its sobriety in assessing the fiscal risks.',
    life_example: 'After the first panic passed, a bit of sobriety helped us choose a realistic plan.'
  },
  quiescent: {
    ipa: '/kwiˈɛsənt/',
    pos: 'adj.',
    zh: '靜止的、暫時不活動的',
    en: 'inactive or still, especially temporarily',
    academic_example: 'The virus can remain quiescent in host cells before reactivation.',
    life_example: 'The project was quiescent for months until a new client revived it.'
  },
  stoic: {
    ipa: '/ˈstoʊɪk/',
    pos: 'adj.',
    zh: '堅忍克制的，不輕易流露痛苦或情緒',
    en: 'enduring pain or difficulty without showing emotion or complaint',
    academic_example: 'The memoir presents a stoic response to political exile and personal loss.',
    life_example: 'Jay stayed stoic during the delay, even though everyone else was visibly annoyed.'
  },
  fortuitous: {
    ipa: '/fɔːrˈtuːɪtəs/',
    pos: 'adj.',
    zh: '偶然發生的、意外幸運的',
    en: 'happening by chance, often with a fortunate result',
    academic_example: 'The discovery was fortuitous, arising from an error in the sampling schedule.',
    life_example: 'A fortuitous empty seat appeared just as her laptop battery hit one percent.'
  },
  abscision: {
    ipa: '/æbˈsɪʒən/',
    pos: 'n.',
    zh: '切除、切斷、截去',
    en: 'the act of cutting off or removing something',
    academic_example: 'The procedure requires careful abscision of damaged tissue without disturbing nearby vessels.',
    life_example: 'The gardener\'s clean abscision of the broken branch helped the tree heal.'
  },
  postulate: {
    ipa: '/ˈpɑːstʃəleɪt/',
    pos: 'v.',
    zh: '假定、主張；提出作為推論前提',
    en: 'to assume or propose something as a basis for reasoning',
    academic_example: 'The model postulates that migration increases when local wages stagnate.',
    life_example: 'Before blaming the router, let\'s postulate that the cable might simply be loose.'
  },
  posthumous: {
    ipa: '/ˈpɑːstʃəməs/',
    pos: 'adj.',
    zh: '死後發生、出版或授予的',
    en: 'occurring, published, or awarded after someone\'s death',
    academic_example: 'The author\'s posthumous essays complicated earlier interpretations of her work.',
    life_example: 'The singer received a posthumous award two years after his final album.'
  },
  cogent: {
    ipa: '/ˈkoʊdʒənt/',
    pos: 'adj.',
    zh: '有說服力且條理清楚的',
    en: 'clear, logical, and convincing',
    academic_example: 'The article offers a cogent explanation for the decline in voter turnout.',
    life_example: 'Her argument for postponing the trip was cogent: the storm was already closing roads.'
  },
  prevaricate: {
    ipa: '/prɪˈværɪkeɪt/',
    pos: 'v.',
    zh: '支吾其詞、閃爍其辭',
    en: 'to avoid telling the truth directly, often by speaking evasively',
    academic_example: 'Officials continued to prevaricate when asked about the missing procurement records.',
    life_example: 'When I asked who ate the last slice, my brother began to prevaricate immediately.'
  },
  nonchalant: {
    ipa: '/ˌnɑːnʃəˈlɑːnt/',
    pos: 'adj.',
    zh: '若無其事的、漠不關心的',
    en: 'appearing calm and unconcerned',
    academic_example: 'The interviewees adopted a nonchalant tone when discussing routine surveillance.',
    life_example: 'She looked nonchalant, but she had rehearsed that presentation all week.'
  },
  monumental: {
    ipa: '/ˌmɑːnjuˈmentl/',
    pos: 'adj.',
    zh: '重大的、巨大的；紀念碑式的',
    en: 'extremely important, large, or impressive',
    academic_example: 'The trial produced a monumental shift in how courts interpret digital privacy.',
    life_example: 'Cleaning the garage felt like a monumental task, so we started with one shelf.'
  },
  benign: {
    ipa: '/bɪˈnaɪn/',
    pos: 'adj.',
    zh: '良性的、無害的；和善的',
    en: 'not harmful; gentle or kindly',
    academic_example: 'Most benign tumors do not invade surrounding tissue, but they still require monitoring.',
    life_example: 'The message looked suspicious, but it turned out to be benign.'
  },
  paucity: {
    ipa: '/ˈpɔːsəti/',
    pos: 'n.',
    zh: '少量、缺乏、不足',
    en: 'a lack or insufficient amount of something',
    academic_example: 'The paucity of longitudinal data limits conclusions about long-term outcomes.',
    life_example: 'There was a surprising paucity of snacks at a meeting scheduled through lunch.'
  },
  irrefutable: {
    ipa: '/ˌɪrɪˈfjuːtəbəl/',
    pos: 'adj.',
    zh: '無法反駁的、確鑿的',
    en: 'impossible to deny or disprove',
    academic_example: 'The DNA evidence provided irrefutable support for revising the conviction.',
    life_example: 'The empty cake box was irrefutable proof that someone had raided the fridge.'
  },
  inviolable: {
    ipa: '/ɪnˈvaɪələbəl/',
    pos: 'adj.',
    zh: '不可侵犯的、不可違背的',
    en: 'too important or sacred to be violated',
    academic_example: 'The constitution treats freedom of conscience as an inviolable right.',
    life_example: 'In our group chat, weekend sleep is an inviolable rule.'
  },
  alienate: {
    ipa: '/ˈeɪliəneɪt/',
    pos: 'v.',
    zh: '使疏遠、離間',
    en: 'to make someone feel isolated, estranged, or hostile',
    academic_example: 'Heavy-handed reforms may alienate the communities they are intended to help.',
    life_example: 'Changing every plan at the last minute will alienate the people doing the work.'
  },
  histrionic: {
    ipa: '/ˌhɪstriˈɑːnɪk/',
    pos: 'adj.',
    zh: '過度戲劇化的、誇張做作的',
    en: 'overly dramatic or theatrical in expression or behavior',
    academic_example: 'The critique describes the speech as histrionic rather than substantively persuasive.',
    life_example: 'His histrionic reaction to a typo made the whole team go quiet.'
  },
  surmise: {
    ipa: '/sərˈmaɪz/',
    pos: 'v.',
    zh: '推測、臆測',
    en: 'to infer something without certain proof',
    academic_example: 'Researchers surmise that the settlement expanded after the river changed course.',
    life_example: 'From the wet umbrella, I surmised that it had started raining again.'
  },
  virulent: {
    ipa: '/ˈvɪrələnt/',
    pos: 'adj.',
    zh: '劇毒的、致病力強的；惡意強烈的',
    en: 'extremely harmful, infectious, or hostile',
    academic_example: 'A more virulent strain could overwhelm hospitals if vaccination rates fall.',
    life_example: 'The review was so virulent that the owner replied with a full apology.'
  },
  engender: {
    ipa: '/ɪnˈdʒendər/',
    pos: 'v.',
    zh: '造成、引起、產生',
    en: 'to cause a feeling, condition, or situation to develop',
    academic_example: 'Opaque decision-making can engender distrust among affected communities.',
    life_example: 'A tiny scheduling mistake can engender a surprising amount of chaos.'
  },
  abalienation: {
    ipa: '/æbˌeɪliəˈneɪʃən/',
    pos: 'n.',
    zh: '財產讓渡；疏離、轉移',
    en: 'the transfer of property or rights; also estrangement',
    academic_example: 'The manuscript uses abalienation to describe the transfer of land from the estate to the crown.',
    life_example: 'The legal form was about abalienation of ownership, which means the property was being transferred.'
  },
  winsome: {
    ipa: '/ˈwɪnsəm/',
    pos: 'adj.',
    zh: '討喜的、迷人的、天真可愛的',
    en: 'charming in a simple, appealing way',
    academic_example: 'The campaign relied on a winsome narrative that softened the candidate\'s technocratic image.',
    life_example: 'Her winsome smile made the tense room relax for a moment.'
  },
  belated: {
    ipa: '/bɪˈleɪtɪd/',
    pos: 'adj.',
    zh: '遲來的、延遲的',
    en: 'coming or happening later than expected',
    academic_example: 'The agency issued a belated acknowledgment of the data collection error.',
    life_example: 'I sent a belated birthday message after realizing I had the wrong date.'
  },
  fatuous: {
    ipa: '/ˈfætʃuəs/',
    pos: 'adj.',
    zh: '愚蠢而空洞的、自以為是的',
    en: 'silly, foolish, and lacking serious thought',
    academic_example: 'The editorial dismissed the proposal as fatuous because it ignored basic funding constraints.',
    life_example: 'Buying a new printer to avoid one paper jam was a fatuous solution.'
  },
  proliferation: {
    ipa: '/prəˌlɪfəˈreɪʃən/',
    pos: 'n.',
    zh: '快速增加、擴散、增生',
    en: 'rapid increase or spread',
    academic_example: 'The proliferation of low-cost sensors has changed environmental monitoring.',
    life_example: 'There has been a proliferation of unread tabs on my browser.'
  },
  proclivity: {
    ipa: '/proʊˈklɪvəti/',
    pos: 'n.',
    zh: '傾向、癖好、容易做某事的習性',
    en: 'a natural tendency or inclination',
    academic_example: 'The study examined whether early exposure predicted a proclivity toward risk-taking.',
    life_example: 'He has a proclivity for joining projects right before they become complicated.'
  },
  disinterested: {
    ipa: '/dɪsˈɪntrəstɪd/',
    pos: 'adj.',
    zh: '公正無私的、不受個人利益影響的',
    en: 'impartial and not influenced by personal advantage',
    academic_example: 'The ethics board sought a disinterested reviewer with no ties to the sponsor.',
    life_example: 'Ask someone disinterested to judge the contest, not your roommate.'
  },
  diffuse: {
    ipa: '/dɪˈfjuːs/',
    pos: 'adj.',
    zh: '分散的、不集中的；冗長散漫的',
    en: 'spread out or lacking focus',
    academic_example: 'The essay\'s diffuse structure weakens an otherwise promising argument.',
    life_example: 'The light was diffuse enough that the photo looked soft instead of harsh.'
  },
  abstriction: {
    ipa: '/æbˈstrɪkʃən/',
    pos: 'n.',
    zh: '以收縮或縊縮方式分離、脫落',
    en: 'separation by constriction, especially in biological contexts',
    academic_example: 'Abstriction describes the pinching-off process by which certain fungal spores separate.',
    life_example: 'This is a technical word: think of abstriction as a tiny part being pinched off rather than sliced.'
  },
  ameliorate: {
    ipa: '/əˈmiːliəreɪt/',
    pos: 'v.',
    zh: '改善、緩和',
    en: 'to make a bad or difficult situation better',
    academic_example: 'The intervention was designed to ameliorate the effects of chronic stress.',
    life_example: 'A short walk helped ameliorate her headache.'
  },
  obfuscate: {
    ipa: '/ˈɑːbfəskeɪt/',
    pos: 'v.',
    zh: '使模糊、使難懂',
    en: 'to make something unclear or difficult to understand',
    academic_example: 'Excessive jargon can obfuscate the central claim of an argument.',
    life_example: 'The new instructions somehow obfuscate a very simple task.'
  },
  meticulous: {
    ipa: '/məˈtɪkjələs/',
    pos: 'adj.',
    zh: '一絲不苟的、極仔細的',
    en: 'showing great care and attention to detail',
    academic_example: 'The archive was catalogued through a meticulous review process.',
    life_example: 'He is meticulous about labeling every cable.'
  },
  sententious: {
    ipa: '/senˈtenʃəs/',
    pos: 'adj.',
    zh: '愛說教的、格言式但顯得自大的',
    en: 'given to moralizing in a pompous or overly solemn way',
    academic_example: 'The reviewer criticized the conclusion as sententious rather than analytically precise.',
    life_example: 'His sententious advice made the room go quiet.'
  }
};

const PREFIX_ZH = {
  abstract: '抽象、理論或概念分析相關',
  social: '社會、政治或文化討論相關',
  research: '研究、論證或正式寫作相關',
  literary: '文學、修辭或風格描述相關',
  ethical: '價值、規範或判斷相關',
};

function uniq(words) {
  const seen = new Set();
  return words.map(w => w.toLowerCase()).filter(w => /^[a-z]+$/.test(w) && !seen.has(w) && seen.add(w));
}

function fallbackWords(needed, existing) {
  const files = [
    path.join(ROOT, 'enable1.txt'),
    '/usr/share/dict/web2',
  ];
  const candidates = [];
  const suffix = /(tion|sion|ence|ance|ity|ism|ist|ous|ive|ate|ary|al|ent|ant|ic|ical|able|ible|ory|ment|graphy|ology)$/;
  const bad = /(ness|less|lessly|edly|ingly|ship|woman|women|man|men|ette|ling|ward|wards)$/;
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const w = line.trim().toLowerCase();
      if (!/^[a-z]{7,15}$/.test(w)) continue;
      if (w.startsWith('#') || existing.has(w)) continue;
      if (!suffix.test(w) || bad.test(w)) continue;
      if (/(aa|ii|uu|yy|zzzz)/.test(w)) continue;
      candidates.push(w);
    }
  }
  const ordered = uniq(candidates).sort((a, b) => {
    const score = w => (w.length >= 9 ? 2 : 0) + (/(tion|sion|ity|ism|ology|graphy)$/.test(w) ? 2 : 0) - (w.length > 13 ? 1 : 0);
    return score(b) - score(a) || a.localeCompare(b);
  });
  return ordered.slice(0, needed);
}

function guessPos(word) {
  if (/(ous|ive|al|ary|ic|ical|able|ible|ent|ant|ory)$/.test(word)) return 'adj.';
  if (/(ate|ify|ise|ize)$/.test(word)) return 'v.';
  return 'n.';
}

function topicFor(word) {
  if (/(ism|ist|ology|graphy|cracy|soci|polit|juris|ethic)/.test(word)) return PREFIX_ZH.social;
  if (/(rhetoric|allegor|simile|semantic|semiotic|epigram|soliloquy)/.test(word)) return PREFIX_ZH.literary;
  if (/(probity|sanct|rectitude|culp|penitent|malfeasance)/.test(word)) return PREFIX_ZH.ethical;
  if (/(analysis|synthesis|empir|heuristic|method|inference|correl|typology)/.test(word)) return PREFIX_ZH.research;
  return PREFIX_ZH.abstract;
}

function roughIpa(word) {
  const chunks = [
    ['tion', 'ʃən'], ['sion', 'ʒən'], ['cious', 'ʃəs'], ['tious', 'ʃəs'],
    ['ph', 'f'], ['qu', 'kw'], ['ch', 'tʃ'], ['sh', 'ʃ'], ['th', 'θ'],
    ['ee', 'iː'], ['oo', 'uː'], ['ou', 'aʊ'], ['ai', 'eɪ'], ['ay', 'eɪ'],
    ['ea', 'iː'], ['ie', 'iː'], ['io', 'iə'], ['oa', 'oʊ'],
  ];
  let out = word.toLowerCase();
  for (const [from, to] of chunks) out = out.replaceAll(from, to);
  out = out
    .replace(/a/g, 'æ').replace(/e/g, 'ɛ').replace(/i/g, 'ɪ').replace(/o/g, 'ɑ').replace(/u/g, 'ʌ')
    .replace(/y$/g, 'i').replace(/c(?=[eɪi])/g, 's').replace(/c/g, 'k')
    .replace(/g(?=[eɪi])/g, 'dʒ').replace(/x/g, 'ks');
  return '/' + out + '/';
}

function entry(word) {
  if (MANUAL[word]) return { word, ...MANUAL[word] };
  const pos = guessPos(word);
  const topic = topicFor(word);
  return {
    word,
    ipa: roughIpa(word),
    pos,
    zh: `${topic}的 C2 進階詞彙`,
    en: `A C2-level word used for precise expression in formal, academic, or literary contexts.`,
    academic_example: `The article uses "${word}" to frame a nuanced point in the wider argument.`,
    life_example: `I wrote "${word}" in my notebook after hearing it in a serious discussion.`,
  };
}

function isTemplateItem(item) {
  return item.zh === `${topicFor(item.word)}的 C2 進階詞彙`
    && item.en === 'A C2-level word used for precise expression in formal, academic, or literary contexts.'
    && item.academic_example === `The article uses "${item.word}" to frame a nuanced point in the wider argument.`
    && item.life_example === `I wrote "${item.word}" in my notebook after hearing it in a serious discussion.`;
}

function localDateRange(start, end) {
  const dates = [];
  const current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function wotdHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function assertQualityWindow(data) {
  const failures = localDateRange(QUALITY_WINDOW_START, QUALITY_WINDOW_END)
    .map(date => ({ date, item: data[wotdHash(date) % data.length] }))
    .filter(({ item }) => isTemplateItem(item));
  if (!failures.length) return;
  const lines = failures.map(({ date, item }) => `${date}: ${item.word}`).join('\n');
  throw new Error(`Template daily-word entries are blocked for ${QUALITY_WINDOW_START} to ${QUALITY_WINDOW_END}:\n${lines}`);
}

function todoMarkdown(data) {
  const remaining = data.filter(isTemplateItem);
  const byPos = remaining.reduce((acc, item) => {
    acc[item.pos] = (acc[item.pos] || 0) + 1;
    return acc;
  }, {});
  const lines = [
    '# Daily Words Template Cleanup TODO',
    '',
    'This file is generated by `tools/generate-daily-words.js`.',
    'Each unchecked item still uses the generic C2/template definition and placeholder examples.',
    '',
    `Remaining template entries: ${remaining.length}`,
    `By part of speech: ${Object.entries(byPos).map(([pos, count]) => `${pos} ${count}`).join(', ') || 'none'}`,
    '',
  ];
  if (!remaining.length) {
    lines.push('No remaining template entries.');
    return lines.join('\n') + '\n';
  }
  lines.push('## Remaining Entries', '');
  for (const item of remaining) {
    lines.push(`- [ ] ${item.word} (${item.pos})`);
  }
  return lines.join('\n') + '\n';
}

const selected = uniq(CURATED);
const existing = new Set(selected);
for (const w of fallbackWords(TARGET_COUNT - selected.length, existing)) {
  selected.push(w);
  existing.add(w);
}

if (selected.length < TARGET_COUNT) {
  throw new Error(`Only ${selected.length} daily words available; expected ${TARGET_COUNT}.`);
}

const data = selected.slice(0, TARGET_COUNT).map(entry);
const words = new Set(data.map(d => d.word));
if (data.length !== TARGET_COUNT || words.size !== TARGET_COUNT) {
  throw new Error(`daily word uniqueness check failed: ${data.length} rows, ${words.size} unique words`);
}
for (const item of data) {
  for (const field of ['word', 'ipa', 'pos', 'zh', 'en', 'academic_example', 'life_example']) {
    if (!item[field] || typeof item[field] !== 'string') throw new Error(`Missing ${field} for ${item.word}`);
  }
}
assertQualityWindow(data);

fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
fs.writeFileSync(TODO_OUT, todoMarkdown(data));
console.log(`Wrote ${data.length} words to ${path.relative(ROOT, OUT)}`);
console.log(`Wrote template cleanup TODO to ${path.relative(ROOT, TODO_OUT)}`);
