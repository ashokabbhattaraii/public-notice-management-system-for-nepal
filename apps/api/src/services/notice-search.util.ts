/**
 * Keyword-retrieval helpers for the notice chatbot.
 *
 * The previous implementation matched the *entire question string* as a
 * substring (`title contains "What exams are coming up?"`), which can only
 * ever match a notice whose title literally contains the question — i.e.
 * never. That silently emptied the keyword leg of the hybrid search and left
 * every answer dependent on the vector fallback. These helpers tokenize the
 * question instead and rank candidates by where and how often the content
 * words hit.
 */

/**
 * Words carrying no retrieval signal. Includes English function words plus the
 * romanized-Nepali and Devanagari particles that show up constantly in this
 * portal's traffic ("ko", "ma", "cha", "के", "छ"). Leaving them in makes every
 * notice a candidate, since they appear in nearly all Nepali text.
 */
const STOPWORDS = new Set([
  // English
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'do', 'does', 'did', 'doing', 'have', 'has', 'had', 'having', 'can', 'could',
  'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'of', 'in', 'on',
  'at', 'to', 'for', 'with', 'about', 'from', 'by', 'as', 'into', 'and', 'or',
  'but', 'if', 'then', 'than', 'so', 'that', 'this', 'these', 'those', 'there',
  'here', 'it', 'its', 'i', 'me', 'my', 'you', 'your', 'we', 'our', 'they',
  'them', 'their', 'he', 'she', 'his', 'her', 'what', 'which', 'who', 'whom',
  'whose', 'when', 'where', 'why', 'how', 'any', 'some', 'all', 'each', 'every',
  'more', 'most', 'other', 'such', 'no', 'not', 'only', 'own', 'same', 'up',
  'out', 'down', 'over', 'under', 'again', 'also', 'just', 'now', 'get', 'got',
  'tell', 'show', 'give', 'please', 'want', 'need', 'know', 'find', 'list',
  // Romanized Nepali
  'ko', 'ka', 'ki', 'le', 'lai', 'ma', 'cha', 'chha', 'xa', 'ho', 'hun',
  'huncha', 'garne', 'garnu', 'bhaneko', 'kun', 'kati', 'kaha', 'kahile',
  'kasari', 'kasto', 'yo', 'tyo', 'ani', 'ra', 'pani', 'timi', 'malai',
  // Devanagari
  'को', 'का', 'की', 'ले', 'लाई', 'मा', 'छ', 'हो', 'हुन्', 'र', 'पनि', 'के',
  'कति', 'कहाँ', 'कहिले', 'कसरी', 'कस्तो', 'यो', 'त्यो', 'गर्ने', 'भएको',
]);

/**
 * Characters that are never part of a search token.
 *
 * \p{M} (combining marks) is essential: Devanagari vowel signs are marks, not
 * letters, so a class of letters-and-digits alone strips them and turns
 * "सूचनाहरूमा" into the meaningless fragment "चनहर".
 */
const PUNCT_RE = /[^\p{L}\p{M}\p{N}\s-]/gu;

const DEVANAGARI_RE = /[ऀ-ॿ]/;

/**
 * Common Nepali postpositions and plural markers, longest first.
 *
 * Nepali agglutinates: "सूचनाहरूमा" is सूचना + हरू + मा ("in the notices").
 * Matching that whole form as a substring finds nothing, because documents
 * write "सूचना". Indexing the stem alongside the full token restores the
 * match. This is deliberately shallow — a real stemmer is overkill for a
 * substring-match retrieval leg that a reranker reorders anyway.
 */
const NEPALI_SUFFIXES = [
  'हरूलाई', 'हरूको', 'हरूमा', 'हरूले', 'हरूबाट', 'हरू',
  'बाट', 'लाई', 'सँग', 'माथि', 'मा', 'को', 'का', 'की', 'ले',
];

/** Strip one trailing postposition, if doing so leaves a usable stem. */
function nepaliStem(token: string): string | null {
  for (const suffix of NEPALI_SUFFIXES) {
    if (token.length > suffix.length + 1 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  return null;
}

export interface QueryTokens {
  /** Content words used for matching. */
  tokens: string[];
  /** Quoted phrases, matched verbatim and weighted higher. */
  phrases: string[];
}

/**
 * Split a natural-language question into content tokens plus any quoted
 * phrases. Quoted text is preserved intact so `"lok sewa aayog"` matches as a
 * unit rather than as three common words.
 */
export function tokenizeQuestion(question: string): QueryTokens {
  const phrases: string[] = [];
  const withoutPhrases = question.replace(/"([^"]{2,})"/g, (_match, phrase: string) => {
    phrases.push(phrase.trim().toLowerCase());
    return ' ';
  });

  const seen = new Set<string>();
  const tokens: string[] = [];

  const add = (token: string) => {
    if (!token || STOPWORDS.has(token) || seen.has(token)) return;
    seen.add(token);
    tokens.push(token);
  };

  for (const raw of withoutPhrases.toLowerCase().replace(PUNCT_RE, ' ').split(/\s+/)) {
    const token = raw.replace(/^-+|-+$/g, '');
    const isDevanagari = DEVANAGARI_RE.test(token);
    // Devanagari words carry meaning at 2 characters; latin ones rarely do.
    if (token.length < (isDevanagari ? 2 : 3)) continue;

    add(token);
    // Only stem content words: stemming a stopword ("कहिले" -> "कहि") would
    // reintroduce as a fragment the very term the stoplist just removed.
    if (isDevanagari && !STOPWORDS.has(token)) {
      const stem = nepaliStem(token);
      if (stem && stem.length >= 2) add(stem);
    }
  }

  return { tokens, phrases };
}

export interface ScorableNotice {
  title: string;
  aiSummary?: string | null;
  summary?: string | null;
  contentText?: string | null;
  publishedAt?: Date | null;
}

/**
 * Field weights reflect signal density: a token in the title is a far stronger
 * relevance signal than the same token buried in a multi-page body.
 */
const FIELD_WEIGHTS = { title: 3.0, summary: 1.8, content: 1.0 } as const;
const PHRASE_BONUS = 4.0;
/** Cap on how much freshness alone can lift an otherwise weak match. */
const RECENCY_WEIGHT = 1.5;
const RECENCY_HALF_LIFE_DAYS = 45;

/**
 * Lexical relevance score for one candidate. Coverage (what fraction of the
 * question's content words appear at all) dominates raw frequency, so a notice
 * mentioning every term once outranks one repeating a single term ten times.
 */
export function scoreNotice(
  notice: ScorableNotice,
  { tokens, phrases }: QueryTokens,
  now: Date = new Date(),
): number {
  const title = notice.title.toLowerCase();
  const summary = `${notice.aiSummary ?? ''} ${notice.summary ?? ''}`.toLowerCase();
  const content = (notice.contentText ?? '').toLowerCase();

  let score = 0;
  let matchedTokens = 0;

  for (const token of tokens) {
    let tokenScore = 0;
    if (title.includes(token)) tokenScore += FIELD_WEIGHTS.title;
    if (summary.includes(token)) tokenScore += FIELD_WEIGHTS.summary;
    if (content.includes(token)) tokenScore += FIELD_WEIGHTS.content;
    if (tokenScore > 0) matchedTokens += 1;
    score += tokenScore;
  }

  for (const phrase of phrases) {
    if (title.includes(phrase)) score += PHRASE_BONUS * FIELD_WEIGHTS.title;
    else if (summary.includes(phrase)) score += PHRASE_BONUS * FIELD_WEIGHTS.summary;
    else if (content.includes(phrase)) score += PHRASE_BONUS * FIELD_WEIGHTS.content;
  }

  // Coverage multiplier: matching 3/3 terms is worth much more than 3 hits on
  // 1/3 terms, which raw additive scoring would rate identically. Phrase-only
  // queries have no tokens to cover, so they keep their full score.
  if (tokens.length > 0) {
    score *= 0.5 + 0.5 * (matchedTokens / tokens.length);
  }

  if (score > 0 && notice.publishedAt) {
    const ageDays = (now.getTime() - notice.publishedAt.getTime()) / 86_400_000;
    if (ageDays >= 0) {
      score += RECENCY_WEIGHT * Math.exp(-ageDays / RECENCY_HALF_LIFE_DAYS);
    }
  }

  return score;
}

/**
 * Pull the most query-relevant window out of a notice body.
 *
 * Notice bodies routinely run to thousands of characters; sending them whole
 * would blow the context budget and bury the answer. Sending only `aiSummary`
 * (the previous behaviour) loses exactly the specifics users ask about —
 * deadlines, fees, eligibility. This returns the densest matching window.
 */
export function buildExcerpt(
  text: string | null | undefined,
  { tokens, phrases }: QueryTokens,
  maxChars = 1200,
): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;

  const haystack = clean.toLowerCase();
  const needles = [...phrases, ...tokens];

  // Score each candidate window by how many distinct terms fall inside it.
  const step = Math.max(200, Math.floor(maxChars / 4));
  let bestStart = 0;
  let bestHits = -1;

  for (let start = 0; start < clean.length; start += step) {
    const window = haystack.slice(start, start + maxChars);
    let hits = 0;
    for (const needle of needles) {
      if (window.includes(needle)) hits += 1;
    }
    if (hits > bestHits) {
      bestHits = hits;
      bestStart = start;
    }
  }

  // No term appears anywhere — the opening of a notice is the most
  // informative default (it carries the subject line and issuing office).
  if (bestHits <= 0) return `${clean.slice(0, maxChars)}…`;

  // Snap to a word boundary so the excerpt doesn't start mid-word.
  let start = bestStart;
  if (start > 0) {
    const space = clean.indexOf(' ', start);
    if (space !== -1 && space - start < 40) start = space + 1;
  }

  const excerpt = clean.slice(start, start + maxChars);
  return `${start > 0 ? '…' : ''}${excerpt}${start + maxChars < clean.length ? '…' : ''}`;
}
