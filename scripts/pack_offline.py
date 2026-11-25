"""Pack the built MkDocs site into one offline HTML file."""
import base64
import gzip
import hashlib
import io
import mimetypes
import re
import struct
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
OUT = ROOT.parent / "深度学习笔记-离线.html"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)

EXTRA = [
    "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css",
    "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js",
    "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js",
    "https://fonts.googleapis.com/css?family=Roboto:300,300i,400,400i,700,700i%7CRoboto+Mono:400,400i,700,700i&display=fallback",
    "https://unpkg.com/mermaid@11/dist/mermaid.min.js",
]


CACHE = ROOT / "scripts" / ".offline-cache"


def fetch(url: str) -> bytes:
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / hashlib.sha256(url.encode("utf-8")).hexdigest()
    if cached.exists():
        return cached.read_bytes()
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=90) as response:
        data = response.read()
    cached.write_bytes(data)
    return data


def mime_for(path: str) -> str:
    guessed, _ = mimetypes.guess_type(path)
    if guessed:
        return guessed
    if path.endswith(".woff2"):
        return "font/woff2"
    if path.endswith(".woff"):
        return "font/woff"
    if path.endswith(".js"):
        return "text/javascript"
    if path.endswith(".css"):
        return "text/css"
    if path.endswith(".json"):
        return "application/json"
    return "application/octet-stream"


def pack_entry(key: str, mime: str, data: bytes) -> bytes:
    key_b = key.encode("utf-8")
    mime_b = mime.encode("utf-8")
    return b"".join(
        (
            struct.pack("<I", len(key_b)),
            key_b,
            struct.pack("<I", len(mime_b)),
            mime_b,
            struct.pack("<I", len(data)),
            data,
        )
    )


def css_urls(url: str, data: bytes) -> list[str]:
    if not (url.endswith(".css") or "fonts.googleapis.com/css" in url):
        return []
    text = data.decode("utf-8", errors="replace")
    base = url.rsplit("/", 1)[0] + "/"
    found = []
    for raw in re.findall(r"url\(([^)]+)\)", text):
        target = raw.strip().strip("\"'")
        if not target or target.startswith("data:"):
            continue
        if target.startswith("//"):
            absolute = "https:" + target
        elif target.startswith("https://"):
            absolute = target
        else:
            absolute = urllib.request.urljoin(base, target)
        found.append(absolute)
    return found


def main() -> None:
    raw: dict[str, tuple[str, bytes]] = {}
    for path in SITE.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(SITE).as_posix()
        raw[rel] = (mime_for(rel), path.read_bytes())

    bundle = next(SITE.glob("assets/javascripts/bundle*.min.js"))
    bundle_text = bundle.read_text(encoding="utf-8", errors="replace")
    queue = list(dict.fromkeys(EXTRA + re.findall(r"https://unpkg.com/[^\"'\s]+", bundle_text)))
    seen: set[str] = set()
    while queue:
        url = queue.pop(0)
        if url in seen or url.rstrip("/").endswith("fonts.gstatic.com"):
            continue
        seen.add(url)
        print("fetch", url[:120])
        data = fetch(url)
        raw["ext:" + url] = (mime_for(url.split("?")[0]), data)
        for absolute in css_urls(url, data):
            if absolute not in seen:
                queue.append(absolute)

    blob = io.BytesIO()
    for key, (mime, data) in raw.items():
        blob.write(pack_entry(key, mime, data))
    payload = gzip.compress(blob.getvalue(), mtime=0)
    encoded = base64.b64encode(payload).decode("ascii")
    html = BOOT.replace("__PAYLOAD__", encoded)
    OUT.write_text(html, encoding="utf-8", newline="\n")
    print(f"wrote {OUT} ({OUT.stat().st_size / 1048576:.1f} MB, {len(raw)} files)")


BOOT = r"""<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>深度学习笔记</title>
</head>
<body>
  <p id="offline-boot" style="font-family:sans-serif;padding:2rem;color:#333">正在打开深度学习笔记…</p>
  <script>
  (async function () {
    var payload = "__PAYLOAD__";
    var compressed = Uint8Array.from(atob(payload), function (c) { return c.charCodeAt(0); });
    var stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
    var buffer = await new Response(stream).arrayBuffer();
    var view = new DataView(buffer);
    var files = {};
    var offset = 0;
    var decoder = new TextDecoder("utf-8");
    while (offset < buffer.byteLength) {
      var keyLen = view.getUint32(offset, true); offset += 4;
      var key = decoder.decode(new Uint8Array(buffer, offset, keyLen)); offset += keyLen;
      var mimeLen = view.getUint32(offset, true); offset += 4;
      var mime = decoder.decode(new Uint8Array(buffer, offset, mimeLen)); offset += mimeLen;
      var dataLen = view.getUint32(offset, true); offset += 4;
      files[key] = { mime: mime, bytes: new Uint8Array(buffer.slice(offset, offset + dataLen)) };
      offset += dataLen;
    }
    var blobs = {};
    var current = "index.html";

    function textOf(key) {
      return new TextDecoder("utf-8").decode(files[key].bytes);
    }

    function blobFor(key, mime, rewrite) {
      if (blobs[key]) return blobs[key];
      var bytes = files[key].bytes;
      if (rewrite) {
        var source = textOf(key);
        var changed = rewrite(source, key);
        if (changed !== source) bytes = new TextEncoder().encode(changed);
      }
      blobs[key] = URL.createObjectURL(new Blob([bytes], { type: mime || files[key].mime }));
      return blobs[key];
    }

    function sitePath(url) {
      var clean = String(url).split("#")[0];
      var queryless = clean.split("?")[0];
      if (files["ext:" + clean]) return "ext:" + clean;
      if (files["ext:" + queryless]) return "ext:" + queryless;
      var absolute;
      try { absolute = new URL(queryless, location.href); }
      catch (error) { return ""; }
      if (absolute.origin === location.origin || absolute.protocol === "file:") {
        var root = decodeURIComponent(new URL(".", location.href).pathname);
        var path = decodeURIComponent(absolute.pathname);
        if (path.indexOf(root) === 0) path = path.slice(root.length);
        path = path.replace(/^[/\\]+/, "");
        if (files[path]) return path;
      }
      return "";
    }

    function resolvePage(href) {
      if (!href || href.indexOf("mailto:") === 0 || href.indexOf("javascript:") === 0) return null;
      if (href.charAt(0) === "#") return null;
      var url;
      try { url = new URL(href, "https://notes.local/" + current); }
      catch (error) { return null; }
      if (url.origin !== "https://notes.local") return null;
      var path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      if (!path || path.slice(-1) === "/") path += "index.html";
      if (!files[path] && files[path + "/index.html"]) path += "/index.html";
      if (!files[path]) return null;
      return { path: path, hash: url.hash };
    }

    function rewriteCss(source, key) {
      var baseHref = key.indexOf("ext:") === 0 ? key.slice(4) : ("https://notes.local/" + key);
      return source.replace(/url\(([^)]+)\)/g, function (all, raw) {
        var target = raw.trim().replace(/^['"]|['"]$/g, "");
        if (!target || target.indexOf("data:") === 0) return all;
        var absolute = target;
        try { absolute = new URL(target, baseHref).href; }
        catch (error) { return all; }
        var found = files["ext:" + absolute] ? "ext:" + absolute : sitePath(absolute);
        if (!found || !files[found]) return all;
        return "url(\"" + blobFor(found, files[found].mime) + "\")";
      });
    }

    function rewriteJs(source) {
      Object.keys(files).filter(function (key) {
        return key.indexOf("ext:https://") === 0;
      }).sort(function (a, b) { return b.length - a.length; }).forEach(function (key) {
        var remote = key.slice(4);
        if (source.indexOf(remote) === -1) return;
        var blob = blobFor(key, files[key].mime, key.indexOf(".css") !== -1 ? rewriteCss : null);
        source = source.split(remote).join(blob);
      });
      return source;
    }

    function localResponse(url) {
      var key = sitePath(url);
      if (!key || !files[key]) {
        var clean = String(url).split("#")[0];
        if (files["ext:" + clean]) key = "ext:" + clean;
      }
      if (!key || !files[key]) return null;
      var mime = files[key].mime;
      var body = files[key].bytes;
      if (mime.indexOf("css") !== -1) {
        body = new TextEncoder().encode(rewriteCss(textOf(key), key));
        mime = "text/css";
      }
      return new Response(body, { status: 200, headers: { "Content-Type": mime } });
    }

    var originalFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var local = localResponse(url);
      if (local) return Promise.resolve(local);
      return originalFetch.apply(this, arguments);
    };
    var OriginalXHR = window.XMLHttpRequest;
    function PatchedXHR() {
      var xhr = new OriginalXHR();
      var open = xhr.open;
      var url = "";
      xhr.open = function (method, next) {
        url = next;
        return open.apply(xhr, arguments);
      };
      var send = xhr.send;
      xhr.send = function () {
        var local = localResponse(url);
        if (!local) return send.apply(xhr, arguments);
        local.arrayBuffer().then(function (buffer) {
          Object.defineProperty(xhr, "response", { value: buffer });
          Object.defineProperty(xhr, "responseText", { value: new TextDecoder().decode(buffer) });
          Object.defineProperty(xhr, "status", { value: 200 });
          Object.defineProperty(xhr, "readyState", { value: 4 });
          if (xhr.onreadystatechange) xhr.onreadystatechange();
          xhr.dispatchEvent(new Event("readystatechange"));
          xhr.dispatchEvent(new Event("load"));
          xhr.dispatchEvent(new Event("loadend"));
        });
      };
      return xhr;
    }
    window.XMLHttpRequest = PatchedXHR;

    function show(path, hash, fromHistory) {
      if (!files[path]) return;
      current = path;
      var page = new DOMParser().parseFromString(textOf(path), "text/html");
      page.querySelectorAll("link[rel='stylesheet']").forEach(function (link) {
        var href = link.getAttribute("href");
        var key = sitePath(href) || (files["ext:" + href] ? "ext:" + href : "");
        if (!key || !files[key]) return;
        var style = page.createElement("style");
        style.textContent = rewriteCss(textOf(key), key);
        link.replaceWith(style);
      });
      page.querySelectorAll("img[src], script[src], link[rel='icon']").forEach(function (node) {
        var attr = node.tagName === "LINK" ? "href" : "src";
        var value = node.getAttribute(attr);
        var key = sitePath(value) || (files["ext:" + value] ? "ext:" + value : "");
        if (!key || !files[key]) return;
        var rewriter = files[key].mime.indexOf("javascript") !== -1 ? rewriteJs : null;
        node.setAttribute(attr, blobFor(key, files[key].mime, rewriter));
      });
      document.replaceChild(document.adoptNode(page.documentElement), document.documentElement);
      if (!document.__offlinePatched) {
        var originalListen = document.addEventListener.bind(document);
        document.addEventListener = function (type, listener, options) {
          if (type === "DOMContentLoaded") {
            (window.__domReady = window.__domReady || []).push(listener);
            return;
          }
          return originalListen(type, listener, options);
        };
        document.__offlinePatched = true;
      }
      window.__domReady = [];
      var scripts = Array.prototype.slice.call(document.scripts);
      function run(index) {
        if (index >= scripts.length) {
          (window.__domReady || []).splice(0).forEach(function (listener) {
            try {
              var event = new Event("DOMContentLoaded");
              if (typeof listener === "function") listener.call(document, event);
              else if (listener && listener.handleEvent) listener.handleEvent(event);
            } catch (error) {}
          });
          if (window.renderMathInElement) {
            try {
              renderMathInElement(document.body, {
                delimiters: [
                  { left: "$$", right: "$$", display: true },
                  { left: "\\[", right: "\\]", display: true },
                  { left: "$", right: "$", display: false },
                  { left: "\\(", right: "\\)", display: false }
                ],
                throwOnError: false
              });
            } catch (error) {}
          }
          if (hash) {
            var target = document.getElementById(decodeURIComponent(hash.slice(1)));
            if (target) target.scrollIntoView();
          }
          return;
        }
        var old = scripts[index];
        var copy = document.createElement("script");
        Array.prototype.forEach.call(old.attributes, function (attr) {
          copy.setAttribute(attr.name, attr.value);
        });
        if (old.src) {
          copy.async = false;
          copy.onload = function () { run(index + 1); };
          copy.onerror = function () { run(index + 1); };
          old.replaceWith(copy);
        } else {
          copy.textContent = old.textContent;
          old.replaceWith(copy);
          run(index + 1);
        }
      }
      run(0);
      var route = "#/" + path.replace(/index\.html$/, "");
      if (!fromHistory && location.hash !== route) history.pushState({ path: path }, "", route);
    }

    window.addEventListener("click", function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var link = event.target.closest && event.target.closest("a[href]");
      if (!link) return;
      var href = link.getAttribute("href");
      if (!href || href.charAt(0) === "#") return;
      var page = resolvePage(href);
      if (!page) return;
      event.preventDefault();
      show(page.path, page.hash, false);
    }, true);

    window.addEventListener("popstate", function () {
      var hash = location.hash || "";
      if (hash.indexOf("#/") !== 0) return;
      var path = hash.slice(2);
      if (!path || path.slice(-1) === "/") path += "index.html";
      if (files[path]) show(path, "", true);
    });

    var opening = location.hash.indexOf("#/") === 0 ? location.hash.slice(2) : "";
    if (!opening || opening.slice(-1) === "/") opening += "index.html";
    if (!files[opening]) opening = "index.html";
    show(opening, "", true);
  })().catch(function (error) {
    document.body.innerHTML = "<p style='font-family:sans-serif;padding:2rem'>离线笔记无法打开：" + error + "</p>";
  });
  </script>
</body>
</html>
"""


if __name__ == "__main__":
    main()
