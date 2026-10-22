/* Syntax highlighter ขนาดเล็ก (ไม่ต้องพึ่ง library ภายนอก — MV3 ห้ามโหลดโค้ดจาก CDN) */
const Highlight = (() => {
  const C_KW = 'auto break case const continue default do else enum extern for goto if inline register restrict return sizeof static struct switch typedef union volatile while';
  const C_TYPES = 'int long short char float double void signed unsigned bool size_t int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t FILE';
  const JS_KW = 'break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield async await get set as';
  const JS_BUILTIN = 'console window document Math JSON Object Array String Number Boolean Promise Map Set Date RegExp Error Symbol require module exports process fetch setTimeout setInterval clearTimeout localStorage';

  /*
   * ตัวเลือกของแต่ละภาษา:
   *   kw / types / lit / builtin : คำที่ไฮไลต์ (คั่นด้วยช่องว่าง)
   *   line / block               : สัญลักษณ์คอมเมนต์
   *   str                        : อักขระเปิด string, triple: รองรับ """ / '''
   *   strPrefix                  : ตัวอักษรนำหน้า string เช่น f"" r"" @"" $""
   *   pre    : บรรทัดที่ขึ้นต้นด้วย # เป็น preprocessor   deco : @decorator / annotation
   *   vars   : ตัวแปรขึ้นต้นด้วย $   macro : name!()   sym : :symbol   ci : ไม่สนตัวพิมพ์เล็กใหญ่
   */
  const LANGS = {
    plain: { label: 'Plain text', group: '' },

    html: { label: 'HTML', group: 'Web', mode: 'markup' },
    css: { label: 'CSS', group: 'Web', mode: 'css' },
    scss: { label: 'SCSS / Sass', group: 'Web', mode: 'css', scss: true },
    javascript: {
      label: 'JavaScript', group: 'Web',
      kw: JS_KW, lit: 'true false null undefined NaN Infinity', builtin: JS_BUILTIN,
      line: '//', block: ['/*', '*/'], str: '\'"`',
    },
    typescript: {
      label: 'TypeScript', group: 'Web',
      kw: JS_KW + ' interface type enum implements public private protected readonly abstract declare namespace keyof infer is satisfies',
      types: 'string number boolean any unknown never void object bigint symbol',
      lit: 'true false null undefined NaN Infinity', builtin: JS_BUILTIN,
      line: '//', block: ['/*', '*/'], str: '\'"`', deco: true,
    },
    php: {
      label: 'PHP', group: 'Web',
      kw: 'abstract and as break case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while yield',
      types: 'int float string bool array object mixed void callable iterable',
      lit: 'true false null TRUE FALSE NULL', line: ['//', '#'], block: ['/*', '*/'], str: '\'"', vars: true,
    },
    json: { label: 'JSON', group: 'Web', lit: 'true false null', str: '"', jsonKeys: true },
    xml: { label: 'XML / SVG', group: 'Web', mode: 'markup' },

    python: {
      label: 'Python', group: 'ภาษาทั่วไป',
      kw: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case',
      lit: 'True False None',
      builtin: 'print len range int str float list dict set tuple bool open input enumerate zip map filter sorted sum min max abs type isinstance super self cls',
      line: '#', str: '\'"', triple: true, strPrefix: 'rbfuRBFU', deco: true,
    },
    c: {
      label: 'C', group: 'ภาษาทั่วไป',
      kw: C_KW, types: C_TYPES, lit: 'NULL true false',
      builtin: 'printf scanf fprintf sprintf malloc calloc realloc free memcpy memset strlen strcpy strcmp fopen fclose',
      line: '//', block: ['/*', '*/'], str: '\'"', pre: true,
    },
    cpp: {
      label: 'C++', group: 'ภาษาทั่วไป',
      kw: C_KW + ' class namespace using template typename public private protected virtual override final new delete this friend operator try catch throw noexcept constexpr consteval static_cast dynamic_cast reinterpret_cast const_cast explicit mutable decltype co_await co_return co_yield',
      types: C_TYPES + ' auto string wstring vector map set unordered_map unordered_set pair tuple array unique_ptr shared_ptr optional wchar_t',
      lit: 'nullptr true false NULL', builtin: 'std cout cin cerr endl make_unique make_shared move printf',
      line: '//', block: ['/*', '*/'], str: '\'"', pre: true, strPrefix: 'LuUR',
    },
    csharp: {
      label: 'C#', group: 'ภาษาทั่วไป',
      kw: 'abstract as base break case catch checked class const continue default delegate do else enum event explicit extern finally fixed for foreach goto if implicit in interface internal is lock namespace new operator out override params private protected public readonly ref return sealed sizeof stackalloc static struct switch this throw try typeof unchecked unsafe using virtual volatile while async await var get set init record yield where when nameof partial required',
      types: 'bool byte char decimal double float int long object sbyte short string uint ulong ushort void dynamic',
      lit: 'true false null', builtin: 'Console Math List Dictionary Task String DateTime Guid Exception Enumerable',
      line: '//', block: ['/*', '*/'], str: '\'"', pre: true, strPrefix: '@$',
    },
    java: {
      label: 'Java', group: 'ภาษาทั่วไป',
      kw: 'abstract assert break case catch class continue default do else enum extends final finally for if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws transient try volatile while var record sealed permits yield',
      types: 'boolean byte char double float int long short void String',
      lit: 'true false null', builtin: 'System Math List ArrayList Map HashMap Arrays Collections Optional',
      line: '//', block: ['/*', '*/'], str: '\'"', deco: true,
    },
    kotlin: {
      label: 'Kotlin', group: 'ภาษาทั่วไป',
      kw: 'as break class continue do else for fun if in interface is object package return super this throw try typealias val var when while by catch constructor init companion data enum sealed open override private protected public internal lateinit suspend import',
      types: 'Int Long Double Float Boolean String Char Unit Any Nothing',
      lit: 'true false null', builtin: 'println print listOf mapOf setOf mutableListOf mutableMapOf',
      line: '//', block: ['/*', '*/'], str: '\'"', deco: true,
    },
    swift: {
      label: 'Swift', group: 'ภาษาทั่วไป',
      kw: 'associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public static struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as catch is rethrows throw throws try async await self Self some any',
      types: 'Int Double Float Bool String Character Array Dictionary Optional Void',
      lit: 'true false nil', builtin: 'print',
      line: '//', block: ['/*', '*/'], str: '"', deco: true,
    },
    go: {
      label: 'Go', group: 'ภาษาทั่วไป',
      kw: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var',
      types: 'int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float32 float64 string bool byte rune error any',
      lit: 'true false nil iota', builtin: 'fmt make new len cap append copy delete panic recover',
      line: '//', block: ['/*', '*/'], str: '\'"`',
    },
    rust: {
      label: 'Rust', group: 'ภาษาทั่วไป',
      kw: 'as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while',
      types: 'i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str String Vec Option Result Box',
      lit: 'true false None Some Ok Err',
      line: '//', block: ['/*', '*/'], str: '"', macro: true, deco: true,
    },
    dart: {
      label: 'Dart / Flutter', group: 'ภาษาทั่วไป',
      kw: 'abstract as assert async await break case catch class const continue covariant default deferred do else enum export extends extension external factory final finally for get if implements import in interface is late library mixin new on operator part required rethrow return set show static super switch sync this throw try typedef var while with yield',
      types: 'int double num bool String List Map Set Future Stream void dynamic Widget',
      lit: 'true false null', builtin: 'print',
      line: '//', block: ['/*', '*/'], str: '\'"', deco: true,
    },
    ruby: {
      label: 'Ruby', group: 'ภาษาทั่วไป',
      kw: 'alias and begin break case class def do else elsif end ensure for if in module next not or redo rescue retry return self super then undef unless until when while yield require attr_accessor attr_reader',
      lit: 'true false nil', builtin: 'puts print p gets',
      line: '#', str: '\'"', sym: true,
    },
    lua: {
      label: 'Lua', group: 'ภาษาทั่วไป',
      kw: 'and break do else elseif end for function goto if in local not or repeat return then until while',
      lit: 'true false nil', builtin: 'print pairs ipairs table string math require',
      line: '--', block: ['--[[', ']]'], str: '\'"',
    },

    bash: {
      label: 'Bash / Shell', group: 'สคริปต์ & ข้อมูล',
      kw: 'if then else elif fi for while do done case esac function return in local export exit',
      builtin: 'echo cd ls grep sed awk cat mkdir rm cp mv chmod sudo apt npm npx git curl source pwd touch',
      line: '#', str: '\'"', vars: true,
    },
    powershell: {
      label: 'PowerShell', group: 'สคริปต์ & ข้อมูล',
      kw: 'function param if else elseif foreach for while do switch return try catch finally throw begin process end in',
      lit: '$true $false $null',
      line: '#', block: ['<#', '#>'], str: '\'"', ci: true, dash: true, vars: true,
    },
    sql: {
      label: 'SQL', group: 'สคริปต์ & ข้อมูล',
      kw: 'select from where and or not insert into values update set delete create table drop alter add join left right inner outer full cross on group by order having limit offset as distinct is in like between union all primary key foreign references index view case when then else end exists returning with default constraint unique check asc desc',
      types: 'int integer bigint smallint varchar char text date datetime timestamp boolean decimal numeric float real serial uuid json jsonb',
      lit: 'null true false', builtin: 'count sum avg min max coalesce now concat lower upper',
      line: '--', block: ['/*', '*/'], str: '\'"', ci: true,
    },
    yaml: { label: 'YAML', group: 'สคริปต์ & ข้อมูล', mode: 'yaml' },
    markdown: { label: 'Markdown', group: 'สคริปต์ & ข้อมูล', mode: 'markdown' },
  };
  for (const l of Object.values(LANGS)) {
    for (const k of ['kw', 'types', 'lit', 'builtin']) {
      if (l[k]) l[k + 'Set'] = new Set((l.ci ? l[k].toLowerCase() : l[k]).split(' '));
    }
  }

  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const span = (cls, s) => s ? `<span class="tok-${cls}">${esc(s)}</span>` : '';

  /* ---------- ภาษาทั่วไป (C-like, Python, ...) ---------- */
  function generic(src, L) {
    const lines = [].concat(L.line || []);
    let out = '';
    let i = 0;
    const n = src.length;
    const atLineStart = k => {
      k--;
      while (k >= 0 && (src[k] === ' ' || src[k] === '\t')) k--;
      return k < 0 || src[k] === '\n';
    };
    const readString = (start, q) => {
      let j = start + 1;
      while (j < n && src[j] !== q) {
        if (src[j] === '\\') j++;
        else if (src[j] === '\n' && q !== '`') break;
        j++;
      }
      return Math.min(j + 1, n);
    };

    while (i < n) {
      const ch = src[i];
      const prev = src[i - 1] || '';

      if (L.block && src.startsWith(L.block[0], i)) {
        let e = src.indexOf(L.block[1], i + L.block[0].length);
        e = e < 0 ? n : e + L.block[1].length;
        out += span('comment', src.slice(i, e)); i = e; continue;
      }
      if (L.pre && ch === '#' && atLineStart(i)) {
        let e = src.indexOf('\n', i); if (e < 0) e = n;
        // #include <x> / "x" ให้เป็นสี string
        const m = /^(#\s*\w+)(\s+)(<[^>\n]*>|"[^"\n]*")?/.exec(src.slice(i, e));
        out += span('meta', m[1]) + m[2] + span('string', m[3] || '');
        i += m[0].length; continue;
      }
      const lc = lines.find(l => src.startsWith(l, i));
      if (lc) {
        let e = src.indexOf('\n', i); if (e < 0) e = n;
        out += span('comment', src.slice(i, e)); i = e; continue;
      }
      if (L.triple && (src.startsWith('"""', i) || src.startsWith("'''", i))) {
        const q = src.slice(i, i + 3);
        let e = src.indexOf(q, i + 3);
        e = e < 0 ? n : e + 3;
        out += span('string', src.slice(i, e)); i = e; continue;
      }
      if (L.strPrefix && L.strPrefix.includes(ch) && !/[\w$]/.test(prev)) {
        const m = /^[A-Za-z@$]{1,2}(?=["'])/.exec(src.slice(i, i + 3));
        if (m && [...m[0]].every(c => L.strPrefix.includes(c))) {
          const qpos = i + m[0].length;
          if (L.triple && src.startsWith(src[qpos].repeat(3), qpos)) {
            let e = src.indexOf(src[qpos].repeat(3), qpos + 3);
            e = e < 0 ? n : e + 3;
            out += span('string', src.slice(i, e)); i = e; continue;
          }
          const e = readString(qpos, src[qpos]);
          out += span('string', src.slice(i, e)); i = e; continue;
        }
      }
      if (L.str && L.str.includes(ch)) {
        // Rust/Swift ไม่มี char ด้วย ' — ข้าม
        const e = readString(i, ch);
        const s = src.slice(i, e);
        const isKey = L.jsonKeys && /^\s*:/.test(src.slice(e));
        out += span(isKey ? 'attr' : 'string', s); i = e; continue;
      }
      if (L.vars && ch === '$' && /[\w{(]/.test(src[i + 1] || '')) {
        const m = /^\$(\{[^}\n]*\}|\(|[\w:]+)/.exec(src.slice(i));
        const w = m[0] === '$(' ? '$' : m[0];
        const isLit = L.litSet && L.litSet.has(w.toLowerCase());
        out += span(isLit ? 'lit' : 'var', w); i += w.length; continue;
      }
      if (L.deco && ch === '@' && /[A-Za-z_]/.test(src[i + 1] || '')) {
        const m = /^@[\w.]+/.exec(src.slice(i));
        out += span('meta', m[0]); i += m[0].length; continue;
      }
      if (L.sym && ch === ':' && /[A-Za-z_]/.test(src[i + 1] || '') && prev !== ':') {
        const m = /^:\w+[?!]?/.exec(src.slice(i));
        out += span('attr', m[0]); i += m[0].length; continue;
      }
      if (/[0-9]/.test(ch) && !/[\w$]/.test(prev)) {
        const m = /^(0x[\da-f_]+|0b[01_]+|\d[\d_]*\.?\d*(e[+-]?\d+)?)[a-z]*/i.exec(src.slice(i));
        out += span('number', m[0]); i += m[0].length; continue;
      }
      if (/[A-Za-z_$]/.test(ch) && !/[\w$]/.test(prev)) {
        const re = L.dash ? /^[A-Za-z_$][\w$]*(-[A-Za-z]\w*)*/ : /^[A-Za-z_$][\w$]*/;
        const w = re.exec(src.slice(i))[0];
        const key = L.ci ? w.toLowerCase() : w;
        const next = src[i + w.length];
        let cls = null;
        if (L.kwSet && L.kwSet.has(key)) cls = 'keyword';
        else if (L.typesSet && L.typesSet.has(key)) cls = 'type';
        else if (L.litSet && L.litSet.has(key)) cls = 'lit';
        else if (L.builtinSet && L.builtinSet.has(key)) cls = 'builtin';
        else if (next === '(' || (L.macro && next === '!')) cls = 'func';
        else if (/^[A-Z][a-z]/.test(w) && !L.ci) cls = 'type';
        out += cls ? span(cls, w) : esc(w);
        i += w.length; continue;
      }
      out += esc(ch); i++;
    }
    return out;
  }

  /* ---------- CSS / SCSS ---------- */
  function css(src, scss) {
    let out = '';
    let i = 0;
    const n = src.length;
    let inValue = false;
    let paren = 0;
    while (i < n) {
      const ch = src[i];
      const rest = src.slice(i);
      if (ch === '(') paren++;
      if (ch === ')') paren = Math.max(0, paren - 1);
      if (rest.startsWith('/*')) {
        let e = src.indexOf('*/', i + 2); e = e < 0 ? n : e + 2;
        out += span('comment', src.slice(i, e)); i = e; continue;
      }
      if (scss && rest.startsWith('//') && src[i - 1] !== ':') {
        let e = src.indexOf('\n', i); if (e < 0) e = n;
        out += span('comment', src.slice(i, e)); i = e; continue;
      }
      if (ch === '"' || ch === "'") {
        let j = i + 1;
        while (j < n && src[j] !== ch && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
        j = Math.min(j + 1, n);
        out += span('string', src.slice(i, j)); i = j; continue;
      }
      if (ch === '{' || ch === '}' || ch === ';') { inValue = false; out += ch; i++; continue; }
      if (ch === '@') {
        const m = /^@[\w-]+/.exec(rest);
        if (m) { out += span('keyword', m[0]); i += m[0].length; continue; }
      }
      if ((ch === '$' && scss) || (ch === '-' && src[i + 1] === '-')) {
        const m = /^(\$|--)[\w-]+/.exec(rest);
        if (m) {
          out += span('var', m[0]);
          i += m[0].length;
          // $var: / --var: ที่ประกาศค่า -> ต่อด้วยโหมดค่า
          const colon = !inValue && /^\s*:/.exec(src.slice(i));
          if (colon) { out += colon[0]; i += colon[0].length; inValue = true; }
          continue;
        }
      }
      if (inValue) {
        let m;
        if ((m = /^!important/i.exec(rest))) { out += span('keyword', m[0]); i += m[0].length; continue; }
        if ((m = /^#[\da-f]{3,8}\b/i.exec(rest))) { out += span('number', m[0]); i += m[0].length; continue; }
        if ((m = /^-?(\d*\.)?\d+(px|em|rem|%|vh|vw|vmin|vmax|ch|ex|s|ms|deg|rad|turn|fr|dpi|dppx|pt|cm|mm|in)?/i.exec(rest)) && !/[\w-]/.test(src[i - 1] || '')) {
          out += span('number', m[0]); i += m[0].length; continue;
        }
        if ((m = /^[A-Za-z_-][\w-]*/.exec(rest))) {
          out += span(src[i + m[0].length] === '(' ? 'func' : 'lit', m[0]); i += m[0].length; continue;
        }
        out += esc(ch); i++; continue;
      }
      // นอกค่า: แยก selector กับ property ด้วยการดูว่าเจอ { หรือ ; ก่อน
      const stop = rest.search(/[{};]/);
      const isSelector = stop >= 0 && rest[stop] === '{';
      if (!isSelector || paren > 0) {
        const m = /^([\w-]+)(\s*)(:)(?!:)/.exec(rest);
        if (m) {
          out += span('attr', m[1]) + m[2] + ':'; i += m[0].length; inValue = true; continue;
        }
      }
      let m;
      if ((m = /^[.#][\w-]+/.exec(rest))) { out += span('type', m[0]); i += m[0].length; continue; }
      if ((m = /^::?[\w-]+/.exec(rest))) { out += span('keyword', m[0]); i += m[0].length; continue; }
      if ((m = /^\[[^\]\n]*\]/.exec(rest))) { out += span('attr', m[0]); i += m[0].length; continue; }
      if ((m = /^&/.exec(rest))) { out += span('keyword', '&'); i++; continue; }
      if ((m = /^\d+(\.\d+)?(%|[a-z]+)?/i.exec(rest)) && !/[\w-]/.test(src[i - 1] || '')) { out += span('number', m[0]); i += m[0].length; continue; }
      if ((m = /^[A-Za-z][\w-]*/.exec(rest))) { out += span('tag', m[0]); i += m[0].length; continue; }
      out += esc(ch); i++;
    }
    return out;
  }

  /* ---------- HTML / XML (รวม <style> และ <script> ข้างใน) ---------- */
  function tags(src) {
    return src.replace(/(<!--[\s\S]*?(?:-->|$))|(<![^>]*>|<\?[\s\S]*?\?>)|(<\/?)([\w:.-]+)([^>]*?)(\/?>|$)|(&[#\w]+;)|([^<&]+|[<&])/g,
      (m, comment, decl, open, tag, attrs, close, entity, text) => {
        if (comment) return span('comment', comment);
        if (decl) return span('meta', decl);
        if (tag) {
          const a = attrs.replace(/([^\s=]+)(\s*=\s*)?("[^"]*"?|'[^']*'?|[^\s"'>]+)?|(\s+)/g,
            (mm, name, eq, val, ws) => ws ? ws
              : span('attr', name) + (eq ? esc(eq) : '') + (val ? span('string', val) : ''));
          return esc(open) + span('tag', tag) + a + esc(close);
        }
        if (entity) return span('lit', entity);
        return esc(text);
      });
  }

  function markup(src) {
    let out = '';
    let last = 0;
    const re = /(<(style|script)\b[^>]*>)([\s\S]*?)(<\/\2\s*>|$)/gi;
    let m;
    while ((m = re.exec(src))) {
      const inner = m[2].toLowerCase() === 'style' ? css(m[3]) : generic(m[3], LANGS.javascript);
      out += tags(src.slice(last, m.index)) + tags(m[1]) + inner + tags(m[4]);
      last = re.lastIndex;
      if (last >= src.length) break;
    }
    return out + tags(src.slice(last));
  }

  /* ---------- YAML ---------- */
  function yaml(src) {
    return src.split('\n').map(line => {
      let body = line;
      let comment = '';
      const ci = line.search(/(^|\s)#/);
      if (ci >= 0) { comment = line.slice(ci); body = line.slice(0, ci); }
      let out = '';
      const km = /^(\s*)(- )?([^\s:#][^:#]*?|"[^"]*"|'[^']*')(:)(\s|$)/.exec(body);
      let rest = body;
      if (km) {
        out += km[1] + (km[2] ? span('keyword', '-') + ' ' : '') + span('attr', km[3]) + ':' + km[5];
        rest = body.slice(km[0].length);
      } else {
        const lm = /^(\s*)(- )/.exec(body);
        if (lm) { out += lm[1] + span('keyword', '-') + ' '; rest = body.slice(lm[0].length); }
      }
      const v = rest.trim();
      if (/^(["']).*\1$/.test(v)) out += rest.replace(v, '') === '' ? span('string', rest) : esc(rest.slice(0, rest.indexOf(v))) + span('string', v);
      else if (/^(true|false|yes|no|on|off|null|~)$/i.test(v)) out += esc(rest.slice(0, rest.indexOf(v))) + span('lit', v);
      else if (/^-?\d+(\.\d+)?$/.test(v)) out += esc(rest.slice(0, rest.indexOf(v))) + span('number', v);
      else if (/^[&*!][\w-]+/.test(v)) out += esc(rest.slice(0, rest.indexOf(v))) + span('meta', v);
      else out += esc(rest);
      return out + span('comment', comment);
    }).join('\n');
  }

  /* ---------- Markdown ---------- */
  function mdInline(s) {
    return s.replace(/(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\[[^\]\n]*\]\([^)\n]*\))|([^`*_[]+|[`*_[])/g,
      (m, code, bold, link, text) => {
        if (code) return span('string', code);
        if (bold) return span('bold', bold);
        if (link) {
          const k = link.indexOf('](');
          return span('func', link.slice(0, k + 1)) + span('string', link.slice(k + 1));
        }
        return esc(text);
      });
  }
  function markdown(src) {
    let fence = false;
    return src.split('\n').map(line => {
      if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return span('meta', line); }
      if (fence) return span('string', line);
      if (/^#{1,6}\s/.test(line)) return span('keyword', line);
      if (/^\s*>/.test(line)) return span('comment', line);
      if (/^\s*([-*_]\s*){3,}$/.test(line)) return span('meta', line);
      const lm = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?/.exec(line);
      if (lm) return lm[1] + span('keyword', lm[2]) + lm[3] + span('lit', lm[4] || '') + mdInline(line.slice(lm[0].length));
      return mdInline(line);
    }).join('\n');
  }

  function code(src, lang) {
    const L = LANGS[lang];
    if (!L || lang === 'plain') return esc(src);
    if (L.mode === 'markup') return markup(src);
    if (L.mode === 'css') return css(src, !!L.scss);
    if (L.mode === 'yaml') return yaml(src);
    if (L.mode === 'markdown') return markdown(src);
    return generic(src, L);
  }

  /* เดาภาษาจากเนื้อหาโค้ด (ใช้ตอนวางโค้ด / ตอนออกจากบล็อกที่ยังเป็น Plain text) */
  function guess(src) {
    const s = src.slice(0, 3000);
    const t = s.trim();
    if (/^[{[]/.test(t) && /"\s*:/.test(s) && !/;\s*$/m.test(s)) { try { JSON.parse(t); return 'json'; } catch (e) { /* not json */ } }
    if (/<\?php/.test(s)) return 'php';
    if (/^<\?xml|^<svg[\s>]/i.test(t)) return 'xml';
    if (/^<(!doctype|html|head|body|div|span|p|a|ul|section|main|button|form|template|script|style|img|link|meta|h[1-6])[\s>/]/i.test(t)) return 'html';
    if (/using System|Console\.Write|namespace [\w.]+\s*[{;]|\bpublic (partial )?(class|record)\b[\s\S]*\{\s*get;|\bstring\[\] args/.test(s)) return 'csharp';
    if (/#include\s*<(iostream|vector|string|map|memory|algorithm)>|std::|\bcout\s*<<|\bnamespace \w+\s*\{|template\s*</.test(s)) return 'cpp';
    if (/#include\s*[<"]|\bprintf\s*\(|\bint main\s*\(/.test(s)) return 'c';
    if (/System\.out\.|public static void main\s*\(String|import java\./.test(s)) return 'java';
    if (/\bfun \w+\s*\(|\bval \w+\s*[:=]|println\(/.test(s) && !/;\s*$/m.test(s)) return 'kotlin';
    if (/void main\s*\(\)|Widget build|import 'package:/.test(s)) return 'dart';
    if (/^\s*package \w+|\bfunc \w+\s*\(.*\)\s*[\w{(]|:= /m.test(s) && !/\bimport (UIKit|SwiftUI|Foundation)/.test(s)) return 'go';
    if (/\bfn \w+\s*\(|\blet mut\b|println!\(|impl\b/.test(s)) return 'rust';
    if (/\bimport (UIKit|SwiftUI|Foundation)|\bfunc \w+\s*\(|\bguard let\b|\bvar \w+\s*:\s*[A-Z]/.test(s)) return 'swift';
    if (/^\s*(def |class \w+(\(.*\))?:|import \w+|from [\w.]+ import|if __name__)/m.test(s) && !/[{};]\s*$/m.test(s) && !/\bend\s*$/m.test(s)) return 'python';
    if (/^\s*(def \w+|class \w+|module \w+)[\s\S]*^\s*end\s*$/m.test(s) || /\bputs\b/.test(s)) return 'ruby';
    if (/\blocal \w+\s*=|\bfunction\b[\s\S]*\bend\b/.test(s) && !/[{};]\s*$/m.test(s)) return 'lua';
    if (/\b(select|insert into|create table|update|delete from|alter table)\b[\s\S]*\b(from|values|set|where|\()/i.test(s)) return 'sql';
    if (/^\s*(export\s+)?(interface|type|enum)\s+\w+|:\s*(string|number|boolean|any)[^;{]*[;,)=]/m.test(s) && !/^\s*[.#@][\w-]/m.test(s)) return 'typescript';
    if (/\$[\w-]+\s*:|@mixin|@include|&:\w/.test(s) && /\{/.test(s)) return 'scss';
    if (/^\s*[.#:@]?[\w-][\w\s.#:>+~[\]="'(),*-]*\{[\s\S]*:[\s\S]*\}/m.test(s) && !/\b(function|const|let|var|return)\b|=>/.test(s)) return 'css';
    if (/^#{1,6}\s\S|^\s*[-*] \[[ x]\]|\]\(https?:/m.test(s) && !/[;{}]\s*$/m.test(s)) return 'markdown';
    if (/^\s*#!\/(usr\/)?bin\/(env )?(ba|z)?sh|^\s*(sudo|apt|apt-get|npm|npx|cd|echo|export|git|curl) /m.test(s)) return 'bash';
    if (/\$\w+\s*=|\b(Get|Set|New|Remove|Write)-\w+/.test(s)) return 'powershell';
    if (/^[\w-]+:\s*(\S.*)?$/m.test(s) && !/[;{}()]\s*$/m.test(s) && s.split('\n').filter(l => /^\s*[\w-]+:/.test(l)).length >= 2) return 'yaml';
    if (/:\s*(string|number|boolean|any)\b|\binterface \w+|\btype \w+\s*=|<\w+>\(/.test(s)) return 'typescript';
    if (/\b(const|let|var|function)\b|=>|console\./.test(s)) return 'javascript';
    return null;
  }

  return { LANGS, code, guess, esc };
})();
