/*  Rules for Arabic kashida, one allowed case and one forbidden case each.
 *  Run with:  node --test tests/
 */
const test = require('node:test');
const assert = require('node:assert');
const K = require('../site/js/kashida.js');

const TATWEEL = 'ـ';
const count = (s) => s.split(TATWEEL).length - 1;

/* ---------------------------------------------------------------- strip */

test('stripKashida removes every U+0640', () => {
  assert.equal(K.stripKashida('مدرسـة'), 'مدرسة');
  assert.equal(K.stripKashida('خــــدماتنا'), 'خدماتنا');
  assert.equal(count(K.stripKashida('الــــتواصــل')), 0);
});

test('stripKashida leaves clean and non-Arabic text alone', () => {
  assert.equal(K.stripKashida('مدرسة'), 'مدرسة');
  assert.equal(K.stripKashida('Teo Vision'), 'Teo Vision');
  assert.equal(K.stripKashida(''), '');
});

test('applyKashida strips before it stretches, so it is idempotent', () => {
  const once = K.applyKashida('مدرسة');
  assert.equal(K.applyKashida(once), once);
  assert.equal(K.applyKashida('مــدرســة'), once);
});

/* ------------------------------------------------- the brief's examples */

test("the brief's four examples", () => {
  assert.equal(K.applyKashida('الكتاب'), 'الكتاب');       // nothing after "ال"
  assert.equal(K.applyKashida('مدرسة'), 'مدرسـة');
  assert.equal(K.applyKashida('من'), 'من');                // two letters
  assert.equal(K.applyKashida('ولد'), 'ولد');              // no ل ـ د
});

/* ------------------------------------------------------------- rule 1-2 */

test('rule 1: never more than one kashida in a word', () => {
  assert.equal(count(K.applyKashida('المدرسة')), 1);
  assert.equal(count(K.applyKashida('مدرسة')), 1);
  for (const w of ['المدرسة', 'الحكومة', 'الرسالة', 'صفحة']) {
    assert.ok(count(K.applyKashida(w)) <= K.CONFIG.maxPerWord, w);
  }
});

test('rule 2: words of two letters or fewer are untouched', () => {
  for (const w of ['من', 'هل', 'في', 'ما', 'لا', 'و']) {
    assert.equal(K.applyKashida(w), w, w);
  }
  assert.equal(K.applyKashida('شفة'), 'شفـة');             // three letters: allowed
});

/* --------------------------------------------------------------- rule 3 */

test('rule 3: never after a letter that does not join forward', () => {
  // وردة — the only candidate sits after د, which does not join
  assert.equal(K.applyKashida('وردة'), 'وردة');
  for (const w of ['ا', 'أ', 'إ', 'آ', 'د', 'ذ', 'ر', 'ز', 'و', 'ؤ', 'ة', 'ء']) {
    const word = 'س' + w + 'ة';                            // ...X + final ة
    assert.ok(!K.allowedPositions(word).includes(1),
      `position after ${w} must be refused`);
  }
  assert.ok(K.allowedPositions('مدرسة').includes(3));      // after س: allowed
});

/* --------------------------------------------------------------- rule 4 */

test('rule 4: the preferred slot is before a connected final ة or ه', () => {
  assert.equal(K.applyKashida('مدرسة'), 'مدرسـة');
  assert.equal(K.applyKashida('كتبه'), 'كتبـه');
  assert.equal(K.preferredPosition('مدرسة'), 3);
  assert.equal(K.preferredPosition('الكتاب'), -1);         // no final ة/ه
  assert.equal(K.preferredPosition('وردة'), -1);           // ة present but د will not join
});

/* --------------------------------------------------------------- rule 5 */

test('rule 5: sparing — most words get nothing', () => {
  const sentence = 'نحول الأفكار إلى تجارب بصرية وحلول تسويقية تصنع فرقا حقيقيا';
  const words = sentence.split(' ');
  const stretched = words.filter((w) => count(K.applyKashida(w)) > 0).length;
  assert.ok(stretched / words.length < 0.5,
    `${stretched}/${words.length} words stretched — not sparing enough`);
});

/* --------------------------------------------------------------- rule 6 */

test('rule 6: a disabled font turns it off entirely', () => {
  assert.equal(K.applyKashida('مدرسة', { font: 'Aref Ruqaa' }), 'مدرسة');
  assert.equal(K.applyKashida('مدرسة', { font: '"Ruqaa One", serif' }), 'مدرسة');
  assert.equal(K.applyKashida('مدرسة', { font: 'Cairo' }), 'مدرسـة');   // allowed font
});

/* --------------------------------------------------- forbidden positions */

test('forbidden: after the definite article "ال"', () => {
  assert.ok(!K.allowedPositions('الكتاب').includes(1));
  assert.ok(!K.allowedPositions('الدولة').includes(1));
  assert.ok(K.allowedPositions('الدولة').includes(4));     // elsewhere is fine
  assert.equal(K.applyKashida('الدولة'), 'الدولـة');
});

test('forbidden: after an initial lam, and between two lams', () => {
  assert.ok(!K.allowedPositions('لعبة').includes(0));      // initial lam
  assert.ok(K.allowedPositions('لعبة').includes(2));
  assert.equal(K.applyKashida('لعبة'), 'لعبـة');
  assert.ok(!K.allowedPositions('يللة').includes(1));      // lam + lam
});

test('forbidden: between lam and dal', () => {
  assert.ok(!K.allowedPositions('ولده').includes(1));
  assert.equal(K.applyKashida('ولد'), 'ولد');
  assert.ok(K.allowedPositions('بلدة').includes(0));       // ب ـ ل is fine
  assert.ok(!K.allowedPositions('بلدة').includes(2));      // after د: refused anyway
});

test('forbidden: before waw', () => {
  assert.ok(!K.allowedPositions('سنوة').includes(1));      // before و
  assert.ok(K.allowedPositions('سنوة').includes(0));
});

test('forbidden: before a final yaa, including after a tooth letter', () => {
  assert.ok(!K.allowedPositions('كرسي').includes(2));      // before final ي
  assert.ok(!K.allowedPositions('مبني').includes(2));      // tooth ن + final ي
  assert.ok(K.allowedPositions('بيتها').includes(0));      // ي not final: fine
});

test('forbidden: between a tooth letter and a final noon', () => {
  assert.ok(!K.allowedPositions('حنين').includes(2));      // tooth ي + final ن
  assert.ok(K.allowedPositions('حنين').includes(1));       // ن ـ ي mid-word is fine
  assert.ok(!K.allowedPositions('يبن').includes(1));       // tooth ب + final ن
  assert.ok(K.allowedPositions('حسن').includes(1));        // س is not a tooth letter
});

test('forbidden: between a tooth letter and raa', () => {
  assert.ok(!K.allowedPositions('نبرة').includes(1));      // tooth ب + ر
  assert.ok(K.allowedPositions('نبرة').includes(0));       // ن ـ ب is fine
  assert.ok(K.allowedPositions('سفرة').includes(0));       // س is not a tooth letter
});

/* ------------------------------------------------------- safety / config */

test('non-Arabic text is never touched', () => {
  assert.equal(K.applyKashida('Teo Vision'), 'Teo Vision');
  assert.equal(K.applyKashida('Production House & Marketing Agency'),
                              'Production House & Marketing Agency');
  assert.equal(K.applyKashida('+964 7748663366'), '+964 7748663366');
  assert.equal(K.applyKashida('teo.vision.iq@gmail.com'), 'teo.vision.iq@gmail.com');
});

test('mixed Arabic and Latin keeps the Latin intact', () => {
  const out = K.applyKashida('شركة Teo Vision للإنتاج');
  assert.ok(out.includes('Teo Vision'));
  assert.equal(K.stripKashida(out), 'شركة Teo Vision للإنتاج');
});

test('punctuation, numbers and spacing survive', () => {
  const src = 'مكالمة واحدة... قد تكون بداية كل شيء!';
  const out = K.applyKashida(src);
  assert.equal(K.stripKashida(out), src);
});

test('diacritics stay attached to their letter', () => {
  const out = K.applyKashida('فرقًا حقيقيًا');
  assert.equal(K.stripKashida(out), 'فرقًا حقيقيًا');
});

test('enabled: false returns the clean source text', () => {
  assert.equal(K.applyKashida('مدرسة', { enabled: false }), 'مدرسة');
  assert.equal(K.applyKashida('مــدرسة', { enabled: false }), 'مدرسة');
});

test('maxPerWord: 0 behaves as off', () => {
  assert.equal(K.applyKashida('مدرسة', { maxPerWord: 0 }), 'مدرسة');
});

test('minWordLength is honoured', () => {
  assert.equal(K.applyKashida('شفة', { minWordLength: 4 }), 'شفة');
  assert.equal(K.applyKashida('شفة', { minWordLength: 3 }), 'شفـة');
});

test('null and undefined pass through', () => {
  assert.equal(K.applyKashida(null), null);
  assert.equal(K.stripKashida(undefined), undefined);
});
