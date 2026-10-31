/*  kashida.js — the one place this site knows anything about kashida.
 *
 *  Kashida (tatweel, U+0640) is a typographic stretch, not spelling. It does
 *  not belong in content. Source text stays clean; this module adds the
 *  stretch when the page renders and takes it back out when text is copied.
 *
 *  Nothing else in the project may contain kashida logic or a literal U+0640.
 *
 *  Browser:  <script src="js/kashida.js"></script>  ->  window.Kashida
 *  Node:     require('./site/js/kashida.js')        ->  same API (for tests)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Kashida = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KASHIDA = 'ـ';

  /* ------------------------------------------------------------------ *
   *  Config — the only switchboard. Everything else reads from here.
   * ------------------------------------------------------------------ */
  var CONFIG = {
    // master switch: false => the site renders exactly the clean source text
    enabled: true,

    // never more than this many stretches in one word
    maxPerWord: 1,

    // words shorter than this are left alone (counted in letters, not bytes)
    minWordLength: 3,

    // families whose shapes break when stretched; matched case-insensitively
    // against the element's computed font-family
    disabledFonts: ['Ruqaa', 'Aref Ruqaa', 'Ruqaa One'],

    // Reading of rule 4's "or none". With true, a word is stretched only at
    // the preferred position (before a connected final ة / ه) and otherwise
    // left alone — which is what keeps it sparing. Set false to let a word
    // fall back to the best other allowed position.
    preferredOnly: true,

    // which elements get stretched: visible prose and headings only
    textSelectors: 'h1, h2, h3, h4, p, blockquote, figcaption',

    // ...but never inside these, whatever the selector above says
    skipWithin: 'header, nav, button, a, label, form, input, textarea, select,' +
                ' code, pre, script, style, svg, .marquee, [data-no-kashida]'
  };

  /* ------------------------------------------------------------------ *
   *  Letter tables
   * ------------------------------------------------------------------ */

  // A kashida may never follow these: they do not join to the letter after
  // them, so a stretch would hang off a gap. The brief lists the first
  // eleven; ى and ٱ behave the same way and are included for safety.
  var NON_CONNECTING = 'ا أ إ آ ٱ د ذ ر ز و ؤ ة ء ى'.split(' ').join('');

  // "Tooth" letters — the short upstrokes. Stretching between one of these
  // and a following ن / ي / ر leaves the tooth stranded.
  var TOOTH = 'بتثني';

  // ء never joins to the letter before it either.
  var NO_BACKWARD_JOIN = 'ء';

  var RE_MARK = /[ً-ٰٕۖ-ࣰۭ-ࣿ]/;
  var RE_ARABIC_LETTER = /[ء-غف-يٮ-ۓۺ-ۿ]/;

  function isMark(ch) { return RE_MARK.test(ch); }
  function isArabicLetter(ch) { return RE_ARABIC_LETTER.test(ch); }

  /* ------------------------------------------------------------------ *
   *  stripKashida — remove every U+0640, always safe to call
   * ------------------------------------------------------------------ */
  function stripKashida(text) {
    if (text === null || text === undefined) return text;
    return String(text).split(KASHIDA).join('');
  }

  /* ------------------------------------------------------------------ *
   *  Split a word into base letters, each carrying any marks that follow
   * ------------------------------------------------------------------ */
  function toLetters(word) {
    var letters = [];
    for (var i = 0; i < word.length; i++) {
      var ch = word[i];
      if (isMark(ch) && letters.length) {
        letters[letters.length - 1].marks += ch;
      } else {
        letters.push({ ch: ch, marks: '' });
      }
    }
    return letters;
  }

  /* ------------------------------------------------------------------ *
   *  allowedPositions — every index i where a kashida may sit between
   *  letter i and letter i+1. Exported so the rules can be tested directly.
   * ------------------------------------------------------------------ */
  function allowedPositions(word, options) {
    var cfg = withOptions(options);
    var letters = toLetters(stripKashida(word));
    var n = letters.length;
    var out = [];
    if (n < cfg.minWordLength) return out;          // rule 2

    var startsWithAl = letters[0].ch === 'ا' && n > 1 && letters[1].ch === 'ل';

    for (var i = 0; i < n - 1; i++) {
      var a = letters[i].ch, b = letters[i + 1].ch;
      var bIsLast = (i + 1 === n - 1);

      if (!isArabicLetter(a) || !isArabicLetter(b)) continue;
      if (NON_CONNECTING.indexOf(a) !== -1) continue;        // rule 3
      if (NO_BACKWARD_JOIN.indexOf(b) !== -1) continue;      // rule 3, other side

      if (startsWithAl && i === 1) continue;                 // after "ال"
      if (letters[0].ch === 'ل' && i === 0) continue;        // after initial lam
      if (a === 'ل' && b === 'ل') continue;                  // between two lams
      if (a === 'ل' && b === 'د') continue;                  // lam + dal
      if (b === 'و') continue;                               // before waw
      if (bIsLast && (b === 'ي' || b === 'ى')) continue;     // before final yaa
      if (bIsLast && b === 'ن' && TOOTH.indexOf(a) !== -1) continue;  // tooth + final noon
      if (b === 'ر' && TOOTH.indexOf(a) !== -1) continue;    // tooth + raa

      out.push(i);
    }
    return out;
  }

  /* preferred position: before a connected final ة or ه (rule 4) */
  function preferredPosition(word, options) {
    var letters = toLetters(stripKashida(word));
    var n = letters.length;
    if (n < 2) return -1;
    var last = letters[n - 1].ch;
    if (last !== 'ة' && last !== 'ه') return -1;
    var positions = allowedPositions(word, options);
    return positions.indexOf(n - 2) !== -1 ? n - 2 : -1;
  }

  function stretchWord(word, options) {
    var cfg = withOptions(options);
    var clean = stripKashida(word);
    if (cfg.maxPerWord < 1) return clean;

    var at = preferredPosition(clean, cfg);
    if (at === -1) {
      if (cfg.preferredOnly) return clean;             // rule 5: be sparing
      var positions = allowedPositions(clean, cfg);
      if (!positions.length) return clean;
      at = positions[positions.length - 1];            // latest allowed position
    }

    var letters = toLetters(clean), out = '';
    for (var i = 0; i < letters.length; i++) {
      out += letters[i].ch + letters[i].marks;
      if (i === at) out += KASHIDA;                    // rule 1: exactly one
    }
    return out;
  }

  function withOptions(options) {
    if (!options) return CONFIG;
    var merged = {};
    for (var k in CONFIG) if (Object.prototype.hasOwnProperty.call(CONFIG, k)) merged[k] = CONFIG[k];
    for (var j in options) if (Object.prototype.hasOwnProperty.call(options, j)) merged[j] = options[j];
    return merged;
  }

  function fontIsDisabled(fontFamily, cfg) {
    if (!fontFamily) return false;
    var hay = String(fontFamily).toLowerCase();
    for (var i = 0; i < cfg.disabledFonts.length; i++) {
      if (hay.indexOf(String(cfg.disabledFonts[i]).toLowerCase()) !== -1) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ *
   *  applyKashida — strips first, then stretches word by word.
   *  Non-Arabic runs pass through untouched.
   * ------------------------------------------------------------------ */
  function applyKashida(text, options) {
    if (text === null || text === undefined) return text;
    var cfg = withOptions(options);
    var clean = stripKashida(text);
    if (!cfg.enabled) return clean;
    if (fontIsDisabled(cfg.font, cfg)) return clean;   // rule 6

    var out = '', buf = '';
    for (var i = 0; i < clean.length; i++) {
      var ch = clean[i];
      if (isArabicLetter(ch) || (isMark(ch) && buf)) {
        buf += ch;
      } else {
        if (buf) { out += stretchWord(buf, cfg); buf = ''; }
        out += ch;
      }
    }
    if (buf) out += stretchWord(buf, cfg);
    return out;
  }

  /* ------------------------------------------------------------------ *
   *  The single render hook.
   *
   *  Walks the text nodes of prose and headings only, and writes the
   *  stretched text into the DOM. The document's own markup keeps the clean
   *  text, and a copy handler strips the stretch again, so what anyone
   *  copies off the page is the clean string.
   * ------------------------------------------------------------------ */
  function enhance(root, options) {
    if (typeof document === 'undefined') return 0;
    var cfg = withOptions(options);
    if (!cfg.enabled) return 0;

    var scope = root || document;
    var blocks = scope.querySelectorAll(cfg.textSelectors);
    var changed = 0;

    for (var b = 0; b < blocks.length; b++) {
      var el = blocks[b];
      if (el.closest && el.closest(cfg.skipWithin)) continue;
      if (typeof getComputedStyle === 'function' &&
          fontIsDisabled(getComputedStyle(el).fontFamily, cfg)) continue;

      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      var node, nodes = [];
      while ((node = walker.nextNode())) nodes.push(node);

      for (var n = 0; n < nodes.length; n++) {
        var t = nodes[n];
        if (t.parentElement && t.parentElement.closest(cfg.skipWithin)) continue;
        var next = applyKashida(t.nodeValue, cfg);
        if (next !== t.nodeValue) { t.nodeValue = next; changed++; }
      }
    }

    installCopyGuard();
    return changed;
  }

  /* Anything copied from the page comes out clean. */
  var copyGuardInstalled = false;
  function installCopyGuard() {
    if (copyGuardInstalled || typeof document === 'undefined') return;
    copyGuardInstalled = true;
    document.addEventListener('copy', function (e) {
      var sel = (window.getSelection && window.getSelection().toString()) || '';
      if (!sel || sel.indexOf(KASHIDA) === -1) return;
      var clean = stripKashida(sel);
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', clean);
        e.preventDefault();
      }
    });
  }

  return {
    KASHIDA: KASHIDA,
    CONFIG: CONFIG,
    stripKashida: stripKashida,
    applyKashida: applyKashida,
    allowedPositions: allowedPositions,
    preferredPosition: preferredPosition,
    enhance: enhance
  };
});
