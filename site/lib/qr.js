/*
 * 작은 QR 코드 생성기 (외부 라이브러리 없이 직접 그린다)
 * - 바이트 모드(UTF-8), 오류 정정 수준 M, 버전 1~40
 * - 사용법: QR.svg("https://example.com")  →  SVG 문자열
 *           QR.matrix("...")               →  { size, dark(x, y) }
 */
(function (root) {
  "use strict";

  // 버전별(1~40) 블록당 오류 정정 코드워드 수와 블록 수. 오류 정정 수준 M 기준
  var ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
    26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
  var NUM_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
    17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];

  // 문자열을 UTF-8 바이트 배열로
  function utf8(text) {
    var out = [];
    var enc = encodeURIComponent(text);
    for (var i = 0; i < enc.length; i++) {
      if (enc.charAt(i) === "%") {
        out.push(parseInt(enc.substr(i + 1, 2), 16));
        i += 2;
      } else {
        out.push(enc.charCodeAt(i));
      }
    }
    return out;
  }

  // 기능 패턴을 뺀, 데이터가 들어갈 수 있는 모듈 수
  function rawModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }

  function dataCodewords(ver) {
    return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];
  }

  // GF(2^8) 곱셈 (원시 다항식 0x11D)
  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  // 리드-솔로몬 생성 다항식
  function rsDivisor(degree) {
    var result = [];
    var i, j;
    for (i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var rootv = 1;
    for (i = 0; i < degree; i++) {
      for (j = 0; j < result.length; j++) {
        result[j] = gfMul(result[j], rootv);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      rootv = gfMul(rootv, 0x02);
    }
    return result;
  }

  function rsRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ result.shift();
      result.push(0);
      divisor.forEach(function (coef, i) { result[i] ^= gfMul(coef, factor); });
    });
    return result;
  }

  // 데이터 코드워드에 오류 정정 코드워드를 붙이고 블록을 섞는다
  function addEccAndInterleave(data, ver) {
    var numBlocks = NUM_BLOCKS[ver];
    var eccLen = ECC_PER_BLOCK[ver];
    var rawCodewords = Math.floor(rawModules(ver) / 8);
    var numShort = numBlocks - (rawCodewords % numBlocks);
    var shortLen = Math.floor(rawCodewords / numBlocks);
    var divisor = rsDivisor(eccLen);
    var blocks = [];
    var k = 0;
    for (var i = 0; i < numBlocks; i++) {
      var dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
      k += dat.length;
      var ecc = rsRemainder(dat, divisor);
      if (i < numShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var result = [];
    for (var c = 0; c < blocks[0].length; c++) {
      for (var b = 0; b < blocks.length; b++) {
        // 짧은 블록의 채움 자리는 건너뛴다
        if (c !== shortLen - eccLen || b >= numShort) result.push(blocks[b][c]);
      }
    }
    return result;
  }

  function alignmentPositions(ver) {
    if (ver === 1) return [];
    var size = ver * 4 + 17;
    var n = Math.floor(ver / 7) + 2;
    var step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    var result = [6];
    for (var pos = size - 7; result.length < n; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  var MASKS = [
    function (x, y) { return (x + y) % 2 === 0; },
    function (x, y) { return y % 2 === 0; },
    function (x, y) { return x % 3 === 0; },
    function (x, y) { return (x + y) % 3 === 0; },
    function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
    function (x, y) { return (x * y) % 2 + (x * y) % 3 === 0; },
    function (x, y) { return ((x * y) % 2 + (x * y) % 3) % 2 === 0; },
    function (x, y) { return ((x + y) % 2 + (x * y) % 3) % 2 === 0; }
  ];

  function build(text) {
    var bytes = utf8(String(text));

    // 1) 들어갈 수 있는 가장 작은 버전 고르기
    var ver = 0;
    for (var v = 1; v <= 40; v++) {
      var countBits = v < 10 ? 8 : 16;
      if (4 + countBits + bytes.length * 8 <= dataCodewords(v) * 8) { ver = v; break; }
    }
    if (!ver) throw new Error("QR에 담기에는 글이 너무 깁니다");

    // 2) 비트열 만들기: 모드(0100) + 길이 + 데이터 + 종료 + 채움
    var bits = [];
    function push(val, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    }
    push(4, 4);
    push(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(function (b) { push(b, 8); });
    var capacity = dataCodewords(ver) * 8;
    push(0, Math.min(4, capacity - bits.length));
    push(0, (8 - (bits.length % 8)) % 8);
    for (var pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) {
      var byte = 0;
      for (var j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      data.push(byte);
    }
    var codewords = addEccAndInterleave(data, ver);

    // 3) 모듈 격자 준비
    var size = ver * 4 + 17;
    var mod = [];
    var fn = [];
    for (var y = 0; y < size; y++) {
      mod.push(new Array(size).fill(false));
      fn.push(new Array(size).fill(false));
    }
    function setFn(x, y, dark) {
      mod[y][x] = dark;
      fn[y][x] = true;
    }

    // 타이밍 패턴
    for (var t = 0; t < size; t++) {
      setFn(6, t, t % 2 === 0);
      setFn(t, 6, t % 2 === 0);
    }
    // 위치 찾기 패턴 3개 (둘레 분리선 포함)
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var dist = Math.max(Math.abs(dx), Math.abs(dy));
          var xx = c[0] + dx;
          var yy = c[1] + dy;
          if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    });
    // 정렬 패턴
    var align = alignmentPositions(ver);
    var na = align.length;
    for (var a = 0; a < na; a++) {
      for (var b = 0; b < na; b++) {
        if ((a === 0 && b === 0) || (a === 0 && b === na - 1) || (a === na - 1 && b === 0)) continue;
        for (var ay = -2; ay <= 2; ay++) {
          for (var ax = -2; ax <= 2; ax++) {
            setFn(align[a] + ax, align[b] + ay, Math.max(Math.abs(ax), Math.abs(ay)) !== 1);
          }
        }
      }
    }

    // 형식 정보 (오류 정정 수준 M의 형식 비트는 0)
    function drawFormat(mask) {
      var d = mask;
      var rem = d;
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var fbits = ((d << 10) | rem) ^ 0x5412;
      function bit(i) { return ((fbits >>> i) & 1) !== 0; }
      var k;
      for (k = 0; k <= 5; k++) setFn(8, k, bit(k));
      setFn(8, 7, bit(6));
      setFn(8, 8, bit(7));
      setFn(7, 8, bit(8));
      for (k = 9; k < 15; k++) setFn(14 - k, 8, bit(k));
      for (k = 0; k < 8; k++) setFn(size - 1 - k, 8, bit(k));
      for (k = 8; k < 15; k++) setFn(8, size - 15 + k, bit(k));
      setFn(8, size - 8, true);
    }
    drawFormat(0);

    // 버전 정보 (버전 7 이상)
    if (ver >= 7) {
      var vrem = ver;
      for (var q = 0; q < 12; q++) vrem = (vrem << 1) ^ ((vrem >>> 11) * 0x1f25);
      var vbits = (ver << 12) | vrem;
      for (var w = 0; w < 18; w++) {
        var vb = ((vbits >>> w) & 1) !== 0;
        var va = size - 11 + (w % 3);
        var vc = Math.floor(w / 3);
        setFn(va, vc, vb);
        setFn(vc, va, vb);
      }
    }

    // 4) 코드워드를 지그재그로 채우기
    var idx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var jj = 0; jj < 2; jj++) {
          var x = right - jj;
          var upward = ((right + 1) & 2) === 0;
          var yPos = upward ? size - 1 - vert : vert;
          if (!fn[yPos][x] && idx < codewords.length * 8) {
            mod[yPos][x] = ((codewords[idx >>> 3] >>> (7 - (idx & 7))) & 1) !== 0;
            idx++;
          }
        }
      }
    }

    // 5) 마스크 8가지를 모두 대 보고 벌점이 가장 낮은 것을 고른다
    function applyMask(m) {
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x];
        }
      }
    }

    function penalty() {
      var score = 0;
      var x, y, run, color, dark = 0;
      var P1 = [true, false, true, true, true, false, true, false, false, false, false];
      var P2 = [false, false, false, false, true, false, true, true, true, false, true];
      function line(get) {
        // 같은 색이 5개 이상 이어진 구간
        run = 1;
        color = get(0);
        for (var i = 1; i < size; i++) {
          if (get(i) === color) {
            run++;
            if (run === 5) score += 3;
            else if (run > 5) score++;
          } else {
            color = get(i);
            run = 1;
          }
        }
        // 위치 찾기 패턴과 닮은 무늬
        for (var s = 0; s + 11 <= size; s++) {
          var m1 = true;
          var m2 = true;
          for (var k = 0; k < 11; k++) {
            if (get(s + k) !== P1[k]) m1 = false;
            if (get(s + k) !== P2[k]) m2 = false;
          }
          if (m1) score += 40;
          if (m2) score += 40;
        }
      }
      for (y = 0; y < size; y++) line(function (i) { return mod[y][i]; });
      for (x = 0; x < size; x++) line(function (i) { return mod[i][x]; });
      // 2x2 같은 색 덩어리
      for (y = 0; y < size - 1; y++) {
        for (x = 0; x < size - 1; x++) {
          var c = mod[y][x];
          if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) score += 3;
        }
      }
      // 어두운 모듈 비율
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (mod[y][x]) dark++;
      var total = size * size;
      score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return score;
    }

    var best = 0;
    var bestScore = Infinity;
    for (var m = 0; m < 8; m++) {
      applyMask(m);
      drawFormat(m);
      var sc = penalty();
      if (sc < bestScore) { bestScore = sc; best = m; }
      applyMask(m); // 되돌리기
    }
    applyMask(best);
    drawFormat(best);

    return { size: size, version: ver, dark: function (x, y) { return mod[y][x]; } };
  }

  // SVG 문자열로 그리기. margin은 둘레 여백(모듈 수), 기본 4
  function svg(text, opts) {
    opts = opts || {};
    var margin = opts.margin == null ? 4 : opts.margin;
    var fg = opts.color || "#000";
    var bg = opts.background || "#fff";
    var q = build(text);
    var n = q.size + margin * 2;
    var d = "";
    for (var y = 0; y < q.size; y++) {
      for (var x = 0; x < q.size; x++) {
        if (!q.dark(x, y)) continue;
        var start = x;
        while (x + 1 < q.size && q.dark(x + 1, y)) x++;
        var len = x - start + 1;
        d += "M" + (start + margin) + " " + (y + margin) + "h" + len + "v1h-" + len + "z";
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + " " + n +
      '" shape-rendering="crispEdges" role="img"' +
      (opts.label ? ' aria-label="' + String(opts.label).replace(/"/g, "&quot;") + '"' : "") + ">" +
      '<rect width="' + n + '" height="' + n + '" fill="' + bg + '"/>' +
      '<path fill="' + fg + '" d="' + d + '"/></svg>';
  }

  var QR = { matrix: build, svg: svg };
  root.QR = QR;
  if (typeof module !== "undefined" && module.exports) module.exports = QR;
})(typeof window !== "undefined" ? window : globalThis);
