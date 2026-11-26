/* 划词后打开 DeepSeek，由 DeepSeek 解释选中的词。 */
(function () {
  var POP_ID = "dl-glossary-pop";
  var MAX_LEN = 80;

  function norm(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function promptFor(term) {
    return "请用通俗中文解释这个词：「" + term + "」。它出现在一份深度学习笔记里。请说明它是什么、解决什么问题，以及和容易混淆的概念有什么差别，尽量短。";
  }

  function deepseekUrl(term) {
    return "https://chat.deepseek.com/?q=" + encodeURIComponent(promptFor(term));
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
      '<div class="dl-g-kicker">DeepSeek</div>' +
      '<div class="dl-g-term"></div>' +
      '<p class="dl-g-plain">打开 DeepSeek 解释这个词。问题会复制到剪贴板；如果对话框是空的，粘贴后发送即可。</p>' +
      '<a class="dl-g-go" target="_blank" rel="noopener noreferrer">用 DeepSeek 解释</a>';
    document.body.appendChild(pop);
    pop.addEventListener("mousedown", function (event) { event.stopPropagation(); });
    pop.querySelector(".dl-g-go").addEventListener("click", function () {
      var prompt = pop.dataset.prompt || "";
      if (navigator.clipboard && navigator.clipboard.writeText && prompt) {
        navigator.clipboard.writeText(prompt).catch(function () {});
      }
    });
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
    var term = norm(raw);
    var pop = ensurePop();
    var link = pop.querySelector(".dl-g-go");
    var note = pop.querySelector(".dl-g-plain");
    pop.querySelector(".dl-g-term").textContent = term;
    if (term.length > MAX_LEN) {
      pop.dataset.prompt = "";
      link.hidden = true;
      note.textContent = "请只选一个词或一句较短的术语，再交给 DeepSeek。";
    } else {
      var prompt = promptFor(term);
      pop.dataset.prompt = prompt;
      link.hidden = false;
      link.href = deepseekUrl(term);
      note.textContent = "打开 DeepSeek 解释这个词。问题会复制到剪贴板；如果对话框是空的，粘贴后发送即可。";
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
    if (!norm(text)) return;
    var range = sel.getRangeAt(0);
    if (blocked(range.startContainer) || blocked(range.endContainer)) return;
    var rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return;
    show(text, rect);
  }

  document.addEventListener("mouseup", function () {
    setTimeout(onSelect, 10);
  });
  document.addEventListener("keyup", function (event) {
    if (event.key === "Shift" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
      setTimeout(onSelect, 10);
    }
  });
  document.addEventListener("mousedown", function (event) {
    var pop = document.getElementById(POP_ID);
    if (!pop || pop.hidden) return;
    if (!pop.contains(event.target)) hide();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") hide();
  });
  window.addEventListener("scroll", function () { hide(); }, true);
})();
