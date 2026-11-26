/* 划词后向 DeepSeek 请求解释，并把结果直接显示在本页。 */
(function () {
  var POP_ID = "dl-glossary-pop";
  var KEY_NAME = "dl-deepseek-key";
  var MAX_LEN = 80;
  var cache = Object.create(null);
  var requestId = 0;
  var controller = null;

  function norm(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function getKey() {
    try { return localStorage.getItem(KEY_NAME) || ""; }
    catch (e) { return ""; }
  }

  function setKey(value) {
    try {
      if (value) localStorage.setItem(KEY_NAME, value);
      else localStorage.removeItem(KEY_NAME);
    } catch (e) {}
  }

  function promptFor(term) {
    return "请用通俗中文解释这个词：「" + term + "」。它出现在一份深度学习笔记里。请说明它是什么、解决什么问题，以及和容易混淆的概念有什么差别。只给解释，尽量短。";
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
      '<div class="dl-g-plain"></div>' +
      '<form class="dl-g-key">' +
        '<p>解释会直接显示在这里。请填入你的 DeepSeek API Key，它只保存在这台浏览器，不会写进笔记网站。</p>' +
        '<input type="password" autocomplete="off" spellcheck="false" placeholder="sk-...">' +
        '<div class="dl-g-actions">' +
          '<button type="submit">保存并解释</button>' +
          '<a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer">获取 Key</a>' +
        '</div>' +
      '</form>' +
      '<button type="button" class="dl-g-change">更换 Key</button>';
    document.body.appendChild(pop);
    pop.addEventListener("mousedown", function (event) { event.stopPropagation(); });
    pop.querySelector("form").addEventListener("submit", function (event) {
      event.preventDefault();
      var value = norm(pop.querySelector("input").value);
      if (!value) return;
      setKey(value);
      if (pop._term && pop._rect) explain(pop._term, pop._rect);
    });
    pop.querySelector(".dl-g-change").addEventListener("click", function () {
      setKey("");
      delete cache[pop._term];
      showKeyForm(pop, "");
    });
    return pop;
  }

  function hide() {
    var pop = document.getElementById(POP_ID);
    if (pop) pop.hidden = true;
    if (controller) controller.abort();
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

  function showKeyForm(pop, message) {
    var form = pop.querySelector(".dl-g-key");
    var note = form.querySelector("p");
    pop.querySelector(".dl-g-plain").hidden = true;
    pop.querySelector(".dl-g-change").hidden = true;
    form.hidden = false;
    note.textContent = message || "解释会直接显示在这里。请填入你的 DeepSeek API Key，它只保存在这台浏览器，不会写进笔记网站。";
    place(pop, pop._rect);
  }

  function showAnswer(pop, text) {
    var plain = pop.querySelector(".dl-g-plain");
    pop.querySelector(".dl-g-key").hidden = true;
    pop.querySelector(".dl-g-change").hidden = !getKey();
    plain.hidden = false;
    plain.textContent = text;
    place(pop, pop._rect);
  }

  function explain(term, rect) {
    var pop = ensurePop();
    var id = ++requestId;
    if (controller) controller.abort();
    pop._term = term;
    pop._rect = rect;
    pop.querySelector(".dl-g-term").textContent = term;
    if (term.length > MAX_LEN) {
      pop.querySelector(".dl-g-key").hidden = true;
      pop.querySelector(".dl-g-change").hidden = true;
      showAnswer(pop, "请只选一个词或一句较短的术语。");
      pop.querySelector(".dl-g-change").hidden = true;
      return;
    }
    if (!getKey()) {
      showKeyForm(pop, "");
      return;
    }
    if (cache[term]) {
      showAnswer(pop, cache[term]);
      return;
    }
    showAnswer(pop, "正在让 DeepSeek 解释…");
    controller = new AbortController();
    fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getKey()
      },
      body: JSON.stringify({
        model: "deepseek-flash",
        messages: [
          { role: "system", content: "你给深度学习笔记里的术语写白话解释。只输出解释本身。" },
          { role: "user", content: promptFor(term) }
        ],
        thinking: { type: "disabled" },
        max_tokens: 500
      })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      });
    }).then(function (result) {
      if (id !== requestId) return;
      if (!result.ok) {
        var message = (result.data && result.data.error && result.data.error.message) || "";
        if (result.status === 401 || result.status === 403) {
          setKey("");
          showKeyForm(pop, "这个 Key 无法使用。请到 DeepSeek 开放平台重新复制一个。");
          return;
        }
        if (result.status === 402) {
          showAnswer(pop, "DeepSeek 账户余额不足，暂时无法解释。");
          return;
        }
        showAnswer(pop, message || "DeepSeek 没有返回解释。");
        return;
      }
      var message = result.data.choices && result.data.choices[0] && result.data.choices[0].message;
      var text = message && (message.content || "").trim();
      if (!text) {
        showAnswer(pop, "DeepSeek 没有返回解释。");
        return;
      }
      cache[term] = text;
      showAnswer(pop, text);
    }).catch(function (error) {
      if (id !== requestId || (error && error.name === "AbortError")) return;
      showAnswer(pop, "没有连上 DeepSeek。请检查网络后再选一次这个词。");
    });
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
    var text = norm(sel.toString());
    if (!text) return;
    var range = sel.getRangeAt(0);
    if (blocked(range.startContainer) || blocked(range.endContainer)) return;
    var rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return;
    explain(text, rect);
  }

  document.addEventListener("mouseup", function (event) {
    if (event.target && event.target.closest && event.target.closest("#" + POP_ID)) return;
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
