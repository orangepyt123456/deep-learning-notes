/* 计算机与 AI 核心文献图谱 — Arbor 风格布局与 3D 树 */
(function () {
  var ROOT_ID = "dl-atlas-root";
  var THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js";
  var ORBIT_URL = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js";

  function ready(fn) {
    if (typeof document$ !== "undefined" && document$.subscribe) {
      document$.subscribe(fn);
      return;
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-dl-atlas-src="' + url + '"]');
      if (existing) {
        if (existing.dataset.loaded === "1") resolve();
        else existing.addEventListener("load", resolve, { once: true });
        return;
      }
      var s = document.createElement("script");
      s.src = url;
      s.dataset.dlAtlasSrc = url;
      s.onload = function () {
        s.dataset.loaded = "1";
        resolve();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function ensureThree() {
    return loadScript(THREE_URL).then(function () {
      if (typeof THREE.OrbitControls !== "undefined") return;
      return loadScript(ORBIT_URL);
    });
  }

  function catMap(data) {
    var m = Object.create(null);
    data.categories.forEach(function (c) { m[c.id] = c; });
    return m;
  }

  function hexToNum(hex) {
    if (!hex) return 0x7ed9b5;
    var h = String(hex).replace("#", "");
    return parseInt(h, 16);
  }

  function filteredPapers(state, data) {
    var q = state.query.trim().toLowerCase();
    return data.papers.filter(function (p) {
      if (state.branch !== "all" && p.cat !== state.branch) return false;
      if (p.year < state.yearMin || p.year > state.yearMax) return false;
      if (!q) return true;
      var hay = (p.title + " " + p.authors).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function yearToHeight(year, minY, maxY) {
    var t = (year - minY) / Math.max(1, maxY - minY);
    return t * 22 + 0.5;
  }

  function escapeHtml(s) {
    return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function shortTitle(t) {
    if (!t) return "";
    return t.length > 42 ? t.slice(0, 39) + "…" : t;
  }

  function initAtlas(root) {
    if (root.dataset.dlAtlasInit === "1") return;
    root.dataset.dlAtlasInit = "1";
    document.body.classList.add("dl-atlas-active");

    var data = window.DL_ATLAS;
    if (!data) return;
    var cats = catMap(data);
    var state = {
      branch: "all",
      tab: "tree",
      query: "",
      yearMin: 1958,
      yearMax: 2025,
      showLabels: true,
      autoOrbit: true,
      sculpture: "arbor",
      selected: null,
      userOrbiting: false
    };

    var branchHost = root.querySelector(".dl-atlas-branch-list");
    var statBranches = root.querySelector(".dl-atlas-stat-branches");
    var statPapers = root.querySelector(".dl-atlas-stat-papers");
    var nodeCount = root.querySelector(".dl-atlas-node-count");
    var overviewPanel = root.querySelector(".dl-atlas-overview-detail");
    var nodePanel = root.querySelector(".dl-atlas-node-detail");
    var detailTitle = root.querySelector(".dl-atlas-detail-title");
    var detailAuthors = root.querySelector(".dl-atlas-detail-authors");
    var detailDomain = root.querySelector(".dl-atlas-detail-domain");
    var detailNote = root.querySelector(".dl-atlas-detail-note");
    var paperTags = root.querySelector(".dl-atlas-paper-tags");
    var search = root.querySelector(".dl-atlas-search");
    var yearMin = root.querySelector(".dl-atlas-year-min");
    var yearMax = root.querySelector(".dl-atlas-year-max");
    var yearMinSel = root.querySelector(".dl-atlas-year-min-sel");
    var yearMaxSel = root.querySelector(".dl-atlas-year-max-sel");
    var histogram = root.querySelector(".dl-atlas-histogram");
    var domains = root.querySelector(".dl-atlas-domains");
    var indexHost = root.querySelector(".dl-atlas-paper-index");
    var canvas = root.querySelector(".dl-atlas-canvas");
    var sculptureHost = root.querySelector(".dl-atlas-sculpture-host");
    var timeline = root.querySelector(".dl-atlas-timeline");
    var hoverCard = root.querySelector(".dl-atlas-hover-card");
    var hoverYear = root.querySelector(".dl-atlas-hover-year");
    var hoverTitle = root.querySelector(".dl-atlas-hover-title");
    var hoverAuthors = root.querySelector(".dl-atlas-hover-authors");
    var hoverBranch = root.querySelector(".dl-atlas-hover-branch");

    statBranches.textContent = String(data.categories.length);
    statPapers.textContent = String(data.papers.length);

    function fillYearSelects() {
      var opts = "";
      for (var y = 1958; y <= 2025; y++) {
        opts += '<option value="' + y + '">' + y + "</option>";
      }
      yearMinSel.innerHTML = opts;
      yearMaxSel.innerHTML = opts;
      yearMinSel.value = String(state.yearMin);
      yearMaxSel.value = String(state.yearMax);
    }
    fillYearSelects();

    function branchBtn(id, name, en, color, count, active) {
      return (
        '<button type="button" class="dl-atlas-branch' + (active ? " is-active" : "") + '" data-branch="' + id + '">' +
        '<span class="dl-atlas-dot" style="background:' + color + '"></span>' +
        '<span class="dl-atlas-branch-text">' +
        '<span class="dl-atlas-branch-name">' + name + "</span>" +
        '<span class="dl-atlas-branch-en">' + en + "</span>" +
        "</span>" +
        '<span class="dl-atlas-branch-count">' + count + "</span>" +
        "</button>"
      );
    }

    function filteredCount(branch) {
      var old = state.branch;
      state.branch = branch;
      var n = filteredPapers(state, data).length;
      state.branch = old;
      return n;
    }

    function renderBranches() {
      var html = "";
      html += branchBtn("all", "全部分支", "ALL", "#2d6a4f", filteredCount("all"), state.branch === "all");
      data.categories.forEach(function (c) {
        html += branchBtn(c.id, c.name, c.en, c.color, filteredCount(c.id), state.branch === c.id);
      });
      branchHost.innerHTML = html;
      branchHost.querySelectorAll(".dl-atlas-branch").forEach(function (btn) {
        btn.addEventListener("click", function () {
          state.branch = btn.dataset.branch;
          state.selected = null;
          updateDetail(null);
          refresh();
        });
      });
    }

    function renderHistogram() {
      var counts = Object.create(null);
      for (var y = 1958; y <= 2025; y++) counts[y] = 0;
      data.papers.forEach(function (p) {
        if (state.branch !== "all" && p.cat !== state.branch) return;
        counts[p.year] = (counts[p.year] || 0) + 1;
      });
      var max = 1;
      Object.keys(counts).forEach(function (k) { max = Math.max(max, counts[k]); });
      var bars = "";
      for (var y2 = 1958; y2 <= 2025; y2++) {
        var h = Math.round((counts[y2] / max) * 100);
        var dim = y2 < state.yearMin || y2 > state.yearMax ? " dim" : "";
        bars += '<div class="dl-atlas-hist-bar' + dim + '" style="height:' + Math.max(4, h) + '%" title="' + y2 + ': ' + counts[y2] + '"></div>';
      }
      histogram.innerHTML = bars;
    }

    function renderDomains() {
      domains.innerHTML = data.categories.map(function (c) {
        var n = data.papers.filter(function (p) { return p.cat === c.id; }).length;
        var blurb = (data.blurbs && data.blurbs[c.id]) || "";
        return (
          '<div class="dl-atlas-domain">' +
          '<h3><span class="dl-atlas-dot" style="background:' + c.color + ';display:inline-block;margin-right:.35rem;vertical-align:middle"></span>' +
          c.name + " · " + c.en + "</h3>" +
          '<p>' + blurb + "</p>" +
          '<div class="dl-atlas-domain-meta">' + n + " 篇核心文献</div>" +
          "</div>"
        );
      }).join("");
    }

    function renderIndex(papers) {
      indexHost.innerHTML =
        "<table><thead><tr><th>Year</th><th>Title</th><th>Authors</th><th>Branch</th></tr></thead><tbody>" +
        papers.map(function (p) {
          var c = cats[p.cat];
          var sel = state.selected && state.selected.id === p.id ? " is-sel" : "";
          return (
            "<tr class=\"" + sel + "\" data-pid=\"" + p.id + "\">" +
            "<td>" + p.year + "</td>" +
            "<td>" + escapeHtml(p.title) + "</td>" +
            "<td>" + escapeHtml(p.authors) + "</td>" +
            "<td>" + (c ? c.name : "") + "</td>" +
            "</tr>"
          );
        }).join("") +
        "</tbody></table>";
      indexHost.querySelectorAll("tr[data-pid]").forEach(function (row) {
        row.addEventListener("click", function () {
          var paper = data.papers.find(function (x) { return x.id === row.dataset.pid; });
          selectPaper(paper);
          setTab("tree");
        });
      });
    }

    function updateDetail(paper) {
      if (!paper) {
        overviewPanel.hidden = false;
        nodePanel.hidden = true;
        return;
      }
      overviewPanel.hidden = true;
      nodePanel.hidden = false;
      var c = cats[paper.cat];
      detailTitle.textContent = paper.title;
      detailAuthors.textContent = paper.year + " · " + paper.authors;
      detailDomain.textContent = c ? c.name + " / " + c.en : "";
      paperTags.innerHTML = "<span>" + paper.year + "</span>" + (c ? '<span style="border-color:' + c.color + '">' + c.code + "</span>" : "");
      detailNote.textContent = paper.source === "笔记"
        ? "这篇文献已在当前深度学习笔记正文或参考文献中出现。"
        : "作为计算机与人工智能领域的核心论文纳入图谱，可按分支与时间浏览。";
    }

    function selectPaper(paper) {
      state.selected = paper;
      updateDetail(paper);
      if (sceneApi) sceneApi.highlight(paper && paper.id);
    }

    function setTab(tab) {
      state.tab = tab;
      root.querySelectorAll(".dl-atlas-tab").forEach(function (t) {
        t.classList.toggle("is-active", t.dataset.tab === tab);
      });
      root.querySelectorAll(".dl-atlas-panel").forEach(function (p) {
        p.classList.toggle("is-active", p.dataset.panel === tab);
      });
      if (tab === "index") {
        root.querySelector('.dl-atlas-panel[data-panel="index"]').classList.add("is-active");
      }
      refresh();
    }

    function syncYearsFromSliders() {
      state.yearMin = Math.min(Number(yearMin.value), state.yearMax);
      state.yearMax = Math.max(Number(yearMax.value), state.yearMin);
      yearMinSel.value = String(state.yearMin);
      yearMaxSel.value = String(state.yearMax);
    }

    root.querySelectorAll(".dl-atlas-tab").forEach(function (t) {
      t.addEventListener("click", function () { setTab(t.dataset.tab); });
    });
    root.querySelector(".dl-atlas-index-open").addEventListener("click", function () {
      setTab("index");
    });
    search.addEventListener("input", function () {
      state.query = search.value;
      refresh();
    });
    yearMin.addEventListener("input", function () {
      if (Number(yearMin.value) > state.yearMax) yearMin.value = String(state.yearMax);
      syncYearsFromSliders();
      refresh();
    });
    yearMax.addEventListener("input", function () {
      if (Number(yearMax.value) < state.yearMin) yearMax.value = String(state.yearMin);
      syncYearsFromSliders();
      refresh();
    });
    yearMinSel.addEventListener("change", function () {
      state.yearMin = Math.min(Number(yearMinSel.value), state.yearMax);
      yearMin.value = String(state.yearMin);
      refresh();
    });
    yearMaxSel.addEventListener("change", function () {
      state.yearMax = Math.max(Number(yearMaxSel.value), state.yearMin);
      yearMax.value = String(state.yearMax);
      refresh();
    });
    root.querySelector(".dl-atlas-all-time").addEventListener("click", function () {
      state.yearMin = 1958;
      state.yearMax = 2025;
      yearMin.value = "1958";
      yearMax.value = "2025";
      yearMinSel.value = "1958";
      yearMaxSel.value = "2025";
      refresh();
    });

    var labelsBtn = root.querySelector(".dl-atlas-labels");
    labelsBtn.addEventListener("click", function () {
      state.showLabels = !state.showLabels;
      labelsBtn.classList.toggle("is-on", state.showLabels);
      labelsBtn.setAttribute("aria-pressed", state.showLabels ? "true" : "false");
      if (sceneApi) sceneApi.syncLabels();
    });

    var orbitBtn = root.querySelector(".dl-atlas-orbit");
    orbitBtn.addEventListener("click", function () {
      state.autoOrbit = !state.autoOrbit;
      orbitBtn.classList.toggle("is-on", state.autoOrbit);
      orbitBtn.setAttribute("aria-pressed", state.autoOrbit ? "true" : "false");
    });

    root.querySelectorAll(".dl-atlas-sculpture").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.sculpture = btn.dataset.mode;
        root.querySelectorAll(".dl-atlas-sculpture").forEach(function (b) {
          b.classList.toggle("is-on", b.dataset.mode === state.sculpture);
        });
        refresh();
      });
    });

    root.querySelector(".dl-atlas-immersive").addEventListener("click", function () {
      document.body.classList.toggle("dl-atlas-immersive");
    });

    root.querySelector(".dl-atlas-detail-close").addEventListener("click", function () {
      state.selected = null;
      updateDetail(null);
      if (sceneApi) sceneApi.highlight(null);
    });

    root.querySelector('[data-crumb="overview"]').addEventListener("click", function () {
      state.selected = null;
      updateDetail(null);
      if (sceneApi) sceneApi.highlight(null);
    });

    var sceneApi = null;

    function refresh() {
      var papers = filteredPapers(state, data);
      renderBranches();
      renderHistogram();
      nodeCount.textContent = papers.length + " / " + data.papers.length + " nodes";
      renderIndex(papers);
      if (sceneApi) sceneApi.rebuild(papers);
      if (state.tab === "timeline") drawTimeline(papers);
    }

    function drawTimeline(papers) {
      if (!timeline) return;
      var ctx = timeline.getContext("2d");
      var dpr = window.devicePixelRatio || 1;
      var w = timeline.clientWidth;
      var h = timeline.clientHeight;
      if (w < 1) return;
      timeline.width = Math.floor(w * dpr);
      timeline.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var muted = "rgba(26,31,28,.45)";
      var border = "rgba(26,31,28,.12)";
      var bg = "rgba(255,255,255,.5)";
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      var minY = state.yearMin;
      var maxY = state.yearMax;
      var padL = 56;
      var padR = 16;
      var padT = 28;
      var padB = 32;
      var laneH = Math.max(12, (h - padT - padB) / data.categories.length);

      ctx.strokeStyle = border;
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, h - padB);
      ctx.lineTo(w - padR, h - padB);
      ctx.stroke();

      for (var y = minY; y <= maxY; y += 5) {
        var x = padL + ((y - minY) / Math.max(1, maxY - minY)) * (w - padL - padR);
        ctx.fillStyle = muted;
        ctx.font = "10px DM Sans, sans-serif";
        ctx.fillText(String(y), x - 10, h - padB + 18);
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, h - padB);
        ctx.strokeStyle = y % 10 === 0 ? "rgba(26,31,28,.08)" : "rgba(26,31,28,.04)";
        ctx.stroke();
      }

      data.categories.forEach(function (c, i) {
        var y0 = padT + i * laneH + laneH / 2;
        ctx.fillStyle = muted;
        ctx.font = "600 11px DM Sans, sans-serif";
        ctx.fillText(c.code, 10, y0 + 4);
        var branchPapers = papers.filter(function (p) { return p.cat === c.id; });
        branchPapers.forEach(function (p, j) {
          var x = padL + ((p.year - minY) / Math.max(1, maxY - minY)) * (w - padL - padR);
          var yy = y0 + ((j % 5) - 2) * 4;
          var sel = state.selected && state.selected.id === p.id;
          ctx.fillStyle = c.color;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(x, yy, sel ? 5.5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      });
    }

    function initScene() {
      var labelLayer = document.createElement("div");
      labelLayer.className = "dl-atlas-label-layer";
      sculptureHost.appendChild(labelLayer);

      var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      var scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0xf4f5f2, 0.018);

      var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
      camera.position.set(26, 14, 26);

      var controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.target.set(0, 11, 0);
      controls.maxPolarAngle = Math.PI * 0.47;
      controls.minDistance = 10;
      controls.maxDistance = 70;
      controls.addEventListener("start", function () {
        state.userOrbiting = true;
        state.autoOrbit = false;
        orbitBtn.classList.remove("is-on");
      });

      var decor = new THREE.Group();
      scene.add(decor);
      for (var ri = 1; ri <= 4; ri++) {
        var ring = new THREE.Mesh(
          new THREE.RingGeometry(ri * 2.2, ri * 2.2 + 0.02, 64),
          new THREE.MeshBasicMaterial({ color: 0x2d6a4f, transparent: true, opacity: 0.06, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        decor.add(ring);
      }

      var rootGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x52b788, emissive: 0x2d6a4f, emissiveIntensity: 0.4 })
      );
      rootGlow.position.set(0, 0.2, 0);
      scene.add(rootGlow);

      scene.add(new THREE.AmbientLight(0xf4f5f2, 0.75));
      var dir = new THREE.DirectionalLight(0xffffff, 0.9);
      dir.position.set(12, 28, 16);
      scene.add(dir);
      var fill = new THREE.DirectionalLight(0xb7e4c7, 0.35);
      fill.position.set(-14, 8, -10);
      scene.add(fill);

      var nodeGroup = new THREE.Group();
      var branchGroup = new THREE.Group();
      scene.add(branchGroup);
      scene.add(nodeGroup);

      var idToMesh = Object.create(null);
      var idToPaper = Object.create(null);
      var labelEls = Object.create(null);
      var raycaster = new THREE.Raycaster();
      var pointer = new THREE.Vector2();
      var highlighted = null;
      var hoverId = null;

      function resize() {
        var w = canvas.clientWidth;
        var h = canvas.clientHeight;
        if (w < 1 || h < 1) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }

      function clearGroup(g) {
        while (g.children.length) {
          var obj = g.children[0];
          g.remove(obj);
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(function (m) { m.dispose(); });
            else obj.material.dispose();
          }
        }
      }

      function branchCurve(angle, jitter) {
        var r0 = 0.4;
        var r1 = 5.5 + jitter;
        var r2 = 8 + jitter * 0.5;
        var y1 = 8;
        var y2 = 21;
        var pts = [
          new THREE.Vector3(0, 0.15, 0),
          new THREE.Vector3(Math.cos(angle) * r0, 2.5, Math.sin(angle) * r0),
          new THREE.Vector3(Math.cos(angle + 0.15) * r1, y1, Math.sin(angle + 0.15) * r1),
          new THREE.Vector3(Math.cos(angle - 0.08) * r2, y2, Math.sin(angle - 0.08) * r2)
        ];
        return new THREE.CatmullRomCurve3(pts);
      }

      function pointOnCurve(curve, t) {
        return curve.getPoint(Math.max(0, Math.min(1, t)));
      }

      function helixPos(year, index, total) {
        var minY = state.yearMin;
        var maxY = state.yearMax;
        var t = (year - minY) / Math.max(1, maxY - minY);
        var angle = t * Math.PI * 5 + (index / Math.max(1, total)) * 0.4;
        var rad = 3.5 + t * 6;
        return new THREE.Vector3(
          Math.cos(angle) * rad,
          yearToHeight(year, minY, maxY),
          Math.sin(angle) * rad
        );
      }

      function rebuild(papers) {
        clearGroup(nodeGroup);
        clearGroup(branchGroup);
        Object.keys(labelEls).forEach(function (id) {
          if (labelEls[id] && labelEls[id].parentNode) labelEls[id].parentNode.removeChild(labelEls[id]);
        });
        labelEls = Object.create(null);
        idToMesh = Object.create(null);
        idToPaper = Object.create(null);

        var nCat = data.categories.length;
        var curves = Object.create(null);

        data.categories.forEach(function (c, i) {
          var angle = (i / nCat) * Math.PI * 2 - Math.PI / 2;
          var jitter = (i % 3) * 0.35;
          var curve = branchCurve(angle, jitter);
          curves[c.id] = { curve: curve, angle: angle, color: hexToNum(c.color) };

          var tube = new THREE.TubeGeometry(curve, 64, 0.07, 8, false);
          var mat = new THREE.MeshStandardMaterial({
            color: hexToNum(c.color),
            transparent: true,
            opacity: 0.42,
            roughness: 0.65,
            metalness: 0.05
          });
          var mesh = new THREE.Mesh(tube, mat);
          branchGroup.add(mesh);

          var glowTube = new THREE.TubeGeometry(curve, 48, 0.14, 6, false);
          branchGroup.add(new THREE.Mesh(glowTube, new THREE.MeshBasicMaterial({
            color: hexToNum(c.color),
            transparent: true,
            opacity: 0.08
          })));
        });

        var perBranch = Object.create(null);
        papers.forEach(function (p) {
          perBranch[p.cat] = perBranch[p.cat] || [];
          perBranch[p.cat].push(p);
          idToPaper[p.id] = p;
        });

        Object.keys(perBranch).forEach(function (catId) {
          var meta = curves[catId];
          if (!meta) return;
          var items = perBranch[catId].slice().sort(function (a, b) { return a.year - b.year; });
          items.forEach(function (p, idx) {
            var pos;
            if (state.sculpture === "helix") {
              pos = helixPos(p.year, idx, items.length);
            } else {
              var minY = state.yearMin;
              var maxY = state.yearMax;
              var t = (p.year - minY) / Math.max(1, maxY - minY);
              t = 0.12 + t * 0.86;
              pos = pointOnCurve(meta.curve, t);
              var spread = (idx - items.length / 2) * 0.12;
              var tangent = meta.curve.getTangent(t).normalize();
              var side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
              pos.add(side.multiplyScalar(spread));
            }

            var recency = (p.year - 1958) / 67;
            var size = 0.11 + recency * 0.12;
            if (p.year >= 2020) size += 0.04;

            var mesh = new THREE.Mesh(
              new THREE.SphereGeometry(size, 14, 14),
              new THREE.MeshStandardMaterial({
                color: meta.color,
                emissive: meta.color,
                emissiveIntensity: 0.22,
                roughness: 0.35,
                metalness: 0.1
              })
            );
            mesh.position.copy(pos);
            mesh.userData.paperId = p.id;
            nodeGroup.add(mesh);
            idToMesh[p.id] = mesh;

            if (state.sculpture === "arbor") {
              var stemBase = pointOnCurve(meta.curve, Math.max(0.05, (p.year - state.yearMin) / Math.max(1, state.yearMax - state.yearMin) * 0.5));
              var stem = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([stemBase, pos]),
                new THREE.LineBasicMaterial({ color: meta.color, transparent: true, opacity: 0.28 })
              );
              nodeGroup.add(stem);
            }

            if (state.showLabels) {
              var el = document.createElement("div");
              el.className = "dl-atlas-node-label";
              el.textContent = shortTitle(p.title);
              el.dataset.pid = p.id;
              labelLayer.appendChild(el);
              labelEls[p.id] = el;
            }
          });
        });

        highlight(highlighted);
        syncLabels();
      }

      function highlight(paperId) {
        highlighted = paperId;
        Object.keys(idToMesh).forEach(function (id) {
          var mesh = idToMesh[id];
          var sel = id === paperId;
          mesh.material.emissiveIntensity = sel ? 0.65 : 0.22;
          mesh.scale.setScalar(sel ? 1.45 : 1);
        });
        if (labelEls[paperId]) {
          labelEls[paperId].style.fontWeight = "700";
        }
        Object.keys(labelEls).forEach(function (id) {
          if (id !== paperId && labelEls[id]) labelEls[id].style.fontWeight = "400";
        });
      }

      function syncLabels() {
        labelLayer.style.display = state.showLabels ? "" : "none";
      }

      function updateLabelPositions() {
        if (!state.showLabels || state.tab !== "tree") return;
        var w = canvas.clientWidth;
        var h = canvas.clientHeight;
        Object.keys(labelEls).forEach(function (id) {
          var mesh = idToMesh[id];
          var el = labelEls[id];
          if (!mesh || !el) return;
          var v = mesh.position.clone().project(camera);
          if (v.z > 1) {
            el.style.display = "none";
            return;
          }
          el.style.display = "";
          el.style.left = ((v.x + 1) / 2) * w + "px";
          el.style.top = ((-v.y + 1) / 2) * h + "px";
        });
      }

      function showHover(paper) {
        if (!paper) {
          hoverCard.hidden = true;
          return;
        }
        var c = cats[paper.cat];
        hoverCard.hidden = false;
        hoverYear.textContent = String(paper.year);
        hoverTitle.textContent = paper.title;
        hoverAuthors.textContent = paper.authors;
        hoverBranch.textContent = c ? c.code : "";
      }

      canvas.addEventListener("pointerdown", function (ev) {
        var rect = canvas.getBoundingClientRect();
        pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        var hits = raycaster.intersectObjects(nodeGroup.children, false);
        if (!hits.length) return;
        var id = hits[0].object.userData.paperId;
        if (!id) return;
        selectPaper(idToPaper[id] || data.papers.find(function (p) { return p.id === id; }));
      });

      canvas.addEventListener("pointermove", function (ev) {
        var rect = canvas.getBoundingClientRect();
        pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        var hits = raycaster.intersectObjects(nodeGroup.children, false);
        if (!hits.length) {
          if (hoverId) showHover(null);
          hoverId = null;
          canvas.style.cursor = "grab";
          return;
        }
        var id = hits[0].object.userData.paperId;
        if (id !== hoverId) {
          hoverId = id;
          showHover(idToPaper[id]);
        }
        canvas.style.cursor = "pointer";
      });

      var orbitT = 0.6;
      function tick() {
        requestAnimationFrame(tick);
        resize();
        if (state.autoOrbit && state.tab === "tree" && !state.userOrbiting) {
          orbitT += 0.0016;
          var dist = 34;
          camera.position.x = Math.cos(orbitT) * dist;
          camera.position.z = Math.sin(orbitT) * dist;
          camera.position.y = 13 + Math.sin(orbitT * 0.5) * 2;
          camera.lookAt(0, 11, 0);
        } else if (!state.autoOrbit) {
          controls.update();
        } else {
          controls.update();
        }
        renderer.render(scene, camera);
        updateLabelPositions();
      }
      tick();

      sceneApi = {
        rebuild: rebuild,
        highlight: highlight,
        syncLabels: syncLabels,
        zoom: function (factor) {
          camera.position.multiplyScalar(factor);
          controls.update();
        },
        reset: function () {
          state.userOrbiting = false;
          camera.position.set(26, 14, 26);
          controls.target.set(0, 11, 0);
          controls.update();
        }
      };
      rebuild(filteredPapers(state, data));
    }

    root.querySelector(".dl-atlas-zoom-in").addEventListener("click", function () {
      if (sceneApi) sceneApi.zoom(0.88);
    });
    root.querySelector(".dl-atlas-zoom-out").addEventListener("click", function () {
      if (sceneApi) sceneApi.zoom(1.14);
    });
    root.querySelector(".dl-atlas-reset").addEventListener("click", function () {
      if (sceneApi) sceneApi.reset();
    });

    renderDomains();
    ensureThree().then(initScene).catch(function () {
      nodeCount.textContent = "无法加载 3D 引擎";
    });
    refresh();
    window.addEventListener("resize", function () {
      if (state.tab === "timeline") drawTimeline(filteredPapers(state, data));
    });
  }

  ready(function () {
    var root = document.getElementById(ROOT_ID);
    if (root) initAtlas(root);
  });
})();