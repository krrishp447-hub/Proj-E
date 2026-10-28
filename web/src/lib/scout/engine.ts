import { NICHES, type Creator, type Platform } from "./data.ts";
import { canon, contentWords, editDistance, idfOf, stem, topicMatch } from "./topics.ts";

export type Brief = {
  text: string; // as typed (typo fixes re-parse it)
  corrected?: [string, string][]; // "did you mean": [typed, read as] (set by contextualize)
  niches: string[]; // any of these (empty = any niche)
  excludeNiches: string[];
  platform?: Platform;
  platformMissing?: Platform; // asked for a platform ScoutBlack doesn't track yet (set by contextualize)
  country?: string;
  languages: string[]; // any of these
  excludeLanguages: string[];
  terms: string[]; // content words matched against what creators actually publish (stemmed)
  excludeTerms: string[];
  minSubs?: number;
  maxSubs?: number;
  tier?: string; // "micro" etc., when size came from a tier word
  minViews?: number;
  minEng?: number; // explicit "engagement above 5%"
  wantEng?: boolean;
  wantGrowth?: boolean;
  safeOnly?: boolean; // "brand safe", "family friendly": flagged channels don't fit
  likeName?: string; // "creators like X"
  // set from the data by contextualize():
  engBar?: number; // "strong engagement" = the niche median
  like?: Creator;
  idf?: Map<string, number>;
};

// Sub-niche vocabulary for creator tags (metrics.ts) — briefs now match any content word via `terms`.
export const KEYWORDS = ["tws", "earbud", "audio", "anc", "headphone", "smartphone", "gaming", "recipe", "investing", "fashion", "coding", "programming", "travel", "fitness", "budget", "premium"];

export const SYNONYMS: Record<string, string[]> = {
  // Matched at word starts ("earbud" finds "earbuds"), so avoid short stems: "car" would hit "career", "mom" "moment",
  // "rap" "rapid", "art" "article". Words shared by two genres go to neither, or to the one they nearly always mean.
  Tech: ["gadget", "earbud", "tws", "smartphone", "phone", "mobile", "audio", "headphone", "earphone", "anc", "speaker", "laptop", "camera", "smartwatch", "unboxing", "android", "iphone", "processor", "technology", "technical"],
  Gaming: ["gamer", "esports", "bgmi", "pubg", "free fire", "freefire", "valorant", "minecraft", "gta", "gameplay", "walkthrough",
    "roblox", "fortnite", "call of duty", "codm", "clash of clans", "clash royale", "brawl stars", "among us", "garena", "mobile legends",
    "genshin", "apex legends", "stumble guys", "subway surfers", "noob", "headshot", "speedrun", "playstation", "ps5", "xbox", "nintendo", "lets play", "let's play"],
  // music-release phrases ("Official Audio", "Lyrical Video") are folded into "music" by classify()
  Music: ["song", "lyric", "rapper", "rap song", "hip hop", "hiphop", "album", "singer", "singing", "remix", "music video", "cover song", "beatbox", "ghazal", "qawwali"],
  Entertainment: ["comedy", "funny", "prank", "roast", "sketch", "movie review", "bollywood", "web series", "standup", "stand-up", "reaction",
    "vines", "trailer", "short film", "skit", "web show", "sitcom"],
  Food: ["cook", "recipe", "chef", "kitchen", "street food", "baking", "food vlog", "khana", "foodie"],
  Education: ["upsc", "neet", "jee", "exam", "study", "lecture", "tutorial", "coaching", "ssc", "class 10", "class 12", "syllabus", "motivational", "educational"],
  Finance: ["money", "invest", "stock", "personal finance", "trading", "mutual fund", "crypto", "sensex", "nifty", "income tax", "financial",
    "trader", "loan", "insurance", "share market", "credit card"],
  Fitness: ["gym", "workout", "nutrition", "yoga", "bodybuilding", "weight loss", "fat loss", "diet plan"],
  Beauty: ["makeup", "skincare", "skin care", "hair care", "lipstick", "grwm", "nail art"],
  Fashion: ["style", "outfit", "haul", "ethnic wear", "lookbook", "saree", "kurti"],
  Travel: ["trip", "tourism", "travel vlog", "itinerary", "trek", "travell"],
  Automotive: ["automobile", "car review", "cars", "bike review", "motorcycle", "superbike", "scooter", "test drive", "royal enfield", "sports bike", "sport bike", "bike ride", "motovlog", "moto vlog"],
  // children's content (rhymes, cartoons) is Kids; content *for parents* is Parenting
  Kids: ["nursery rhyme", "rhymes", "kids song", "cartoon", "for kids", "children", "baby song", "bedtime stor", "moral stor", "kids stor", "toys"],
  Parenting: ["parenting", "mommy", "newborn", "toddler", "pregnancy", "baby", "baby care", "mom vlog", "mom life", "motherhood", "breastfeed"],
  Sports: ["cricket", "ipl", "football", "fifa", "kabaddi", "badminton", "tennis", "wwe", "match highlights", "sport"],
  News: ["breaking", "headlines", "politic", "election", "debate", "current affairs", "news analysis"],
  // no deity names (also people's names: "Shivam", "Krishna Kakran" are comedians), no "temple" (travel vlogs visit them)
  Spiritual: ["bhajan", "aarti", "mantra", "devotional", "katha", "bhakti", "chalisa", "mahadev", "gurbani", "kirtan", "prayer", "satsang", "pravachan", "spirituality", "stotram", "stotra"],
  Lifestyle: ["daily vlog", "family vlog", "day in my life", "home tour", "minimalism", "routine vlog"],
};

export const LANGUAGES = ["Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Kannada", "Malayalam", "Gujarati", "Punjabi", "English"];
const LANG_ALIASES: Record<string, string[]> = { Bengali: ["bangla"], Hindi: ["hinglish"] };
const LANG_GROUPS: [RegExp, string[]][] = [[/\bsouth ?indian?\b/, ["Tamil", "Telugu", "Kannada", "Malayalam"]]];

/** Indian creator-economy tiers, used when a brief names a tier instead of numbers. */
const TIERS: [RegExp, string, number, number][] = [
  [/\bnano\b/, "nano", 1_000, 10_000],
  [/\bmicro\b/, "micro", 10_000, 100_000],
  [/\bmacro\b|\bmid[- ]?tier\b/, "macro", 100_000, 1_000_000],
  [/\bmega\b|\bcelebrit/, "mega", 1_000_000, Infinity],
];

/** Words that steer filters, not content: kept out of `terms`. */
const FILTER_WORDS = new Set(["youtube", "insta", "instagram", "reel", "india", "america", "american", "nano", "micro", "macro", "mega", "tier",
  "mid", "celebrity", "south", "north", "find", "looking", "want", "need", "show", "list", "brand", "campaign", "rate", "avg", "average", "above",
  "below", "least", "less", "per", "hinglish", "bangla", ...NICHES.map((n) => stem(n.toLowerCase()))]);

// Briefs in Indian scripts and Hinglish: common words → the English words the rest of the parser knows. Other words
// stay as they are (Indian-script words still match titles in that script). " " drops a filler word.
const WORDS = new Map(Object.entries({
  // Hindi / Marathi (Devanagari)
  टेक: "tech", टेक्नोलॉजी: "technology", रिव्यू: "review", रिव्यु: "review", अनबॉक्सिंग: "unboxing", मोबाइल: "mobile", फोन: "phone", फ़ोन: "phone",
  लैपटॉप: "laptop", कैमरा: "camera", ईयरबड्स: "earbuds", गेमिंग: "gaming", गेम: "game", खाना: "food", रेसिपी: "recipe", कुकिंग: "cooking",
  क्रिकेट: "cricket", खेल: "sports", भजन: "bhajan", भक्ति: "bhakti", कॉमेडी: "comedy", फिटनेस: "fitness", जिम: "gym", योग: "yoga",
  पैसा: "money", पैसे: "money", बचत: "money", निवेश: "invest", शेयर: "share", बाजार: "market", बाज़ार: "market", पढ़ाई: "study", ब्यूटी: "beauty",
  मेकअप: "makeup", स्किनकेयर: "skincare", ट्यूटोरियल: "tutorial", फैशन: "fashion", यात्रा: "travel", ट्रैवल: "travel", बाइक: "bike",
  गाना: "song", गाने: "songs", गीत: "songs", संगीत: "music", म्यूजिक: "music", समाचार: "news", न्यूज़: "news", न्यूज: "news", कहानी: "kids stories",
  कहानियां: "kids stories", बच्चों: "kids", बच्चे: "kids", सस्ता: "budget", सस्ते: "budget", सस्ती: "budget", हिंदी: "hindi", हिन्दी: "hindi",
  मराठी: "marathi", पंजाबी: "punjabi", जेवण: "food", स्वयंपाक: "cooking", पाककृती: "recipe", गाणी: "songs", बातम्या: "news", प्रवास: "travel",
  क्रिएटर: "creator", क्रिएटर्स: "creators", यूट्यूबर: "youtuber", और: "and", में: "in", के: " ", की: " ", का: " ", लिए: " ", वाले: " ",
  // Tamil
  விமர்சனம்: "review", சமையல்: "cooking", உணவு: "food", பாடல்: "songs", பாடல்கள்: "songs", குழந்தை: "kids", குழந்தைகள்: "kids",
  தொழில்நுட்பம்: "technology", கேமிங்: "gaming", பயணம்: "travel", அழகு: "beauty", உடற்பயிற்சி: "workout", கிரிக்கெட்: "cricket",
  செய்தி: "news", செய்திகள்: "news", பக்தி: "bhakti", தமிழ்: "tamil", மொபைல்: "mobile",
  // Telugu
  రివ్యూ: "review", వంట: "cooking", వంటలు: "recipe", ఆహారం: "food", పాట: "songs", పాటలు: "songs", పిల్లల: "kids", పిల్లలు: "kids", టెక్: "tech",
  గేమింగ్: "gaming", ప్రయాణం: "travel", అందం: "beauty", వార్తలు: "news", భక్తి: "bhakti", తెలుగు: "telugu", మొబైల్: "mobile", క్రికెట్: "cricket",
  రుచికరమైన: " ",
  // Bengali
  রান্না: "cooking", খাবার: "food", গান: "songs", শিশু: "kids", বাচ্চাদের: "kids", খবর: "news", ভ্রমণ: "travel", রূপচর্চা: "beauty",
  প্রযুক্তি: "technology", রিভিউ: "review", বাংলা: "bangla", ক্রিকেট: "cricket", ভক্তি: "bhakti",
  // Kannada, Malayalam, Gujarati, Punjabi
  ಅಡುಗೆ: "cooking", ಹಾಡು: "songs", ಹಾಡುಗಳು: "songs", ಸುದ್ದಿ: "news", ಪ್ರವಾಸ: "travel", ಕನ್ನಡ: "kannada", ರಿವ್ಯೂ: "review",
  പാചകം: "cooking", പാട്ട്: "songs", പാട്ടുകൾ: "songs", വാർത്ത: "news", യാത്ര: "travel", മലയാളം: "malayalam", റിവ്യൂ: "review",
  રસોઈ: "cooking", ગીતો: "songs", સમાચાર: "news", ગુજરાતી: "gujarati", ਗੀਤ: "songs", ਪੰਜਾਬੀ: "punjabi",
  // Hinglish intents
  paisa: "money", paise: "money", bachat: "money", bachaye: "save", bachana: "save", kamai: "earn money", kamaye: "earn money",
  gaana: "song", gaane: "songs", gana: "song", gane: "songs", geet: "songs", khane: "food", rasoi: "kitchen", padhai: "study",
  kasrat: "workout", vyayam: "workout", bachon: "kids", bacchon: "kids", kahani: "kids stories", kahaniyan: "kids stories",
  sunao: " ", dikhao: " ", batao: " ", chahiye: " ", accha: " ", achha: " ", sabse: " ", wale: " ", vale: " ",
}));

// Words a typo can be corrected to without data: niche names, their single-word synonyms, languages.
const STATIC_VOCAB = [...NICHES, ...LANGUAGES].map((w) => w.toLowerCase()).concat(Object.values(SYNONYMS).flat().filter((w) => !w.includes(" ")));

/** Brief words no creator uses, within 1–2 edits of a word they do ("ernbuds" → earbud, "fitnes" → fitness). */
function typoFixes(text: string, idf: Map<string, number>, n: number): [string, string][] {
  const common = Math.log(1 + n / 3); // only correct to words at least 3 creators use
  const fixes: [string, string][] = [];
  for (const w of new Set(text.toLowerCase().match(/[a-z]{5,}/g) ?? [])) {
    const [term] = contentWords(w);
    if (!term || WORDS.has(w) || FILTER_WORDS.has(term) || idf.has(term) || STATIC_VOCAB.includes(term)) continue;
    const max = w.length >= 6 ? 2 : 1;
    let best: [string, number, number] | undefined; // word, distance, idf (static words count as most common)
    const consider = (v: string, weight: number) => {
      const d = Math.min(editDistance(term, v, max), editDistance(w, v, max)); // stemmed or as typed ("fitnes" stems to "fitne")
      if (d <= max && (!best || d < best[1] || (d === best[1] && weight < best[2]))) best = [v, d, weight];
    };
    for (const v of STATIC_VOCAB) consider(v, 0);
    for (const [v, weight] of idf) if (weight <= common && v.length >= 4) consider(v, weight);
    if (best) fixes.push([w, best[0]]);
  }
  return fixes;
}

const amount = (n: string, unit = "") => Number(n) * (unit === "m" ? 1e6 : unit === "k" ? 1e3 : 1);
const nicheRe = (n: string) => new RegExp(`\\b(${[n.toLowerCase(), ...(SYNONYMS[n] ?? [])].join("|")})`);
const langOf = (w: string) => LANGUAGES.find((l) => [l.toLowerCase(), ...(LANG_ALIASES[l] ?? [])].includes(w));

/** Plain-English brief → structured filters. Transparent rules, not ML; every step shows up in describe(). */
export function parseBrief(typed: string): Brief {
  const text = typed.normalize("NFC").replace(/[\p{L}\p{M}]+/gu, (w) => WORDS.get(w.toLowerCase()) ?? w);
  let t = ` ${text.toLowerCase()} `;
  const b: Brief = { text: typed, niches: [], excludeNiches: [], languages: [], excludeLanguages: [], terms: [], excludeTerms: [] };
  const take = (re: RegExp, f: (m: RegExpMatchArray) => void) => { const m = t.match(re); if (m) { f(m); t = t.replace(m[0], " "); } };

  // 1. Numbers that aren't subscriber counts come out first, so "100k views" isn't read as 100K subs.
  take(/(\d+(?:\.\d+)?)\s*([km])?\s*\+?\s*(?:avg\.?|average)?\s*views?\b/, (m) => (b.minViews = amount(m[1], m[2])));
  take(/\bviews?\s*(?:above|over|more than|>|at least|of)\s*(\d+(?:\.\d+)?)\s*([km])?/, (m) => (b.minViews = amount(m[1], m[2])));
  take(/\b(?:engagement|eng)(?:\s*rate)?\s*(?:above|over|more than|>=?|at least|of)?\s*(\d+(?:\.\d+)?)\s*%/, (m) => (b.minEng = Number(m[1])));
  take(/(\d+(?:\.\d+)?)\s*%\s*\+?\s*(?:engagement|eng)\b/, (m) => (b.minEng = Number(m[1])));
  // 2. "like / similar to <creator>" — the name runs to a comma or a connecting word
  const like = text.match(/\b(?:like|similar to)\s+(.+?)(?=$|[,.;]|\s+(?:but|with|in|for|under|over|who|and|or|on|from)\b)/i);
  if (like) { b.likeName = like[1].trim(); t = t.replace(like[0].toLowerCase(), " "); }
  // 3. Exclusions: "not gaming", "no hindi", "except finance", "without pranks"
  for (const m of t.matchAll(/\b(?:not|no|except|excluding|without)\s+([a-z][\w-]*(?:\s+care)?)/g)) {
    const w = m[1];
    // "not gaming" (a niche's own name) drops the niche; "not bgmi" (one of its keywords) drops that topic only:
    // excluding the whole Gaming niche for "gaming creators but not bgmi" returned everything except gamers
    const niche = NICHES.find((n) => n.toLowerCase() === w);
    const lang = langOf(w);
    if (niche) b.excludeNiches.push(niche);
    else if (lang) b.excludeLanguages.push(lang);
    else b.excludeTerms.push(...contentWords(w));
    t = t.replace(m[0], " ");
  }

  // 4. Niches: named niches win ("travel vloggers with camera gear" is Travel, not Tech);
  //    otherwise the niche whose synonyms appear most ("earbuds and anc" → Tech).
  b.niches = NICHES.filter((n) => new RegExp(`\\b${n.toLowerCase()}\\b`).test(t) && !b.excludeNiches.includes(n));
  if (!b.niches.length) {
    const hits = NICHES.map((n) => ({ n, k: (t.match(new RegExp(nicheRe(n).source, "g")) ?? []).length })).filter((x) => x.k && !b.excludeNiches.includes(x.n));
    const top = Math.max(0, ...hits.map((x) => x.k));
    b.niches = hits.filter((x) => x.k === top).slice(0, 1).map((x) => x.n);
  }

  if (/youtube|\byt\b/.test(t)) b.platform = "YouTube";
  else if (/insta|\breels?\b|\big\b/.test(t)) b.platform = "Instagram";
  if (/\bindia(n)?\b/.test(t)) b.country = "India";
  else if (/\bus\b|\bu\.s\.|\bamerica(n)?\b/.test(t)) b.country = "US";

  // 5. Languages: names, aliases (Hinglish → Hindi) and groups (South Indian → 4 languages)
  for (const [re, langs] of LANG_GROUPS) if (re.test(t)) b.languages.push(...langs);
  for (const w of t.match(/[a-z]+/g) ?? []) { const l = langOf(w); if (l && !b.excludeLanguages.includes(l)) b.languages.push(l); }
  b.languages = [...new Set(b.languages)];

  // 6. Size: explicit numbers first, then tier words
  const range = t.match(/(\d+(?:\.\d+)?)\s*([km])?\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*([km])/);
  const under = t.match(/(?:under|below|less than|<)\s*(\d+(?:\.\d+)?)\s*([km])/);
  const over = t.match(/(?:over|above|more than|>)\s*(\d+(?:\.\d+)?)\s*([km])|(\d+(?:\.\d+)?)\s*([km])\s*\+/);
  if (range) [b.minSubs, b.maxSubs] = [amount(range[1], range[2] ?? range[4]), amount(range[3], range[4])];
  else if (under) [b.minSubs, b.maxSubs] = [0, amount(under[1], under[2])];
  else if (over) [b.minSubs, b.maxSubs] = [over[1] ? amount(over[1], over[2]) : amount(over[3], over[4]), Infinity];
  else for (const [re, name, lo, hi] of TIERS) if (re.test(t)) { [b.tier, b.minSubs, b.maxSubs] = [name, lo, hi]; break; }

  if (/strong engagement|high engagement|good engagement|engaged/.test(t)) b.wantEng = true;
  if (/growing|fast.?grow|rising|up.?and.?coming/.test(t)) b.wantGrowth = true;
  take(/\b(?:brand[- ]?safe|family[- ]?friendly|clean content|kid[- ]?safe)\b/, () => (b.safeOnly = true));

  // 7. Everything else that carries meaning is a content term: "msi", "bgmi", "skincare", "beginner"
  b.terms = [...new Set(contentWords(t.replace(/\d+(?:\.\d+)?\s*[km%]?/g, " ")))].filter((w) => !FILTER_WORDS.has(w) && !b.excludeTerms.includes(w));
  return b;
}

export const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".0", "")}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${n}`;

const idfCache = new WeakMap<Creator[], Map<string, number>>();

/**
 * Fill in what needs the data: topic rarity across all creators, the creator a "like X" brief refers to (and their
 * niche when the brief named none), and "strong engagement" as the niche's median (real YouTube engagement is ~2–5%).
 */
export function contextualize(b: Brief, creators: Creator[]): Brief {
  const out: Brief = { ...b };
  // a platform with no tracked creators would gate out everyone: say so and search what we have instead
  if (b.platform && creators.length && !creators.some((c) => c.platform === b.platform)) { out.platformMissing = b.platform; out.platform = undefined; }
  if (!idfCache.has(creators)) idfCache.set(creators, idfOf(creators.map(topicsOf)));
  out.idf = idfCache.get(creators)!;
  if (!b.corrected && creators.length) {
    const fixes = typoFixes(b.text, out.idf, creators.length).filter(([w]) => !b.likeName?.toLowerCase().includes(w)); // names aren't typos
    if (fixes.length) {
      const fixed = fixes.reduce((t, [w, to]) => t.replace(new RegExp(`\\b${w}\\b`, "gi"), to), b.text);
      return contextualize({ ...parseBrief(fixed), text: b.text, corrected: fixes }, creators);
    }
  }
  if (b.likeName) {
    const q = b.likeName.toLowerCase();
    out.like = creators.filter((c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase())).sort((x, y) => y.subs - x.subs)[0];
    if (out.like && !out.niches.length) out.niches = [out.like.niche];
  }
  if (b.wantEng) {
    const pool = creators.filter((c) => (!out.niches.length || out.niches.includes(c.niche)) && c.eng > 0).map((c) => c.eng).sort((x, y) => x - y);
    if (pool.length) out.engBar = Math.round(pool[Math.floor(pool.length / 2)] * 10) / 10;
  }
  return out;
}

/** A creator's content vocabulary: topics from their titles plus their sub-niche tags, in the brief's stemmed form. */
const topicsOf = (c: Creator) => [...(c.topics ?? []), ...c.tags.map((t) => stem(t.toLowerCase()))].map(canon);

/** Default audience floor when a brief doesn't specify size, and the view count at which engagement rates are trusted. */
export const MIN_AUDIENCE = 10_000;
export const RELIABLE_VIEWS = 5_000;

/** Nothing in the brief was recognised: no niche, language, size, creator, or topic any creator uses. */
export const understoodNothing = (b: Brief) =>
  !b.niches.length && !b.languages.length && !b.like && !b.country && b.minSubs === undefined && !b.minViews && !b.minEng && !b.excludeNiches.length &&
  !b.excludeLanguages.length && !b.terms.some((t) => b.idf?.has(t));

/** Human-readable chips for what the parser understood. */
export function describe(b: Brief): string[] {
  const out: string[] = [];
  for (const [w, to] of b.corrected ?? []) out.push(`“${w}” → ${to}`);
  if (b.like) out.push(`like ${b.like.name}`);
  else if (b.likeName) out.push(`like “${b.likeName}” (not found)`);
  if (b.niches.length) out.push(b.niches.join(" or "));
  if (b.platform) out.push(b.platform);
  if (b.platformMissing) out.push(`${b.platformMissing} not tracked yet`);
  if (b.country) out.push(b.country);
  if (b.terms.length) out.push(b.terms.join(", "));
  if (b.minSubs !== undefined && b.maxSubs !== undefined) {
    const size = b.maxSubs === Infinity ? `${fmt(b.minSubs)}+` : b.minSubs === 0 ? `under ${fmt(b.maxSubs)}` : `${fmt(b.minSubs)}–${fmt(b.maxSubs)}`;
    out.push(b.tier ? `${b.tier} (${size})` : size);
  }
  if (b.languages.length) out.push(b.languages.join(" / "));
  if (b.minViews) out.push(`avg views ≥ ${fmt(b.minViews)}`);
  if (b.minEng) out.push(`engagement ≥ ${b.minEng}%`);
  else if (b.wantEng) out.push(b.engBar ? `engagement ≥ ${b.engBar}%` : "high engagement");
  if (b.wantGrowth) out.push("fast-growing");
  if (b.safeOnly) out.push("brand-safe only");
  for (const x of [...b.excludeNiches, ...b.excludeLanguages, ...b.excludeTerms]) out.push(`not ${x}`);
  return out;
}

export type Signal = { label: string; points: number };
export type Match = { creator: Creator; score: number; signals: Signal[]; fits: boolean };

/** 0–1 likeness to a named creator: niche, language, size within 3×, shared topics. */
function similarity(a: Creator, b: Creator) {
  const ta = new Set(topicsOf(a)), tb = topicsOf(b);
  const shared = tb.filter((t) => ta.has(t)).length;
  const jaccard = shared / Math.max(1, new Set([...ta, ...tb]).size);
  const size = Math.max(0, 1 - Math.abs(Math.log10(Math.max(a.subs, 1) / Math.max(b.subs, 1))) / Math.log10(3));
  return 0.35 * Number(a.niche === b.niche) + 0.2 * Number(a.language === b.language) + 0.15 * size + 0.3 * Math.min(1, jaccard * 3);
}

/**
 * Absolute 0–100 match: points earned ÷ the most this brief could award.
 * (A weak query no longer makes its least-bad result look like a 99.)
 */
export function score(c: Creator, b: Brief): Match {
  const signals: Signal[] = [];
  let max = 0;
  const add = (label: string, points: number, possible: number) => {
    max += possible;
    if (Math.round(points) !== 0) signals.push({ label, points: Math.round(points) });
  };
  let fits = true;
  const gate = (ok: boolean, label: string, pts: number, miss: string, penalty: number) => {
    if (ok) add(label, pts, pts);
    else { add(miss, -penalty, pts); fits = false; }
  };
  const exclude = (hit: boolean, label: string) => { if (hit) { add(label, -25, 0); fits = false; } };

  if (b.niches.length) {
    // primary niche: full credit, scaled a little by how clearly it wins (segment.ts confidence; 0 = not computed yet)
    // secondary niche: still a fit, at about half credit ("also makes Tech")
    const conf = c.nicheConfidence || 1;
    if (b.niches.includes(c.niche)) add(`Niche · ${c.niche}${c.nicheConfidence ? ` (${Math.round(c.nicheConfidence * 100)}% sure)` : ""}`, 20 * (0.7 + 0.3 * conf), 20);
    else if (c.secondaryNiche && b.niches.includes(c.secondaryNiche)) add(`Also makes ${c.secondaryNiche} (main: ${c.niche})`, 11, 20);
    else { add("Different niche", -25, 20); fits = false; }
  }
  exclude(b.excludeNiches.includes(c.niche), `Excluded niche · ${c.niche}`);
  if (b.platform) gate(c.platform === b.platform, `Platform · ${c.platform}`, 10, "Different platform", 15);
  // Country: a third of channels never set one ("Unknown"). That's missing data, not a mismatch: it never fails the
  // brief, and an Indian-language channel is very likely Indian. ScoutBlack is for the Indian market: a brief that names
  // no country means India, so channels from elsewhere are near misses ("Outside India") rather than competing on points
  // (a points bonus let generic Indian channels outrank the foreign MSI reviewer a brief actually described).
  const likelyIndian = c.country === "Unknown" && c.language !== "English";
  const market = b.country ?? "India";
  if (c.country === market) { if (b.country) add(`Audience · ${c.country}`, 10, 10); }
  else if (c.country === "Unknown") { if (b.country) add(market === "India" && likelyIndian ? `Audience · likely India (${c.language})` : "Country not set", market === "India" && likelyIndian ? 8 : 3, 10); }
  else if (b.country) { add("Different geography", -15, 10); fits = false; }
  else { add(`Outside India · ${c.country}`, -15, 0); fits = false; }
  if (b.languages.length) gate(b.languages.includes(c.language), `Language · ${c.language}`, 10, `Language · ${c.language}`, 12);
  exclude(b.excludeLanguages.includes(c.language), `Excluded language · ${c.language}`);
  const vocab = topicsOf(c);
  const banned = b.excludeTerms.filter((t) => vocab.includes(t));
  exclude(banned.length > 0, `Excluded topic · ${banned.join(", ")}`);
  if (b.terms.length) {
    // what the creator actually publishes, rare words weighted up ("msi" counts more than "review")
    const { score: rel, matched } = topicMatch(b.terms, vocab, b.idf ?? new Map());
    // up to 30: when a brief names specifics ("MSI laptop"), what the creator actually makes outranks general quality
    add(matched.length ? `Topics · ${matched.slice(0, 3).join(", ")}` : "No topic match", rel * 30, 30);
  }
  if (b.like) {
    if (b.like.channelId === c.channelId) { add("The creator you named", 0, 0); fits = false; }
    else { const s = similarity(c, b.like); add(`Similar to ${b.like.name} · ${Math.round(s * 100)}%`, s * 25, 25); }
  }
  if (b.minSubs !== undefined && b.maxSubs !== undefined)
    gate(c.subs >= b.minSubs && c.subs <= b.maxSubs, "In size range", 10, c.subs > b.maxSubs ? "Above size range" : "Below size range", 8);
  // No size in the brief → a default floor: below it, engagement is noise and reach too small to book.
  else if (c.subs < MIN_AUDIENCE) { add(`Under ${fmt(MIN_AUDIENCE)} subscribers`, -10, 0); fits = false; }
  if (b.minViews) gate(c.views >= b.minViews, `Avg views ≥ ${fmt(b.minViews)}`, 8, `Avg views ${fmt(c.views)}`, 8);
  if (b.minEng) gate(c.eng >= b.minEng, `Engagement ≥ ${b.minEng}%`, 8, `Engagement ${c.eng}%`, 8);

  // Engagement only earns full credit once views are large enough for the rate to mean something.
  const reliability = Math.min(1, c.views / RELIABLE_VIEWS);
  add(`Engagement ${c.eng}%${reliability < 1 ? " (few views)" : ""}`, (Math.min(c.eng, 9) / 9) * 12 * reliability, 12);
  add(`Growth +${c.growth}%`, (Math.min(c.growth, 20) / 20) * 6, 6);
  // Reach: average views per upload, log-scaled so 1K → 0 and 500K+ → full credit (big channels don't swamp the rest).
  add(`Reach · ${fmt(c.views)} avg views`, Math.max(0, Math.min(1, (Math.log10(Math.max(c.views, 1)) - 3) / (Math.log10(500_000) - 3))) * 8, 8);
  add(`Authenticity ${c.auth}`, ((c.auth - 60) / 40) * 8, 8);
  add(`Track record · ${c.repeat}% repeat`, (c.repeat / 100) * 6 + (c.proven ? 4 : 0), 10);
  // Brand signals from recent uploads (signals.ts). Unknown (not ingested yet) earns and costs nothing.
  if (c.lastUploadDays != null) {
    const d = c.lastUploadDays;
    if (d > 90) add(`Inactive · last upload ${d}d ago`, 0, 6); // no credit, no penalty: an exact topic match still beats an active non-match
    else add(`Active · uploaded ${d === 0 ? "today" : `${d}d ago`}`, d <= 14 ? 6 : d <= 30 ? 4 : 2, 6);
  }
  if (c.sponsoredPct != null) {
    const p = c.sponsoredPct;
    // some sponsorships = brands already trust them; most uploads sponsored = audiences tune ads out
    if (p > 50) add(`Ad-heavy · ${p}% sponsored`, -4, 3);
    else add(p > 0 ? `Brand-ready · ${p}% sponsored` : "No recent sponsorships", p > 0 ? 3 : 0, 3);
  }
  if (c.safety.length) {
    add(`Brand safety · ${c.safety.join(", ")} in titles`, -10, 0);
    if (b.safeOnly) fits = false;
  }
  if (b.wantEng && !b.minEng) { const bar = b.engBar ?? 6.5; add(`High engagement (≥ ${bar}%)`, c.eng >= bar ? 6 : 0, 6); }
  if (b.wantGrowth) add("Fast-growing", c.growth >= 10 ? 6 : 0, 6);

  const earned = signals.reduce((s, x) => s + x.points, 0);
  return { creator: c, score: Math.max(0, Math.min(100, Math.round((earned / max) * 100))), signals, fits };
}

/** Audience demographics exist only for creators who connected their channel (YouTube shares them with owners only). */
export const audienceVerified = (c: Creator) => c.geo.length > 0 && c.age.length > 0;

/**
 * Estimated shared audience between two creators (0–93%), from geo, niche, age, gender and platform.
 * Only a real signal when both audiences are verified; otherwise it mostly reflects niche + country.
 */
export function overlap(a: Creator, b: Creator): number {
  let s = 0;
  // Without connected demographics, fall back to channel country and neutral midpoints.
  const market = (c: Creator) => c.geo[0]?.[0] ?? c.country;
  if (market(a) === market(b)) s += 34;
  if (a.niche === b.niche) s += 24;
  s += a.age.length && b.age.length ? Math.max(0, 20 - a.age.reduce((d, v, i) => d + Math.abs(v - b.age[i]), 0) / 2) : 10;
  s += a.male !== null && b.male !== null ? Math.max(0, 14 - Math.abs(a.male - b.male) / 2) : 7;
  if (a.platform === b.platform) s += 6;
  return Math.min(93, Math.round(s));
}
