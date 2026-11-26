/*
 * 발표 사이트 동작
 * - data.js 값 채우기 (비어 있으면 "준비 중")
 * - 발표 모드: 한 화면에 한 장면, 방향키 이동, F·N·1·2·3 단축키, 진행 표시
 * - 복습 모드: 스크롤. 세 칸을 누르면 해당 부로 이동
 */
(function () {
  "use strict";

  var D = window.SITE || {};
  var root = document.documentElement;
  var isPresent = root.classList.contains("present");
  var PENDING = "준비 중";
  var PART_LABEL = {
    0: "여는 장면",
    1: "1부 AI로 바이브하다",
    2: "2부 우리가 만드는 디지털 과학책",
    3: "3부 과학을 잇(IT)다",
    4: "마무리"
  };

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $all(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function filled(v) { return typeof v === "string" && v.trim() !== ""; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function stripProtocol(url) { return url.replace(/^https?:\/\//, "").replace(/\/$/, ""); }

  /* ---------- data.js 값 읽기 ---------- */
  var p2 = D.part2 || {};
  var shelfBase = filled(p2.studentSite) ? p2.studentSite.trim().replace(/\/+$/, "") : "";
  var shelfCode = filled(p2.shelfCode) ? p2.shelfCode.trim() : "";

  // 배포한 사이트 주소. data.js에 없으면, 배포된 곳에서 열었을 때 그 주소를 쓴다
  function siteUrl() {
    var v = D.talk && D.talk.siteUrl;
    if (filled(v)) return v.trim();
    var h = location.hostname;
    if (/^https?:$/.test(location.protocol) && h && h !== "localhost" && h !== "127.0.0.1") {
      return location.origin + location.pathname.replace(/index\.html$/, "");
    }
    return "";
  }

  // 다른 값으로 만들어지는 주소는 "@이름"으로 부른다
  var DERIVED = {
    trainingShelf: shelfBase && shelfCode ? shelfBase + "/c/" + encodeURIComponent(shelfCode) : "",
    worksheet: shelfBase && shelfCode ? shelfBase + "/w/" + encodeURIComponent(shelfCode) : "",
    site: siteUrl()
  };
  function get(path) {
    if (path.charAt(0) === "@") return DERIVED[path.slice(1)];
    return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, D);
  }

  /* ---------- 글자 채우기 ---------- */
  $all("[data-bind]").forEach(function (el) {
    var v = get(el.getAttribute("data-bind"));
    if (!filled(v) && el.hasAttribute("data-default")) v = el.getAttribute("data-default");
    if (!filled(v)) {
      el.textContent = PENDING;
      el.classList.add("pending");
      return;
    }
    v = v.trim();
    // data-split=":" 이면 쌍점 앞은 큰 제목, 뒤는 작은 부제로 나눈다
    var sep = el.getAttribute("data-split");
    var at = sep ? v.indexOf(sep) : -1;
    if (at > 0) {
      el.innerHTML = '<span class="title-main">' + escapeHtml(v.slice(0, at).trim()) + "</span>" +
        '<span class="title-sub">' + escapeHtml(v.slice(at + sep.length).trim()) + "</span>";
    } else {
      el.textContent = v;
    }
  });
  if (filled(get("talk.title"))) document.title = get("talk.title").trim();

  // data-bind-host: 주소에서 https:// 를 뗀 모습으로 보여 준다
  $all("[data-bind-host]").forEach(function (el) {
    var v = get(el.getAttribute("data-bind-host"));
    if (filled(v)) el.textContent = stripProtocol(v.trim());
    else { el.textContent = PENDING; el.classList.add("pending"); }
  });

  /* ---------- 링크 ---------- */
  function openInNewTab(el, url) {
    el.href = url;
    el.target = "_blank";
    el.rel = "noopener";
  }
  // data-href: 값이 있으면 새 탭으로, 없으면 "준비 중"
  $all("[data-href]").forEach(function (el) {
    var v = get(el.getAttribute("data-href"));
    if (filled(v)) {
      openInNewTab(el, v.trim());
    } else {
      el.removeAttribute("href");
      el.setAttribute("aria-disabled", "true");
      el.classList.add("is-pending");
      el.textContent = el.textContent + " (" + PENDING + ")";
    }
  });
  // data-href-if: 값이 있을 때만 보인다 (없으면 자리도 차지하지 않는다)
  $all("[data-href-if]").forEach(function (el) {
    var v = get(el.getAttribute("data-href-if"));
    if (filled(v)) openInNewTab(el, v.trim());
    else el.hidden = true;
  });
  // data-empty-of: 값이 비어 있을 때만 보인다
  $all("[data-empty-of]").forEach(function (el) {
    if (filled(get(el.getAttribute("data-empty-of")))) el.hidden = true;
  });
  // data-download: data.js의 공개 여부가 "예"일 때만 내려받기 링크를 보인다
  $all("[data-download]").forEach(function (el) {
    var v = (D.downloads || {})[el.getAttribute("data-download")];
    if (filled(v) && v.trim() === "예") el.hidden = false;
  });

  // data-local: site/media 안의 파일. 발표 노트북처럼 파일이 있는 곳에서만 단추가 보인다
  $all("[data-local]").forEach(function (el) {
    var name = get(el.getAttribute("data-local"));
    if (!filled(name)) return;
    var url = "media/" + encodeURIComponent(name.trim());
    function reveal() { openInNewTab(el, url); el.hidden = false; }
    if (location.protocol === "file:") {
      reveal(); // 폴더에서 바로 연 경우는 확인할 방법이 없어 있다고 본다
    } else if (window.fetch) {
      fetch(url, { method: "HEAD" }).then(function (r) { if (r.ok) reveal(); }).catch(function () {});
    }
  });

  /* ---------- 사이트 주소와 QR ---------- */
  function qrInto(card, url, label, emptyMsg) {
    if (url) {
      try {
        card.innerHTML = window.QR.svg(url, { label: label });
        return;
      } catch (err) {
        emptyMsg = "QR을 만들지 못했습니다";
      }
    }
    card.innerHTML = '<div class="qr-empty"><strong>' + PENDING + "</strong>" + escapeHtml(emptyMsg) + "</div>";
  }
  $all("[data-site-qr]").forEach(function (el) {
    el.classList.add("qr-card");
    qrInto(el, DERIVED.site, "이 사이트 주소 QR", "사이트를 올린 뒤 QR이 나타납니다");
  });
  $all("[data-site-address]").forEach(function (el) {
    if (DERIVED.site) el.textContent = stripProtocol(DERIVED.site);
    else { el.textContent = "주소 " + PENDING; el.classList.add("pending"); }
  });

  /* ---------- 장면 ---------- */
  var stage = $("#stage");
  // 복습 모드 전용 장면은 발표 모드의 장면 순서에서 뺀다
  var scenes = $all(".scene", stage).filter(function (s) {
    return !(isPresent && s.classList.contains("review-only"));
  });
  var current = 0;

  function firstSceneOfPart(part) {
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].getAttribute("data-part") === String(part)) return i;
    }
    return -1;
  }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // "오늘의 세 가지" 칸: 누르면 해당 부의 첫 장면으로
  $all("[data-goto-part]").forEach(function (el) {
    var idx = firstSceneOfPart(el.getAttribute("data-goto-part"));
    if (idx < 0) {
      var soon = document.createElement("span");
      soon.className = "part-soon";
      soon.textContent = "장면 " + PENDING;
      el.appendChild(soon);
    } else {
      el.setAttribute("href", "#" + scenes[idx].id);
    }
    el.addEventListener("click", function (e) {
      e.preventDefault();
      if (idx < 0) return;
      if (isPresent) show(idx);
      else scenes[idx].scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    });
  });

  /* ---------- 그림 크게 보기 ---------- */
  var lightbox = (function () {
    var box = $("#lightbox");
    if (!box) return null;
    var img = $("#lightbox-img");
    var cap = $("#lightbox-cap");
    var prev = $("#lightbox-prev");
    var next = $("#lightbox-next");
    var items = [];
    var at = 0;
    var onMove = null;
    var opener = null;

    function render() {
      img.src = items[at].src;
      img.alt = items[at].caption || "";
      cap.textContent = items.length > 1
        ? (at + 1) + " / " + items.length + "  " + (items[at].caption || "")
        : (items[at].caption || "");
      prev.hidden = next.hidden = items.length < 2;
    }
    function move(step) {
      if (items.length < 2) return;
      at = (at + step + items.length) % items.length;
      render();
      if (onMove) onMove(at);
    }
    function open(list, index, moved) {
      items = list;
      at = index || 0;
      onMove = moved || null;
      opener = document.activeElement;
      render();
      box.hidden = false;
      $("#lightbox-close").focus();
    }
    function close() {
      box.hidden = true;
      img.removeAttribute("src");
      if (opener && opener.focus) opener.focus();
    }
    prev.addEventListener("click", function (e) { e.stopPropagation(); move(-1); });
    next.addEventListener("click", function (e) { e.stopPropagation(); move(1); });
    box.addEventListener("click", close); // 그림 바깥이나 닫기 단추를 누르면 닫힌다
    img.addEventListener("click", function (e) { e.stopPropagation(); move(1); });

    return { open: open, close: close, move: move, isOpen: function () { return !box.hidden; } };
  })();

  // 표지·포스터 그림: 누르면 크게
  $all(".zoomable").forEach(function (btn) {
    btn.addEventListener("click", function () {
      lightbox.open([{ src: btn.getAttribute("data-zoom"), caption: btn.getAttribute("data-caption") }], 0);
    });
  });

  /* ---------- 1부: 모둠 프로젝트 페이지 양식 12장 ---------- */
  var gallery = (function () {
    var view = $("#gal-view");
    if (!view) return null;
    var img = $("#gal-img");
    var count = $("#gal-n");
    var caption = $("#gal-caption");
    var thumbs = $("#gal-thumbs");
    var CAPTIONS = [
      "표지. 모둠 이름, 담당 성취기준, 학급을 적습니다",
      "1차시 들여다보기 ① 먼저, 무슨 단원인지 교육과정 읽기",
      "1차시 들여다보기 ② 변인 통제, 좋은 과학 앱의 숨은 뼈대",
      "1차시 들여다보기 ③ 성취기준에서 평가요소 뽑기",
      "이 페이지 사용법. 역설계 흐름과 모둠 역할 분담",
      "1차시. 역설계 출발: 성취기준 고르고 평가요소 초안 쓰기",
      "2차시. 역설계 발전과 앱 구상",
      "3차시. 프롬프트 실험 (Gemini)",
      "4차시. 검증과 수정",
      "4차시. 수정·보완 프롬프트",
      "5차시. Lovable 구현과 수정 기록",
      "6차시. 발표: 앞 장을 추려서"
    ];
    var items = CAPTIONS.map(function (c, i) {
      var n = (i < 9 ? "0" : "") + (i + 1);
      return { src: "img/vibe/" + n + ".jpg", thumb: "img/vibe/" + n + "-s.jpg", caption: c };
    });
    var at = 0;

    items.forEach(function (it, i) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", (i + 1) + "쪽 보기");
      b.innerHTML = '<img src="' + it.thumb + '" alt="" loading="lazy">';
      b.addEventListener("click", function () { go(i); });
      li.appendChild(b);
      thumbs.appendChild(li);
    });
    var thumbButtons = $all("button", thumbs);

    function go(i) {
      at = (i + items.length) % items.length;
      img.src = items[at].src;
      img.alt = items[at].caption;
      count.textContent = String(at + 1);
      caption.textContent = items[at].caption;
      thumbButtons.forEach(function (b, k) {
        if (k === at) b.setAttribute("aria-current", "true");
        else b.removeAttribute("aria-current");
      });
    }
    $("#gal-prev").addEventListener("click", function () { go(at - 1); });
    $("#gal-next").addEventListener("click", function () { go(at + 1); });
    view.addEventListener("click", function () { lightbox.open(items, at, go); });
    go(0);

    return { step: function (d) { go(at + d); } };
  })();

  /* ---------- 2부 실습: QR ---------- */
  var practice = (function () {
    var box = $("#practice-qr");
    if (!box) return null;
    var card = $("#practice-card");
    var address = $("#practice-address");
    var tabs = $("#practice-tabs");
    var openBtn = $("#practice-open");

    var worksheet = DERIVED.worksheet;
    var padlet = filled(p2.practicePadlet) ? p2.practicePadlet.trim() : "";
    var host = stripProtocol(shelfBase || "sci-shelf.netlify.app");
    var which = "worksheet";

    function render() {
      address.classList.remove("is-long");
      if (which === "padlet" && padlet) {
        qrInto(card, padlet, "실습 안내 패들렛 QR", "");
        address.classList.add("is-long");
        address.innerHTML = '<span class="qr-host">패들렛</span><span class="qr-code">' +
          escapeHtml(stripProtocol(padlet)) + "</span>";
      } else {
        qrInto(card, worksheet, "연수용 활동지 QR", "책장 코드가 정해지면 QR이 나타납니다");
        address.innerHTML = '<span class="qr-host">' + escapeHtml(host) + "/w/</span>" +
          (shelfCode
            ? '<span class="qr-code">' + escapeHtml(shelfCode) + "</span>"
            : '<span class="qr-code pending">책장 코드 ' + PENDING + "</span>");
      }
      $all("button", tabs).forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-qr") === which));
      });
    }

    // 패들렛 링크가 있을 때만 전환 단추를 보인다
    if (padlet) {
      tabs.hidden = false;
      box.classList.add("has-tabs");
      $all("button", tabs).forEach(function (b) {
        b.addEventListener("click", function () {
          which = b.getAttribute("data-qr");
          render();
        });
      });
    }
    if (worksheet && openBtn) {
      openBtn.href = worksheet;
      openBtn.hidden = false;
    }
    render();

    return {
      toggle: function () {
        if (!padlet) return;
        which = which === "worksheet" ? "padlet" : "worksheet";
        render();
      }
    };
  })();

  /* ---------- 영상 ----------
     site/media 에 파일이 있으면 재생기를, 없으면(배포된 사이트) 안내 문구를 보인다 */
  $all("[data-video]").forEach(function (box) {
    var name = get(box.getAttribute("data-video"));
    if (!filled(name)) return;
    var video = document.createElement("video");
    video.controls = true;
    video.preload = "metadata";
    video.playsInline = true;
    video.hidden = true;
    video.addEventListener("loadedmetadata", function () {
      video.hidden = false;
      box.classList.add("has-video");
    });
    video.src = "media/" + encodeURIComponent(name.trim());
    box.appendChild(video);
  });
  function sceneVideo(scene) { return $(".video-box.has-video video", scene); }

  /* ---------- 복습 모드는 여기까지 ---------- */
  if (!isPresent) {
    document.addEventListener("keydown", function (e) {
      if (!lightbox || !lightbox.isOpen()) return;
      if (e.key === "Escape") lightbox.close();
      else if (e.key === "ArrowRight") lightbox.move(1);
      else if (e.key === "ArrowLeft") lightbox.move(-1);
    });
    return;
  }

  /* ---------- 발표 모드 ---------- */
  var rail = $("#rail");
  var railPart = $("#rail-part");
  var railTrack = $("#rail-track");
  var railCount = $("#rail-count");
  var notesPanel = $("#notes-panel");
  var notesOn = false;

  // 무대(1920×1080)를 창 크기에 맞춘다
  function fitStage() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.setProperty("--fit", String(s));
  }
  window.addEventListener("resize", fitStage);
  fitStage();

  // 긴 제목은 글자를 줄여 정해진 높이 안에 넣는다. data-fit="처음 크기,최소 크기,최대 높이"
  function fitText(el) {
    var spec = (el.getAttribute("data-fit") || "").split(",").map(Number);
    if (spec.length < 3) return;
    var size = spec[0];
    el.style.fontSize = size + "px";
    while (size > spec[1] && el.offsetHeight > spec[2]) {
      size -= 4;
      el.style.fontSize = size + "px";
    }
  }
  function fitAll() { $all("[data-fit]").forEach(fitText); }
  fitAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);

  // 진행 표시 눈금: 장면마다 하나
  scenes.forEach(function (sc) {
    var tick = document.createElement("i");
    tick.setAttribute("data-part", sc.getAttribute("data-part"));
    railTrack.appendChild(tick);
  });
  var ticks = $all("i", railTrack);

  function renderNotes() {
    var src = $(".notes", scenes[current]);
    if (notesOn && src) {
      notesPanel.innerHTML = '<span class="notes-label">발표자 메모</span>' + src.innerHTML;
      notesPanel.hidden = false;
    } else if (notesOn) {
      notesPanel.innerHTML = '<span class="notes-label">발표자 메모</span><p>이 장면에는 메모가 없습니다.</p>';
      notesPanel.hidden = false;
    } else {
      notesPanel.hidden = true;
    }
  }

  function show(i, keepHash) {
    var leaving = scenes[current];
    current = Math.max(0, Math.min(scenes.length - 1, i));
    var sc = scenes[current];
    var part = sc.getAttribute("data-part");
    // 장면을 떠나면 영상을 멈춘다
    if (leaving !== sc) {
      var v = sceneVideo(leaving);
      if (v && !v.paused) v.pause();
    }
    scenes.forEach(function (s, k) { s.classList.toggle("is-current", k === current); });
    ticks.forEach(function (t, k) { t.classList.toggle("is-current", k === current); });
    rail.setAttribute("data-part", part);
    rail.classList.toggle("is-off", sc.getAttribute("data-rail") === "off");
    rail.classList.toggle("on-dark", sc.getAttribute("data-tone") === "dark");
    railPart.textContent = PART_LABEL[part] || "";
    railCount.textContent = (current + 1) + " / " + scenes.length;
    renderNotes();
    if (!keepHash && history.replaceState) {
      history.replaceState(null, "", location.pathname + location.search + "#" + sc.id);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (root.requestFullscreen) root.requestFullscreen();
  }

  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    var key = e.key;
    var code = e.code || ""; // 한글 입력 상태에서도 되도록 글자 키는 자판 위치로 본다
    var sc = scenes[current];

    // 그림을 크게 보는 동안에는 ← → 가 장을 넘기고, Esc가 닫는다
    if (lightbox && lightbox.isOpen()) {
      if (key === "Escape") lightbox.close();
      else if (key === "ArrowRight" || key === "ArrowDown" || key === "PageDown") lightbox.move(1);
      else if (key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp") lightbox.move(-1);
      else return;
      e.preventDefault();
      return;
    }

    if (key === "ArrowRight" || key === "PageDown") { show(current + 1); e.preventDefault(); }
    else if (key === "ArrowLeft" || key === "PageUp") { show(current - 1); e.preventDefault(); }
    else if (key === "Home") { show(0); e.preventDefault(); }
    else if (key === "End") { show(scenes.length - 1); e.preventDefault(); }
    else if (key === "ArrowDown" || key === "ArrowUp") {
      // 양식 갤러리 장면에서는 ↑ ↓ 로 장을 넘긴다
      if (gallery && sc.id === "p1-template") { gallery.step(key === "ArrowDown" ? 1 : -1); e.preventDefault(); }
    }
    else if (code === "Space") {
      // 영상 장면에서는 스페이스바로 재생/일시정지
      var v = sceneVideo(sc);
      if (v) {
        if (v.paused) v.play(); else v.pause();
        e.preventDefault();
      }
    }
    else if (code === "KeyF") { toggleFullscreen(); }
    else if (code === "KeyN") { notesOn = !notesOn; renderNotes(); }
    else if (code === "KeyQ") {
      if (practice && sc.id === "practice") practice.toggle();
    }
    else if (/^(Digit|Numpad)[123]$/.test(code)) {
      var idx = firstSceneOfPart(code.slice(-1));
      if (idx >= 0) show(idx);
    }
  }, true);

  // 주소의 #장면이름 으로 시작 위치를 정한다 (새로 고침해도 같은 장면)
  function fromHash() {
    var id = decodeURIComponent(location.hash.replace(/^#/, ""));
    for (var i = 0; i < scenes.length; i++) if (scenes[i].id === id) return i;
    return 0;
  }
  window.addEventListener("hashchange", function () { show(fromHash(), true); });
  show(fromHash(), true);
})();
