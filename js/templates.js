// Ready-made wheels and generators («الگوها»). build(params) → { segments, opts?, theme? }.
import { makeSegment, MAX_SEGMENTS } from './wheel.js';

const S = (text, emoji = '', extra = {}) => makeSegment({ text, emoji, ...extra });
const range = (min, max, step) => { const out = []; step = Math.abs(+step) || 1; if (max < min) [min, max] = [max, min]; for (let v = min; v <= max + 1e-9 && out.length < MAX_SEGMENTS; v += step) out.push(+v.toFixed(6)); return out; };

export const FA_LETTERS = 'ا ب پ ت ث ج چ ح خ د ذ ر ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن و ه ی'.split(' ');
export const EN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

/** Number of ways to roll `sum` with `n` six-sided dice (for the weighted "sum of dice" wheel). */
export function diceWays(n, sum) {
  let dp = [1];
  for (let d = 0; d < n; d++) { const nx = new Array(dp.length + 6).fill(0); dp.forEach((c, s) => { for (let f = 1; f <= 6; f++) nx[s + f] += c; }); dp = nx; }
  return dp[sum] || 0;
}

export const TEMPLATES = [
  { id: 'percent', name: 'گردونه‌ی درصد', emoji: '💯', desc: 'از ۱٪ تا ۱۰۰٪ — با گام دلخواه', params: [{ k: 'step', label: 'گام', def: 1, min: 1, max: 50 }],
    build: ({ step = 1 }) => ({ segments: range(step, 100, step).map((v) => S(v + '%')), theme: 'neon' }) },
  { id: 'number', name: 'عدد تصادفی', emoji: '🔢', desc: 'بازه‌ی دلخواه با گام', params: [{ k: 'min', label: 'از', def: 1 }, { k: 'max', label: 'تا', def: 10 }, { k: 'step', label: 'گام', def: 1, min: 0.01 }],
    build: ({ min = 1, max = 10, step = 1 }) => ({ segments: range(+min, +max, +step).map((v) => S(String(v))), theme: 'candy' }) },
  { id: 'yesno', name: 'بله یا نه؟', emoji: '🤔', desc: 'وقتی دو دلی', params: [{ k: 'maybe', label: 'گزینه‌ی «شاید» هم باشد (۰/۱)', def: 0, min: 0, max: 1 }],
    build: ({ maybe = 0 }) => ({ segments: [S('بله', '✅', { color: '#1fb46a' }), S('نه', '❌', { color: '#e63946' }), S('بله', '✅', { color: '#1fb46a' }), S('نه', '❌', { color: '#e63946' }), ...(+maybe ? [S('شاید', '🤷‍♀️', { color: '#f4a261' })] : [])] }) },
  { id: 'coin', name: 'شیر یا خط', emoji: '🪙', desc: 'سکه‌ی منصفانه', build: () => ({ segments: [S('شیر', '🦁', { color: '#d4a017' }), S('خط', '✍️', { color: '#6c757d' })], theme: 'gold' }) },
  { id: 'timer', name: 'تایمر دقیقه‌ها', emoji: '⏱️', desc: 'چند دقیقه؟ برای استراحت، مطالعه یا بازی', build: () => ({ segments: [1, 2, 3, 5, 10, 15, 20, 25, 30, 45, 60, 90].map((m) => S(m >= 60 ? (m === 60 ? 'یک ساعت' : 'یک ساعت و نیم') : `${m} دقیقه`)), theme: 'candy' }) },
  { id: 'drive', name: 'رانندگی', emoji: '🚗', desc: 'راست، چپ یا مستقیم؟ برای دور زدن بی‌هدف در شهر', build: () => ({ segments: [S('راست', '➡️'), S('چپ', '⬅️'), S('مستقیم', '⬆️'), S('راست', '➡️'), S('چپ', '⬅️'), S('مستقیم', '⬆️'), S('دور بزن', '↩️', { weight: 0.5 })], theme: 'galaxy' }) },
  { id: 'drive-drill', name: 'تمرین رانندگی', emoji: '🅿️', desc: 'امروز چه مهارتی را تمرین کنم؟', build: () => ({ segments: ['پارک دوبل', 'پارک سربالایی', 'دنده‌عقب مستقیم', 'دور زدن در کوچه', 'رانندگی شب', 'اتوبان و ورود به لاین', 'ترمز نرم', 'آینه‌ها و نقطه‌ی کور'].map((t) => S(t, '🚙')), theme: 'neon' }) },
  { id: 'letters-fa', name: 'الفبای فارسی', emoji: '🔤', desc: '۳۲ حرف — برای اسم‌فامیل', build: () => ({ segments: FA_LETTERS.map((l) => S(l)), theme: 'kashi' }) },
  { id: 'letters-en', name: 'English letters', emoji: '🅰️', desc: 'A تا Z', build: () => ({ segments: EN_LETTERS.map((l) => S(l)), theme: 'pastel' }) },
  { id: 'dice', name: 'تاس ۶ وجهی', emoji: '🎲', desc: 'یک تاس روی گردونه', build: () => ({ segments: DICE.map((d, i) => S(String(i + 1), d)), theme: 'candy' }) },
  { id: 'dice-sum', name: 'جمع چند تاس', emoji: '🎲', desc: 'شانس هر جمع دقیقاً مثل پرتاب واقعی (وزن‌دار)', params: [{ k: 'n', label: 'تعداد تاس', def: 2, min: 2, max: 4 }],
    build: ({ n = 2 }) => { n = Math.min(4, Math.max(2, n | 0)); const segs = []; for (let s = n; s <= 6 * n; s++) segs.push(S(String(s), '', { weight: diceWays(n, s) })); return { segments: segs, theme: 'gold' }; } },
  { id: 'food', name: 'امروز چی بخوریم؟', emoji: '🍽️', desc: 'غذاهای خانگی و بیرون', build: () => ({ segments: [['قورمه‌سبزی', '🌿'], ['کباب کوبیده', '🍢'], ['زرشک‌پلو با مرغ', '🍗'], ['کله‌جوش', '🥣'], ['آش رشته', '🍜'], ['پیتزا', '🍕'], ['ماکارونی', '🍝'], ['قیمه', '🍛'], ['ساندویچ', '🥪'], ['سالاد الویه', '🥗'], ['جوجه‌کباب', '🔥'], ['بریانی', '🍖']].map(([t, e]) => S(t, e)), theme: 'candy' }) },
  { id: 'cat', name: 'بازی با گربه', emoji: '🐈', desc: 'امروز با پیشی چی بازی کنیم؟', build: () => ({ segments: [['چوب پَر', '🪶'], ['توپ زنگوله‌دار', '🎾'], ['قایم‌موشک با جعبه', '📦'], ['شکار تشویقی', '🐟'], ['تونل بازی', '🌀'], ['برس و نوازش', '🪮'], ['موش عروسکی', '🐭'], ['چرت دونفره', '😴']].map(([t, e]) => S(t, e)), theme: 'cat' }) },
  { id: 'home', name: 'کار امروز خانه', emoji: '🏠', desc: 'یک کار کوچک، هر روز', build: () => ({ segments: [['گردگیری', '🧹'], ['جاروبرقی', '🌀'], ['مرتب کردن کمد', '👗'], ['آب دادن گلدان‌ها', '🪴'], ['تمیز کردن آشپزخانه', '🍳'], ['تعویض ملافه', '🛏️'], ['خرید هفتگی', '🛒'], ['ظرف غذای گربه', '🐾']].map(([t, e]) => S(t, e)), theme: 'pastel' }) },
  { id: 'truth', name: 'حقیقت یا جرئت', emoji: '🎭', desc: 'برای دورهمی — هر بار یک سؤال یا چالش تصادفی',
    build: () => ({ segments: [S('حقیقت', '💬', { color: '#3a86ff', pool: TRUTHS }), S('جرئت', '🔥', { color: '#e63946', pool: DARES }), S('حقیقت', '💬', { color: '#3a86ff', pool: TRUTHS }), S('جرئت', '🔥', { color: '#e63946', pool: DARES })], theme: 'neon' }) },
  { id: 'clash', name: 'چالش کلش رویال', emoji: '👑', desc: 'بازی بعدی‌ات را با این قانون انجام بده', build: () => ({ segments: CLASH.map(([t, e]) => S(t, e)), theme: 'gold' }) },
  { id: 'outfit', name: 'رنگ لباس امروز', emoji: '👗', desc: 'هر خانه رنگ واقعی همان لباس است', build: () => ({ segments: OUTFIT.map(([t, c]) => S(t, '', { color: c })) }) },
  { id: 'team', name: 'انتخاب نفر / گروه', emoji: '👥', desc: 'اسم‌ها را بنویس؛ چند برنده و حذف خودکار', build: () => ({ segments: ['نفر ۱', 'نفر ۲', 'نفر ۳', 'نفر ۴', 'نفر ۵', 'نفر ۶'].map((t) => S(t, '🙋')), opts: { winners: 2, elim: true } }) },
  { id: 'read', name: 'امروز چی بخوانم؟', emoji: '📚', desc: 'برای قفسه‌ی کتاب', build: () => ({ segments: [['رمان', '📖'], ['شعر', '🪶'], ['حقوقی', '⚖️'], ['روانشناسی', '🧠'], ['تاریخ', '🏛️'], ['داستان کوتاه', '✍️']].map(([t, e]) => S(t, e)), theme: 'kashi' }) },
];
export const templateById = (id) => TEMPLATES.find((t) => t.id === id);
export function buildTemplate(id, params = {}) {
  const t = templateById(id); if (!t) throw new Error('unknown template ' + id);
  const p = Object.fromEntries((t.params || []).map((x) => { let v = params[x.k] ?? x.def; v = +v; if (!Number.isFinite(v)) v = x.def; if (x.min != null) v = Math.max(x.min, v); if (x.max != null) v = Math.min(x.max, v); return [x.k, v]; }));
  return { name: t.name, emoji: t.emoji, template: id, ...t.build(p) };
}

export const TRUTHS = ['خجالت‌آورترین خاطره‌ات چیست؟', 'اگر یک روز نامرئی بودی چه می‌کردی؟', 'بهترین تعریفی که شنیده‌ای؟', 'آخرین باری که از ته دل خندیدی کی بود؟', 'کدام عادتت را دوست داری ترک کنی؟', 'اولین شغلی که دوست داشتی چه بود؟', 'اگر فقط یک غذا تا آخر عمر، کدام؟', 'بزرگ‌ترین ترس بچگی‌ات؟', 'کدام فیلم را چند بار دیده‌ای؟', 'یک راز کوچک بی‌خطر بگو!'];
export const DARES = ['با لهجه‌ی کرمانی یک خبر بخوان', '۳۰ ثانیه ادای گربه را دربیاور', 'یک بیت شعر از حفظ بخوان', 'با چشم بسته اسمت را بنویس', '۱۰ بار پشت سر هم بگو «شش سیخ جیگر»', 'یک جوک تعریف کن', 'به مدت یک دقیقه فقط با شعر حرف بزن', 'یک حرکت ورزشی ۱۵ بار', 'آهنگ دلخواه نفر بعدی را زمزمه کن', 'برای نفر سمت راستت یک لقب بامزه بساز'];
export const CLASH = [['فقط کارت‌های معمولی', '⚪'], ['دک بدون اسپل', '🚫'], ['میانگین الیکسیر زیر ۳', '⚡'], ['فقط کارت‌های ۵ الیکسیر به بالا', '🐘'], ['حتماً یک کارت تکامل‌یافته', '🌀'], ['دک کاملاً تصادفی', '🎲'], ['بدون ساختمان دفاعی', '🏰'], ['فقط کارت‌های هوایی + اسپل', '🦅'], ['دو بُرد پشت سر هم', '🏆'], ['با کارتی که کمترین بار بازی کرده‌ای', '🃏']];
export const OUTFIT = [['قرمز', '#d62828'], ['سرمه‌ای', '#1d2a5a'], ['کرم', '#efe3c8'], ['مشکی', '#151515'], ['سفید', '#f8f8f8'], ['سبز زیتونی', '#6b7d3a'], ['صورتی پودری', '#f2b8c6'], ['خردلی', '#d4a017'], ['طوسی', '#8d939b'], ['آبی آسمانی', '#86c5f0'], ['زرشکی', '#7b1e3a'], ['بژ', '#d8c3a5']];
