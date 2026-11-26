/* 计算机与 AI 核心文献图谱：复刻 Arbor Atlas 交互，数据来自 window.DL_ATLAS。 */
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

  function yearToY(year, minY, maxY) {
    var t = (year - minY) / Math.max(1, maxY - minY);
    return t * 18 + 1;
  }

  function initAtlas(root) {
    if (root.dataset.dlAtlasInit === "1") return;
    root.dataset.dlAtlasInit = "1";
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
      selected: null
    };

    var branchHost = root.querySelector(".dl-atlas-branch-list");
    var statBranches = root.querySelector(".dl-atlas-stat-branches");
    var statPapers = root.querySelector(".dl-atlas-stat-papers");
    var nodeCount = root.querySelector(".dl-atlas-node-count");
    var detail = root.querySelector(".dl-atlas-detail");
    var detailTitle = root.querySelector(".dl-atlas-detail-title");
    var detailMeta = root.querySelector(".dl-atlas-detail-meta");
    var detailNote = root.querySelector(".dl-atlas-detail-note");
    var search = root.querySelector(".dl-atlas-search");
    var yearMin = root.querySelector(".dl-atlas-year-min");
    var yearMax = root.querySelector(".dl-atlas-year-max");
    var yearMinVal = root.querySelector(".dl-atlas-year-min-val");
    var yearMaxVal = root.querySelector(".dl-atlas-year-max-val");
    var domains = root.querySelector(".dl-atlas-domains");
    var listBody = root.querySelector(".dl-atlas-list-body");
    var canvas = root.querySelector(".dl-atlas-canvas");
    var timeline = root.querySelector(".dl-atlas-timeline");

    statBranches.textContent = String(data.categories.length);
    statPapers.textContent = String(data.papers.length);

    function renderBranches() {
      var html = "";
      var allCount = filteredCount("all");
      html += branchBtn("all", "全部分支", "ALL", "#4051b5", allCount, state.branch === "all");
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

    function renderList(papers) {
      listBody.innerHTML = papers.map(function (p) {
        var c = cats[p.cat];
        return (
          "<tr data-pid=\"" + p.id + "\">" +
          "<td>" + p.year + "</td>" +
          "<td>" + escapeHtml(p.title) + "</td>" +
          "<td>" + escapeHtml(p.authors) + "</td>" +
          "<td>" + (c ? c.name : "") + "</td>" +
          "</tr>"
        );
      }).join("");
      listBody.querySelectorAll("tr").forEach(function (row) {
        row.addEventListener("click", function () {
          var id = row.dataset.pid;
          var paper = data.papers.find(function (x) { return x.id === id; });
          selectPaper(paper);
        });
      });
    }

    function escapeHtml(s) {
      return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function updateDetail(paper) {
      if (!paper) {
        detail.hidden = true;
        return;
      }
      var c = cats[paper.cat];
      detail.hidden = false;
      detailTitle.textContent = paper.title;
      detailMeta.textContent = paper.year + " · " + paper.authors + (c ? " · " + c.name : "");
      detailNote.textContent = paper.source === "笔记"
        ? "这篇文献已在当前深度学习笔记正文或参考文献中出现。"
        : "这篇文献作为计算机与 AI 领域的核心论文纳入图谱，供按分支与时间浏览。";
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
      refresh();
    }

    root.querySelectorAll(".dl-atlas-tab").forEach(function (t) {
      t.addEventListener("click", function () { setTab(t.dataset.tab); });
    });
    search.addEventListener("input", function () {
      state.query = search.value;
      refresh();
    });
    yearMin.addEventListener("input", function () {
      state.yearMin = Math.min(Number(yearMin.value), state.yearMax);
      yearMinVal.textContent = String(state.yearMin);
      refresh();
    });
    yearMax.addEventListener("input", function () {
      state.yearMax = Math.max(Number(yearMax.value), state.yearMin);
      yearMaxVal.textContent = String(state.yearMax);
      refresh();
    });
    root.querySelector(".dl-atlas-all-time").addEventListener("click", function () {
      state.yearMin = 1958;
      state.yearMax = 2025;
      yearMin.value = "1958";
      yearMax.value = "2025";
      yearMinVal.textContent = "1958";
      yearMaxVal.textContent = "2025";
      refresh();
    });
    var labelsBtn = root.querySelector(".dl-atlas-labels");
    labelsBtn.addEventListener("click", function () {
      state.showLabels = !state.showLabels;
      labelsBtn.classList.toggle("is-on", state.showLabels);
      refresh();
    });
    root.querySelector(".dl-atlas-orbit").addEventListener("click", function (btn) {
      state.autoOrbit = !state.autoOrbit;
      btn.classList.toggle("is-on", state.autoOrbit);
    });

    var sceneApi = null;

    function refresh() {
      var papers = filteredPapers(state, data);
      renderBranches();
      nodeCount.textContent = papers.length + " / " + data.papers.length + " 节点";
      renderList(papers);
      if (sceneApi) sceneApi.rebuild(papers);
      if (state.tab === "timeline") drawTimeline(papers);
    }

    function drawTimeline(papers) {
      var ctx = timeline.getContext("2d");
      var dpr = window.devicePixelRatio || 1;
      var w = timeline.clientWidth;
      var h = timeline.clientHeight;
      timeline.width = Math.floor(w * dpr);
      timeline.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var styles = getComputedStyle(root);
      var fg = styles.color || "#222";
      var muted = styles.getPropertyValue("--dl-atlas-muted").trim() || "rgba(0,0,0,.45)";
      var border = styles.getPropertyValue("--dl-atlas-border").trim() || "rgba(0,0,0,.1)";

      var minY = state.yearMin;
      var maxY = state.yearMax;
      var padL = 52;
      var padR = 16;
      var padT = 24;
      var padB = 28;
      var laneH = Math.max(10, (h - padT - padB) / data.categories.length);

      ctx.strokeStyle = border;
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, h - padB);
      ctx.lineTo(w - padR, h - padB);
      ctx.stroke();

      for (var y = minY; y <= maxY; y += 5) {
        var x = padL + ((y - minY) / Math.max(1, maxY - minY)) * (w - padL - padR);
        ctx.fillStyle = muted;
        ctx.font = "10px sans-serif";
        ctx.fillText(String(y), x - 8, h - padB + 16);
        ctx.strokeStyle = border;
        ctx.beginPath();
        ctx.moveTo(x, h - padB);
        ctx.lineTo(x, h - padB + 4);
        ctx.stroke();
      }

      data.categories.forEach(function (c, i) {
        var y0 = padT + i * laneH + laneH / 2;
        ctx.fillStyle = muted;
        ctx.font = "11px sans-serif";
        ctx.fillText(c.code, 8, y0 + 4);
        var branchPapers = papers.filter(function (p) { return p.cat === c.id; });
        branchPapers.forEach(function (p, j) {
          var x = padL + ((p.year - minY) / Math.max(1, maxY - minY)) * (w - padL - padR);
          var yy = y0 + ((j % 3) - 1) * 3;
          ctx.fillStyle = c.color;
          ctx.beginPath();
          ctx.arc(x, yy, p.id === (state.selected && state.selected.id) ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    }

    function initScene() {
      var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
      camera.position.set(22, 16, 22);
      var controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.maxPolarAngle = Math.PI * 0.48;
      controls.minDistance = 8;
      controls.maxDistance = 60;

      var nodeGroup = new THREE.Group();
      var branchGroup = new THREE.Group();
      var labelGroup = new THREE.Group();
      scene.add(branchGroup);
      scene.add(nodeGroup);
      scene.add(labelGroup);

      scene.add(new THREE.AmbientLight(0xffffff, 0.65));
      var dir = new THREE.DirectionalLight(0xffffff, 0.85);
      dir.position.set(10, 20, 12);
      scene.add(dir);

      var idToMesh = Object.create(null);
      var raycaster = new THREE.Raycaster();
      var pointer = new THREE.Vector2();
      var highlighted = null;

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

      function rebuild(papers) {
        clearGroup(nodeGroup);
        clearGroup(branchGroup);
        clearGroup(labelGroup);
        idToMesh = Object.create(null);

        var branchOrder = data.categories.map(function (c, i) {
          return { id: c.id, color: c.color, angle: (i / data.categories.length) * Math.PI * 2 };
        });
        var radius = 7.5;
        branchOrder.forEach(function (b) {
          var x = Math.cos(b.angle) * radius;
          var z = Math.sin(b.angle) * radius;
          var geo = new THREE.CylinderGeometry(0.08, 0.12, 20, 8);
          var mat = new THREE.MeshStandardMaterial({ color: b.color, transparent: true, opacity: 0.35 });
          var trunk = new THREE.Mesh(geo, mat);
          trunk.position.set(x, 10, z);
          branchGroup.add(trunk);
          var lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(x, 20, z)
          ]);
          branchGroup.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: b.color, transparent: true, opacity: 0.25 })));
        });

        var perBranch = Object.create(null);
        papers.forEach(function (p) {
          perBranch[p.cat] = perBranch[p.cat] || [];
          perBranch[p.cat].push(p);
        });

        branchOrder.forEach(function (b) {
          var items = (perBranch[b.id] || []).slice().sort(function (a, b2) { return a.year - b2.year; });
          items.forEach(function (p, idx) {
            var x = Math.cos(b.angle) * radius;
            var z = Math.sin(b.angle) * radius;
            var spread = (idx - items.length / 2) * 0.35;
            var px = x + Math.cos(b.angle + Math.PI / 2) * spread;
            var pz = z + Math.sin(b.angle + Math.PI / 2) * spread;
            var py = yearToY(p.year, state.yearMin, state.yearMax);
            var size = p.year >= 2020 ? 0.22 : 0.16;
            var mesh = new THREE.Mesh(
              new THREE.SphereGeometry(size, 12, 12),
              new THREE.MeshStandardMaterial({ color: b.color, emissive: b.color, emissiveIntensity: 0.15 })
            );
            mesh.position.set(px, py, pz);
            mesh.userData.paperId = p.id;
            nodeGroup.add(mesh);
            idToMesh[p.id] = mesh;

            var stem = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(px * 0.15, py * 0.2, pz * 0.15),
                new THREE.Vector3(px, py, pz)
              ]),
              new THREE.LineBasicMaterial({ color: b.color, transparent: true, opacity: 0.35 })
            );
            nodeGroup.add(stem);
          });
        });

        highlight(highlighted);
      }

      function highlight(paperId) {
        highlighted = paperId;
        Object.keys(idToMesh).forEach(function (id) {
          var mesh = idToMesh[id];
          var sel = id === paperId;
          mesh.material.emissiveIntensity = sel ? 0.55 : 0.15;
          mesh.scale.setScalar(sel ? 1.35 : 1);
        });
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
        var paper = data.papers.find(function (p) { return p.id === id; });
        selectPaper(paper);
      });

      var orbitT = 0;
      function tick() {
        requestAnimationFrame(tick);
        resize();
        if (state.autoOrbit && state.tab === "tree") {
          orbitT += 0.0018;
          camera.position.x = Math.cos(orbitT) * 28;
          camera.position.z = Math.sin(orbitT) * 28;
          camera.lookAt(0, 9, 0);
        }
        controls.update();
        renderer.render(scene, camera);
      }
      tick();

      sceneApi = {
        rebuild: rebuild,
        highlight: highlight,
        zoom: function (factor) {
          camera.position.multiplyScalar(factor);
          controls.update();
        },
        reset: function () {
          camera.position.set(22, 16, 22);
          controls.target.set(0, 9, 0);
          controls.update();
        }
      };
      rebuild(filteredPapers(state, data));
    }

    root.querySelector(".dl-atlas-zoom-in").addEventListener("click", function () {
      if (sceneApi && sceneApi.zoom) sceneApi.zoom(0.85);
    });
    root.querySelector(".dl-atlas-zoom-out").addEventListener("click", function () {
      if (sceneApi && sceneApi.zoom) sceneApi.zoom(1.15);
    });
    root.querySelector(".dl-atlas-reset").addEventListener("click", function () {
      if (sceneApi && sceneApi.reset) sceneApi.reset();
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