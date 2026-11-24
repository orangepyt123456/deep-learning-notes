(function () {
  var PALETTE = [0x2f9e8f, 0x3b6fd8, 0x7a6ad6, 0xd4a017, 0xc45c26, 0x3e8f4a, 0x2a6f8f, 0xb44d6a];

  function parseMindmap(src) {
    var root = { text: "", children: [], depth: 0 };
    var stack = [{ node: root, indent: -1 }];
    src.split("\n").forEach(function (raw) {
      var line = raw.replace(/\t/g, "  ");
      if (!line.trim() || line.trim() === "mindmap") return;
      var indent = line.match(/^ */)[0].length;
      var text = line.trim().replace(/^root\(\((.*)\)\)$/, "$1").replace(/^\(\((.*)\)\)$/, "$1");
      var node = { text: text, children: [], depth: 0 };
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
      node.depth = stack.length - 1;
      stack[stack.length - 1].node.children.push(node);
      stack.push({ node: node, indent: indent });
    });
    return root.children.length === 1 ? root.children[0] : root;
  }

  function layout(node, depth, index, count, parentAngle) {
    var y = depth * 1.45;
    var angle = parentAngle || 0;
    if (depth === 0) {
      node.p = { x: 0, y: 0, z: 0 };
      node.angle = 0;
    } else {
      var span = Math.min(Math.PI * 1.15, 0.42 * count + 0.3);
      var start = parentAngle - span / 2;
      angle = count === 1 ? parentAngle : start + (span * (index + 0.5)) / count;
      var radius = depth * 0.58;
      node.p = { x: Math.sin(angle) * radius, y: y, z: Math.cos(angle) * radius };
      node.angle = angle;
    }
    node.children.forEach(function (child, i) {
      layout(child, depth + 1, i, node.children.length, angle);
    });
  }

  function walk(node, visit) {
    visit(node);
    node.children.forEach(function (child) { walk(child, visit); });
  }

  function paintBranch(colorIndex, node) {
    node.color = PALETTE[colorIndex % PALETTE.length];
    node.children.forEach(function (child) { paintBranch(colorIndex, child); });
  }

  function mountTree(pre) {
    if (!window.THREE) return;
    var tree = parseMindmap(pre.textContent || "");
    if (!tree.text && !tree.children.length) return;
    layout(tree, 0, 0, 1, 0);
    tree.color = 0x1f4d42;
    tree.children.forEach(function (child, i) { paintBranch(i, child); });

    var stage = document.createElement("div");
    stage.className = "arbor-stage";
    stage.setAttribute("role", "img");
    stage.setAttribute("aria-label", (tree.text || "本章") + "的三维结构");
    var caption = document.createElement("p");
    caption.className = "arbor-caption";
    caption.textContent = "拖动旋转，滚轮缩放。点击文字跳到对应小节。";
    stage.appendChild(caption);

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    stage.insertBefore(renderer.domElement, caption);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    scene.add(new THREE.AmbientLight(0xffffff, 1.05));
    var sun = new THREE.DirectionalLight(0xffffff, 0.55);
    sun.position.set(4, 8, 3);
    scene.add(sun);

    var ring = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.24, 72),
      new THREE.MeshBasicMaterial({ color: 0xb7c4bc, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.02;
    scene.add(ring);

    var nodes = [];
    walk(tree, function (node) { nodes.push(node); });
    var top = 0;
    nodes.forEach(function (node) { top = Math.max(top, node.p.y); });

    nodes.forEach(function (node) {
      var radius = node.depth === 0 ? 0.16 : 0.1;
      var sphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 20, 16),
        new THREE.MeshStandardMaterial({ color: node.color, roughness: 0.35, metalness: 0.02, emissive: node.color, emissiveIntensity: 0.28 })
      );
      sphere.position.set(node.p.x, node.p.y, node.p.z);
      scene.add(sphere);
      node.children.forEach(function (child) {
        var from = new THREE.Vector3(node.p.x, node.p.y, node.p.z);
        var to = new THREE.Vector3(child.p.x, child.p.y, child.p.z);
        var mid = from.clone().lerp(to, 0.5);
        mid.y -= 0.12;
        var curve = new THREE.QuadraticBezierCurve3(from, mid, to);
        var tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 18, 0.028, 6, false),
          new THREE.MeshStandardMaterial({ color: child.color, roughness: 0.55 })
        );
        scene.add(tube);
      });
    });

    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.11, 0.55, 12),
      new THREE.MeshStandardMaterial({ color: 0x6d5344, roughness: 0.8 })
    );
    trunk.position.y = -0.28;
    scene.add(trunk);

    nodes.forEach(function (node) {
      if (!node.text) return;
      var label = document.createElement("button");
      label.type = "button";
      label.className = "arbor-label";
      label.textContent = node.text;
      label.title = node.text;
      label.addEventListener("click", function (event) {
        event.stopPropagation();
        var key = node.text.replace(/…$/, "").trim().slice(0, 16);
        var heads = stage.ownerDocument.querySelectorAll("h2, h3, h4");
        for (var i = 0; i < heads.length; i++) {
          if (heads[i].textContent.indexOf(key) !== -1 && heads[i].textContent.indexOf("本章导图") === -1) {
            heads[i].scrollIntoView({ behavior: "smooth", block: "start" });
            break;
          }
        }
      });
      stage.appendChild(label);
      node.label = label;
    });

    var rotY = 0.7;
    var rotX = 0.22;
    var centerY = Math.max(top * 0.5, 0.6);
    var reach = 1.2;
    nodes.forEach(function (node) {
      var dx = node.p.x;
      var dy = node.p.y - centerY;
      var dz = node.p.z;
      reach = Math.max(reach, Math.sqrt(dx * dx + dy * dy + dz * dz));
    });
    var dist = reach / Math.tan((42 * Math.PI / 180) / 2) * 1.18;
    var drag = null;

    stage.addEventListener("pointerdown", function (event) {
      drag = { x: event.clientX, y: event.clientY, rotY: rotY, rotX: rotX };
      stage.setPointerCapture(event.pointerId);
    });
    stage.addEventListener("pointermove", function (event) {
      if (!drag) return;
      rotY = drag.rotY + (event.clientX - drag.x) * 0.008;
      rotX = Math.max(0.18, Math.min(1.15, drag.rotX + (event.clientY - drag.y) * 0.005));
    });
    stage.addEventListener("pointerup", function () { drag = null; });
    stage.addEventListener("pointercancel", function () { drag = null; });
    stage.addEventListener("wheel", function (event) {
      event.preventDefault();
      dist = Math.max(4.2, Math.min(18, dist + event.deltaY * 0.008));
    }, { passive: false });

    function resize() {
      var width = stage.clientWidth || 640;
      var height = stage.clientHeight || 460;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);

    function frame() {
      if (!stage.isConnected) {
        renderer.dispose();
        return;
      }
      if (!drag) rotY += 0.0025;
      camera.position.set(
        Math.sin(rotY) * Math.cos(rotX) * dist,
        Math.sin(rotX) * dist * 0.72 + centerY,
        Math.cos(rotY) * Math.cos(rotX) * dist
      );
      camera.lookAt(0, centerY, 0);
      renderer.render(scene, camera);
      var width = stage.clientWidth;
      var height = stage.clientHeight;
      var placed = [];
      nodes.slice().sort(function (a, b) { return a.depth - b.depth; }).forEach(function (node) {
        if (!node.label) return;
        var v = new THREE.Vector3(node.p.x, node.p.y, node.p.z).project(camera);
        var x = (v.x * 0.5 + 0.5) * width;
        var y = (-v.y * 0.5 + 0.5) * height;
        var hidden = v.z > 1 || x < 8 || x > width - 8 || y < 36 || y > height - 12;
        node.label.hidden = true;
        if (hidden) return;
        var rightSide = node.p.x >= 0;
        node.label.hidden = false;
        node.label.style.transform = "translate(" + (x + (rightSide ? 12 : -12)) + "px, " + y + "px) translate(" + (rightSide ? "0" : "-100%") + ", -50%)";
        var labelWidth = node.label.offsetWidth || 80;
        var left = rightSide ? x + 12 : x - 12 - labelWidth;
        var box = { left: left, right: left + labelWidth, top: y - 12, bottom: y + 12 };
        var crowded = false;
        if (node.depth > 0) {
          for (var i = 0; i < placed.length; i++) {
            var other = placed[i];
            if (box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top) {
              crowded = true;
              break;
            }
          }
        }
        if (crowded) {
          node.label.hidden = true;
          return;
        }
        placed.push(box);
      });
      requestAnimationFrame(frame);
    }
    replaceBlock(pre, stage);
    resize();
    requestAnimationFrame(frame);
  }

  function yearKey(label) {
    var found = label.match(/\d{4}/g);
    if (!found) return 10000;
    return Math.max.apply(null, found.map(Number));
  }

  function parseTimeline(src) {
    var title = "";
    var groups = [];
    var current = null;
    src.split("\n").forEach(function (raw) {
      var line = raw.trim();
      if (!line || line === "timeline") return;
      if (line.indexOf("title ") === 0) {
        title = line.slice(6).trim();
        return;
      }
      var mark = line.indexOf(":");
      if (mark < 0) return;
      var year = line.slice(0, mark).trim();
      var event = line.slice(mark + 1).trim();
      if (!event) return;
      if (!year && current) year = current.label;
      if (year !== (current && current.label)) {
        current = { label: year || "时间", events: [], order: groups.length };
        groups.push(current);
      }
      current.events.push(event);
    });
    groups.sort(function (a, b) { return yearKey(b.label) - yearKey(a.label); });
    return { title: title, groups: groups };
  }

  function mountTimeline(pre) {
    var data = parseTimeline(pre.textContent || "");
    if (!data.groups.length) return;
    var section = document.createElement("section");
    section.className = "arbor-time";
    var kicker = document.createElement("p");
    kicker.className = "arbor-kicker";
    kicker.textContent = "时间线";
    var heading = document.createElement("h3");
    heading.className = "arbor-time-title";
    heading.textContent = data.title || "按时间看这一章";
    var note = document.createElement("p");
    note.className = "arbor-time-note";
    note.textContent = "年份靠前的记在上面。同一年里的条目仍按原文顺序。";
    section.appendChild(kicker);
    section.appendChild(heading);
    section.appendChild(note);
    data.groups.forEach(function (group, groupIndex) {
      var row = document.createElement("div");
      row.className = "arbor-year";
      var label = document.createElement("div");
      label.className = "arbor-year-label";
      label.textContent = group.label;
      var list = document.createElement("ol");
      list.className = "arbor-events";
      group.events.forEach(function (event, index) {
        var item = document.createElement("li");
        var dot = document.createElement("span");
        dot.className = "dot";
        dot.style.setProperty("--dot", "#" + PALETTE[(groupIndex + index) % PALETTE.length].toString(16).padStart(6, "0"));
        var text = document.createElement("strong");
        text.textContent = event;
        item.appendChild(dot);
        item.appendChild(text);
        list.appendChild(item);
      });
      row.appendChild(label);
      row.appendChild(list);
      section.appendChild(row);
    });
    replaceBlock(pre, section);
  }

  function replaceBlock(pre, node) {
    var parent = pre.parentElement;
    if (parent && parent.classList.contains("highlight")) parent.replaceWith(node);
    else pre.replaceWith(node);
  }

  function boot() {
    document.querySelectorAll("pre.arbor-tree").forEach(mountTree);
    document.querySelectorAll("pre.arbor-timeline").forEach(mountTimeline);
  }

  if (typeof document$ !== "undefined") document$.subscribe(boot);
  else document.addEventListener("DOMContentLoaded", boot);
})();
