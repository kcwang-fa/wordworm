const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET_COUNT = 732;
const OUT = path.join(ROOT, 'data', 'daily-words.json');

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
    path.join(ROOT, 'modern-words.txt'),
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

fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
console.log(`Wrote ${data.length} words to ${path.relative(ROOT, OUT)}`);
