/* 划词白话。
 * 交互参考划词词典（Saladict 一类）：选中文字后在选区旁弹出解释。
 * 定位参考 Floating UI 的 flip + shift：优先放在选区下方，放不下就翻到上方，并平移进视口。
 * 词库是站内静态数据，选中的文字不会发到任何服务器。
 */
(function () {
  var POP_ID = "dl-glossary-pop";
  var MAX_LEN = 40;

  function norm(s) {
    return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function buildIndex() {
    var list = [];
    (window.DL_GLOSSARY || []).forEach(function (row) {
      var aliases = String(row[0]).split("|").map(norm).filter(Boolean);
      aliases.sort(function (a, b) { return b.length - a.length; });
      list.push({ aliases: aliases, plain: row[1], aka: row[2] || "" });
    });
    list.sort(function (a, b) { return b.aliases[0].length - a.aliases[0].length; });
    return list;
  }

  var INDEX = buildIndex();

  function lookup(raw) {
    var text = norm(raw);
    if (!text || text.length > MAX_LEN) return null;
    var i, j, item, alias;
    for (i = 0; i < INDEX.length; i++) {
      item = INDEX[i];
      for (j = 0; j < item.aliases.length; j++) {
        if (item.aliases[j] === text) return item;
      }
    }
    var best = null;
    var bestLen = 0;
    for (i = 0; i < INDEX.length; i++) {
      item = INDEX[i];
      for (j = 0; j < item.aliases.length; j++) {
        alias = item.aliases[j];
        if (alias.length < 2) continue;
        if (text.indexOf(alias) !== -1 && alias.length > bestLen) {
          best = item;
          bestLen = alias.length;
        }
      }
    }
    return best;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensurePop() {
    var pop = document.getElementById(POP_ID);
    if (pop) return pop;
    pop = document.createElement("div");
    pop.id = POP_ID;
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-live", "polite");
    pop.hidden = true;
    pop.innerHTML =
      '<div class="dl-g-kicker">白话</div>' +
      '<div class="dl-g-term"></div>' +
      '<div class="dl-g-aka"></div>' +
      '<div class="dl-g-plain"></div>' +
      '<div class="dl-g-foot">词库内解释，不会上传选中的文字</div>';
    document.body.appendChild(pop);
    pop.addEventListener("mousedown", function (e) { e.stopPropagation(); });
    return pop;
  }

  function hide() {
    var pop = document.getElementById(POP_ID);
    if (pop) pop.hidden = true;
  }

  function place(pop, rect) {
    pop.hidden = false;
    pop.style.left = "0px";
    pop.style.top = "0px";
    var box = pop.getBoundingClientRect();
    var margin = 8;
    var left = rect.left + rect.width / 2 - box.width / 2;
    var top = rect.bottom + margin;
    if (top + box.height > window.innerHeight - margin) {
      top = rect.top - box.height - margin;
    }
    if (top < margin) top = margin;
    left = Math.max(margin, Math.min(left, window.innerWidth - box.width - margin));
    pop.style.left = left + window.scrollX + "px";
    pop.style.top = top + window.scrollY + "px";
  }

  function show(raw, rect) {
    var item = lookup(raw);
    var pop = ensurePop();
    pop.querySelector(".dl-g-term").textContent = raw.trim();
    if (!item) {
      pop.querySelector(".dl-g-aka").hidden = true;
      pop.querySelector(".dl-g-plain").textContent =
        raw.trim().length > MAX_LEN
          ? "一次选一个词或短一点的术语，解释会准很多。"
          : "词库里还没有这个词。可以换一个更标准的术语，比如「注意力」「LoRA」「扩散模型」。";
    } else {
      var aka = pop.querySelector(".dl-g-aka");
      aka.hidden = !item.aka;
      aka.textContent = item.aka;
      pop.querySelector(".dl-g-plain").textContent = item.plain;
    }
    place(pop, rect);
  }

  function blocked(node) {
    if (!node) return true;
    var el = node.nodeType === 1 ? node : node.parentElement;
    if (!el || !el.closest) return true;
    return !!el.closest("pre, code, textarea, input, select, .md-search, #dl-glossary-pop, .md-header, .md-tabs, .md-sidebar");
  }

  function onSelect() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    var text = sel.toString();
    if (!text || !norm(text)) return;
    var range = sel.getRangeAt(0);
    if (blocked(range.startContainer) || blocked(range.endContainer)) return;
    var rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return;
    show(text, rect);
  }

  function markTerms(root) {
    if (!root || root.dataset.dlGlossaryMarked === "1") return;
    root.dataset.dlGlossaryMarked = "1";
    var aliasList = [];
    INDEX.forEach(function (item) {
      item.aliases.forEach(function (alias) {
        if (alias.length >= 2) aliasList.push(alias);
      });
    });
    aliasList.sort(function (a, b) { return b.length - a.length; });
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !norm(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        if (blocked(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var text = node.nodeValue;
      var lower = text.toLowerCase();
      var ranges = [];
      var shortOk = {
      llm: 1, cnn: 1, rnn: 1, lstm: 1, gru: 1, gan: 1, vae: 1, moe: 1,
      ssm: 1, gnn: 1, vit: 1, sgd: 1, adam: 1, lora: 1, ppo: 1, dpo: 1,
      rag: 1, sft: 1, bpe: 1, relu: 1, rope: 1, mlp: 1, ffn: 1, iou: 1,
      nms: 1, mse: 1, mcp: 1, vla: 1, rlhf: 1, cot: 1, qkv: 1, fp16: 1,
      bf16: 1, int8: 1, int4: 1, peft: 1, mlm: 1, qlora: 1, grpo: 1, mllm: 1
    };
    aliasList.forEach(function (alias) {
        var latin = /^[a-z0-9][a-z0-9 .+-]*$/.test(alias);
        if (latin && alias.length < 5 && !shortOk[alias]) return;
        var from = 0;
        while (from < lower.length) {
          var at = lower.indexOf(alias, from);
          if (at < 0) break;
          var end = at + alias.length;
          var overlap = ranges.some(function (r) { return !(end <= r[0] || at >= r[1]); });
          var boundaryOk = true;
          if (/^[a-z0-9]/.test(alias)) {
            var before = at > 0 ? lower.charAt(at - 1) : "";
            var after = end < lower.length ? lower.charAt(end) : "";
            if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) boundaryOk = false;
          }
          if (!overlap && boundaryOk) ranges.push([at, end]);
          from = at + alias.length;
        }
      });
      if (!ranges.length) return;
      ranges.sort(function (a, b) { return a[0] - b[0]; });
      var frag = document.createDocumentFragment();
      var cursor = 0;
      ranges.forEach(function (r) {
        if (r[0] > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, r[0])));
        var mark = document.createElement("span");
        mark.className = "dl-term";
        mark.textContent = text.slice(r[0], r[1]);
        frag.appendChild(mark);
        cursor = r[1];
      });
      if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  function init() {
    var article = document.querySelector(".md-content");
    if (article) markTerms(article);
  }

  if (typeof document$ !== "undefined" && document$.subscribe) {
    document$.subscribe(function () { init(); });
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  document.addEventListener("mouseup", function () {
    setTimeout(onSelect, 10);
  });
  document.addEventListener("keyup", function (e) {
    if (e.key === "Shift" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
      setTimeout(onSelect, 10);
    }
  });
  document.addEventListener("mousedown", function (e) {
    var pop = document.getElementById(POP_ID);
    if (!pop || pop.hidden) return;
    if (!pop.contains(e.target)) hide();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hide();
  });
  window.addEventListener("scroll", function () { hide(); }, true);
})();
