/*!
* SVGPathCommander v0.0.2 (http://thednp.github.io/svg-path-commander)
* Copyright 2020 © thednp
* Licensed under MIT (https://github.com/thednp/svg-path-commander/blob/master/LICENSE)
*/
function clonePath(pathArray){
  return pathArray.map(function (x) { return Array.isArray(x) ? clonePath(x) : !isNaN(+x) ? +x : x; } )
}

var SVGPathCommanderOptions = {
  decimals:3,
  round:1
};

function roundPath(pathArray) {
  return SVGPathCommanderOptions.round ?
    pathArray.map( function (seg) { return seg.map(function (c,i) {
        var nr = +c, dc = Math.pow(10,SVGPathCommanderOptions.decimals);
        return i ? (nr % 1 === 0 ? nr : (nr*dc>>0)/dc) : c
      }
    ); }) : clonePath(pathArray)
}

function SVGPathArray(pathString){
  this.segments = [];
  this.pathValue = pathString;
  this.max = pathString.length;
  this.index  = 0;
  this.param = 0.0;
  this.segmentStart = 0;
  this.data = [];
  this.err = '';
  return this
}

var paramCounts = { a: 7, c: 6, h: 1, l: 2, m: 2, r: 4, q: 4, s: 4, t: 2, v: 1, z: 0 };

function finalizeSegment(state) {
  var cmd = state.pathValue[state.segmentStart], cmdLC = cmd.toLowerCase(), params = state.data;
  if (cmdLC === 'm' && params.length > 2) {
    state.segments.push([ cmd, params[0], params[1] ]);
    params = params.slice(2);
    cmdLC = 'l';
    cmd = (cmd === 'm') ? 'l' : 'L';
  }
  if (cmdLC === 'r') {
    state.segments.push([ cmd ].concat(params));
  } else {
    while (params.length >= paramCounts[cmdLC]) {
      state.segments.push([ cmd ].concat(params.splice(0, paramCounts[cmdLC])));
      if (!paramCounts[cmdLC]) {
        break;
      }
    }
  }
}

var invalidPathValue = 'Invalid path value';

function scanFlag(state) {
  var ch = state.pathValue.charCodeAt(state.index);
  if (ch === 0x30) {
    state.param = 0;
    state.index++;
    return;
  }
  if (ch === 0x31) {
    state.param = 1;
    state.index++;
    return;
  }
  state.err = invalidPathValue;
}

function isDigit(code) {
  return (code >= 48 && code <= 57);
}

function scanParam(state) {
  var start = state.index,
      index = start,
      max = state.max,
      zeroFirst = false,
      hasCeiling = false,
      hasDecimal = false,
      hasDot = false,
      ch;
  if (index >= max) {
    state.err = invalidPathValue;
    return;
  }
  ch = state.pathValue.charCodeAt(index);
  if (ch === 0x2B || ch === 0x2D) {
    index++;
    ch = (index < max) ? state.pathValue.charCodeAt(index) : 0;
  }
  if (!isDigit(ch) && ch !== 0x2E) {
    state.err = invalidPathValue;
    return;
  }
  if (ch !== 0x2E) {
    zeroFirst = (ch === 0x30);
    index++;
    ch = (index < max) ? state.pathValue.charCodeAt(index) : 0;
    if (zeroFirst && index < max) {
      if (ch && isDigit(ch)) {
        state.err = invalidPathValue;
        return;
      }
    }
    while (index < max && isDigit(state.pathValue.charCodeAt(index))) {
      index++;
      hasCeiling = true;
    }
    ch = (index < max) ? state.pathValue.charCodeAt(index) : 0;
  }
  if (ch === 0x2E) {
    hasDot = true;
    index++;
    while (isDigit(state.pathValue.charCodeAt(index))) {
      index++;
      hasDecimal = true;
    }
    ch = (index < max) ? state.pathValue.charCodeAt(index) : 0;
  }
  if (ch === 0x65 || ch === 0x45) {
    if (hasDot && !hasCeiling && !hasDecimal) {
      state.err = invalidPathValue;
      return;
    }
    index++;
    ch = (index < max) ? state.pathValue.charCodeAt(index) : 0;
    if (ch === 0x2B || ch === 0x2D) {
      index++;
    }
    if (index < max && isDigit(state.pathValue.charCodeAt(index))) {
      while (index < max && isDigit(state.pathValue.charCodeAt(index))) {
        index++;
      }
    } else {
      state.err = invalidPathValue;
      return;
    }
  }
  state.index = index;
  state.param = +state.pathValue.slice(start, index);
}

function isCommand(code) {
  switch (code | 0x20) {
    case 0x6D:
    case 0x7A:
    case 0x6C:
    case 0x68:
    case 0x76:
    case 0x63:
    case 0x73:
    case 0x71:
    case 0x74:
    case 0x61:
    case 0x72:
      return true;
  }
  return false;
}

function isDigitStart(code) {
  return (code >= 48 && code <= 57) ||
          code === 0x2B ||
          code === 0x2D ||
          code === 0x2E;
}

function isArc(code) {
  return (code | 0x20) === 0x61;
}

function isSpace(ch) {
  var specialSpaces = [
    0x1680, 0x180E, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
    0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000, 0xFEFF ];
  return (ch === 0x0A) || (ch === 0x0D) || (ch === 0x2028) || (ch === 0x2029) ||
    (ch === 0x20) || (ch === 0x09) || (ch === 0x0B) || (ch === 0x0C) || (ch === 0xA0) ||
    (ch >= 0x1680 && specialSpaces.indexOf(ch) >= 0);
}

function skipSpaces(state) {
  while (state.index < state.max && isSpace(state.pathValue.charCodeAt(state.index))) {
    state.index++;
  }
}

function scanSegment(state) {
  var max = state.max, cmdCode, comma_found, need_params, i;
  state.segmentStart = state.index;
  cmdCode = state.pathValue.charCodeAt(state.index);
  if (!isCommand(cmdCode)) {
    state.err = invalidPathValue;
    return;
  }
  need_params = paramCounts[state.pathValue[state.index].toLowerCase()];
  state.index++;
  skipSpaces(state);
  state.data = [];
  if (!need_params) {
    finalizeSegment(state);
    return;
  }
  comma_found = false;
  for (;;) {
    for (i = need_params; i > 0; i--) {
      if (isArc(cmdCode) && (i === 3 || i === 4)) { scanFlag(state); }
      else { scanParam(state); }
      if (state.err.length) {
        return;
      }
      state.data.push(state.param);
      skipSpaces(state);
      comma_found = false;
      if (state.index < max && state.pathValue.charCodeAt(state.index) === 0x2C) {
        state.index++;
        skipSpaces(state);
        comma_found = true;
      }
    }
    if (comma_found) {
      continue;
    }
    if (state.index >= state.max) {
      break;
    }
    if (!isDigitStart(state.pathValue.charCodeAt(state.index))) {
      break;
    }
  }
  finalizeSegment(state);
}

function parsePathString(pathString) {
  if ( Array.isArray(pathString) && Array.isArray(pathString[0])) {
    return clonePath(pathString)
  }
  var state = new SVGPathArray(pathString), max = state.max;
  skipSpaces(state);
  while (state.index < max && !state.err.length) {
    scanSegment(state);
  }
  if (state.err.length) {
    state.segments = [];
  } else if (state.segments.length) {
    if ('mM'.indexOf(state.segments[0][0]) < 0) {
      state.err = invalidPathValue;
      state.segments = [];
    } else {
      state.segments[0][0] = 'M';
    }
  }
  return roundPath(state.segments)
}

function catmullRom2bezier(crp, z) {
  var d = [];
  for (var i = 0, iLen = crp.length; iLen - 2 * !z > i; i += 2) {
    var p = [
              {x: +crp[i - 2], y: +crp[i - 1]},
              {x: +crp[i],     y: +crp[i + 1]},
              {x: +crp[i + 2], y: +crp[i + 3]},
              {x: +crp[i + 4], y: +crp[i + 5]}
            ];
    if (z) {
      if (!i) {
        p[0] = {x: +crp[iLen - 2], y: +crp[iLen - 1]};
      } else if (iLen - 4 == i) {
        p[3] = {x: +crp[0], y: +crp[1]};
      } else if (iLen - 2 == i) {
        p[2] = {x: +crp[0], y: +crp[1]};
        p[3] = {x: +crp[2], y: +crp[3]};
      }
    } else {
      if (iLen - 4 == i) {
        p[3] = p[2];
      } else if (!i) {
        p[0] = {x: +crp[i], y: +crp[i + 1]};
      }
    }
    d.push([
      "C",
      (-p[0].x + 6 * p[1].x + p[2].x) / 6,
      (-p[0].y + 6 * p[1].y + p[2].y) / 6,
      (p[1].x + 6 * p[2].x - p[3].x) / 6,
      (p[1].y + 6*p[2].y - p[3].y) / 6,
      p[2].x,
      p[2].y
    ]);
  }
  return d
}

function ellipsePath(x, y, rx, ry, a) {
  if (a == null && ry == null) {
    ry = rx;
  }
  x = +x;
  y = +y;
  rx = +rx;
  ry = +ry;
  var res;
  if (a != null) {
    var rad = Math.PI / 180,
        x1 = x + rx * Math.cos(-ry * rad),
        x2 = x + rx * Math.cos(-a * rad),
        y1 = y + rx * Math.sin(-ry * rad),
        y2 = y + rx * Math.sin(-a * rad);
    res = [["M", x1, y1], ["A", rx, rx, 0, +(a - ry > 180), 0, x2, y2]];
  } else {
    res = [
        ["M", x, y],
        ["m", 0, -ry],
        ["a", rx, ry, 0, 1, 1, 0, 2 * ry],
        ["a", rx, ry, 0, 1, 1, 0, -2 * ry],
        ["z"]
    ];
  }
  return res;
}

function pathToAbsolute(pathArray) {
  pathArray = parsePathString(pathArray);
  if (!pathArray || !pathArray.length) {
    return [["M", 0, 0]];
  }
  var resultArray = [],
      x = 0, y = 0, mx = 0, my = 0,
      start = 0, ii = pathArray.length,
      crz = pathArray.length === 3 &&
            pathArray[0][0] === "M" &&
            pathArray[1][0].toUpperCase() === "R" &&
            pathArray[2][0].toUpperCase() === "Z";
  if (pathArray[0][0] === "M") {
    x = +pathArray[0][1];
    y = +pathArray[0][2];
    mx = x;
    my = y;
    start++;
    resultArray[0] = ["M", x, y];
  }
  var loop = function ( i ) {
    var r = [], pa = pathArray[i], pa0 = pa[0], dots = [];
    resultArray.push(r = []);
    if (pa0 !== pa0.toUpperCase()) {
      r[0] = pa0.toUpperCase();
      switch (r[0]) {
        case "A":
          r[1] = pa[1];
          r[2] = pa[2];
          r[3] = pa[3];
          r[4] = pa[4];
          r[5] = pa[5];
          r[6] = +pa[6] + x;
          r[7] = +pa[7] + y;
          break;
        case "V":
          r[1] = +pa[1] + y;
          break;
        case "H":
          r[1] = +pa[1] + x;
          break;
        case "R":
          dots = [x, y].concat(pa.slice(1));
          for (var j = 2, jj = dots.length; j < jj; j++) {
            dots[j] = +dots[j] + x;
            dots[++j] = +dots[j] + y;
          }
          resultArray.pop();
          resultArray = resultArray.concat(catmullRom2bezier(dots, crz));
          break;
        case "O":
          resultArray.pop();
          dots = ellipsePath(x, y, +pa[1], +pa[2]);
          dots.push(dots[0]);
          resultArray = resultArray.concat(dots);
          break;
        case "U":
          resultArray.pop();
          resultArray = resultArray.concat(ellipsePath(x, y, pa[1], pa[2], pa[3]));
          r = ["U"].concat(resultArray[resultArray.length - 1].slice(-2));
          break;
        case "M":
          mx = +pa[1] + x;
          my = +pa[2] + y;
        default:
          for (var k = 1, kk = pa.length; k < kk; k++) {
            r[k] = +pa[k] + ((k % 2) ? x : y);
          }
      }
    } else if (pa0 === "R") {
      dots = [x, y].concat(pa.slice(1));
      resultArray.pop();
      resultArray = resultArray.concat(catmullRom2bezier(dots, crz));
      r = ["R"].concat(pa.slice(-2));
    } else if (pa0 === "O") {
      resultArray.pop();
      dots = ellipsePath(x, y, +pa[1], +pa[2]);
      dots.push(dots[0]);
      resultArray = resultArray.concat(dots);
    } else if (pa0 === "U") {
      resultArray.pop();
      resultArray = resultArray.concat(ellipsePath(x, y, +pa[1], +pa[2], +pa[3]));
      r = ["U"].concat(resultArray[resultArray.length - 1].slice(-2));
    } else {
      pa.map(function (k){ return r.push(k); });
    }
    pa0 = pa0.toUpperCase();
    if (pa0 !== "O") {
      switch (r[0]) {
        case "Z":
          x = mx;
          y = my;
          break;
        case "H":
          x = +r[1];
          break;
        case "V":
          y = +r[1];
          break;
        case "M":
          mx = +r[r.length - 2];
          my = +r[r.length - 1];
        default:
          x = +r[r.length - 2];
          y = +r[r.length - 1];
      }
    }
  };
  for (var i = start; i < ii; i++) loop( i );
  return roundPath(resultArray)
}

function pathToRelative (pathArray) {
  pathArray = parsePathString(pathArray);
  var resultArray = [],
      x = 0, y = 0, mx = 0, my = 0,
      start = 0, ii = pathArray.length;
  if (pathArray[0][0] === "M") {
    x = +pathArray[0][1];
    y = +pathArray[0][2];
    mx = x;
    my = y;
    start++;
    resultArray.push(["M", x, y]);
  }
  var loop = function ( i ) {
    var r = (void 0), pa = pathArray[i];
    resultArray.push(r = []);
    if (pa[0] !== pa[0].toLowerCase() ) {
      r[0] = pa[0].toLowerCase();
      switch (r[0]) {
        case "a":
          r[1] = pa[1];
          r[2] = pa[2];
          r[3] = pa[3];
          r[4] = pa[4];
          r[5] = pa[5];
          r[6] = +pa[6] - x;
          r[7] = +pa[7] - y;
          break;
        case "v":
          r[1] = +pa[1] - y;
          break;
        case "m":
          mx = +pa[1];
          my = +pa[2];
        default:
          for (var j = 1, jj = pa.length; j < jj; j++) {
            r[j] = +pa[j] - ((j % 2) ? x : y);
          }
      }
    } else {
      r = [];
      resultArray[i] = r;
      if (pa[0] === "m") {
        mx = +pa[1] + x;
        my = +pa[2] + y;
      }
      pa.map(function (k){ return resultArray[i].push(k); });
    }
    var len = resultArray[i].length;
    switch (resultArray[i][0]) {
      case "z":
        x = mx;
        y = my;
        break;
      case "h":
        x += resultArray[i][len - 1];
        break;
      case "v":
        y += resultArray[i][len - 1];
        break;
      default:
        x += resultArray[i][len - 2];
        y += resultArray[i][len - 1];
    }
  };
  for (var i = start; i < ii; i++) loop( i );
  return roundPath(resultArray)
}

function pathToString(pathArray) {
  return pathArray.map( function (c) {
    if (typeof c === 'string') {
      return c
    } else {
      return c.shift() + c.join(' ')
    }
  }).join('')
}

function reverseCurve(pathCurveArray){
  var curveSegments = clonePath(pathCurveArray),
      curveCount = curveSegments.length - 2,
      ci = 0, ni = 0,
      currentSeg = [],
      nextSeg = [],
      x1, y1, x2, y2, x, y,
      curveOnly = curveSegments.slice(1),
      rotatedCurve = curveOnly.map(function (p,i){
        ci = curveCount - i;
        ni = ci - 1 < 0 ? curveCount : ci - 1;
        currentSeg = curveOnly[ci];
        nextSeg = curveOnly[ni];
        x = nextSeg[nextSeg.length - 2];
        y = nextSeg[nextSeg.length - 1];
        x1 = currentSeg[3]; y1 = currentSeg[4];
        x2 = currentSeg[1]; y2 = currentSeg[2];
        return ['C',x1,y1,x2,y2,x,y]
      });
  return [['M',x,y]].concat(rotatedCurve)
}

function rotateVector(x, y, rad) {
  var X = x * Math.cos(rad) - y * Math.sin(rad),
      Y = x * Math.sin(rad) + y * Math.cos(rad);
  return {x: X, y: Y}
}

function a2c(x1, y1, rx, ry, angle, large_arc_flag, sweep_flag, x2, y2, recursive) {
  var _120 = Math.PI * 120 / 180,
      rad = Math.PI / 180 * (angle || 0),
      res = [], xy, f1, f2, cx, cy;
  if (!recursive) {
    xy = rotateVector(x1, y1, -rad);
    x1 = xy.x; y1 = xy.y;
    xy = rotateVector(x2, y2, -rad);
    x2 = xy.x; y2 = xy.y;
    var x = (x1 - x2) / 2,
        y = (y1 - y2) / 2,
        h = (x * x) / (rx * rx) + (y * y) / (ry * ry);
    if (h > 1) {
      h = Math.sqrt(h);
      rx = h * rx;
      ry = h * ry;
    }
    var rx2 = rx * rx,
        ry2 = ry * ry,
        k = (large_arc_flag == sweep_flag ? -1 : 1)
          * Math.sqrt(Math.abs((rx2 * ry2 - rx2 * y * y - ry2 * x * x)
          / (rx2 * y * y + ry2 * x * x)));
    cx = k * rx * y / ry + (x1 + x2) / 2;
    cy = k * -ry * x / rx + (y1 + y2) / 2;
    f1 = Math.asin( ((y1 - cy) / ry).toFixed(9) );
    f2 = Math.asin( ((y2 - cy) / ry).toFixed(9) );
    f1 = x1 < cx ? Math.PI - f1 : f1;
    f2 = x2 < cx ? Math.PI - f2 : f2;
    f1 < 0 && (f1 = Math.PI * 2 + f1);
    f2 < 0 && (f2 = Math.PI * 2 + f2);
    if (sweep_flag && f1 > f2) {
      f1 = f1 - Math.PI * 2;
    }
    if (!sweep_flag && f2 > f1) {
      f2 = f2 - Math.PI * 2;
    }
  } else {
    f1 = recursive[0];
    f2 = recursive[1];
    cx = recursive[2];
    cy = recursive[3];
  }
  var df = f2 - f1;
  if (Math.abs(df) > _120) {
    var f2old = f2, x2old = x2, y2old = y2;
    f2 = f1 + _120 * (sweep_flag && f2 > f1 ? 1 : -1);
    x2 = cx + rx * Math.cos(f2);
    y2 = cy + ry * Math.sin(f2);
    res = a2c(x2, y2, rx, ry, angle, 0, sweep_flag, x2old, y2old, [f2, f2old, cx, cy]);
  }
  df = f2 - f1;
  var c1 = Math.cos(f1),
      s1 = Math.sin(f1),
      c2 = Math.cos(f2),
      s2 = Math.sin(f2),
      t = Math.tan(df / 4),
      hx = 4 / 3 * rx * t,
      hy = 4 / 3 * ry * t,
      m1 = [x1, y1],
      m2 = [x1 + hx * s1, y1 - hy * c1],
      m3 = [x2 + hx * s2, y2 - hy * c2],
      m4 = [x2, y2];
  m2[0] = 2 * m1[0] - m2[0];
  m2[1] = 2 * m1[1] - m2[1];
  if (recursive) {
    return [m2, m3, m4].concat(res);
  } else {
    res = [m2, m3, m4].concat(res).join().split(",");
    return res.map(function (rz,i){ return i % 2 ? rotateVector(res[i - 1], rz, rad).y : rotateVector(rz, res[i + 1], rad).x; });
  }
}

function q2c (x1, y1, ax, ay, x2, y2) {
  var _13 = 1 / 3, _23 = 2 / 3;
  return [
          _13 * x1 + _23 * ax,
          _13 * y1 + _23 * ay,
          _13 * x2 + _23 * ax,
          _13 * y2 + _23 * ay,
          x2, y2 ]
}

function l2c(x1, y1, x2, y2) {
  return [x1, y1, x2, y2, x2, y2]
}

function processSegment(segment, params, pathCommand) {
  var nx, ny;
  if (!segment) {
    return ["C", params.x, params.y, params.x, params.y, params.x, params.y];
  }
  !(segment[0] in {T: 1, Q: 1}) && (params.qx = params.qy = null);
  switch (segment[0]) {
    case "M":
      params.X = segment[1];
      params.Y = segment[2];
      break;
    case "A":
      segment = ["C"].concat(a2c.apply(0, [params.x, params.y].concat(segment.slice(1))));
      break;
    case "S":
      if (pathCommand === "C" || pathCommand === "S") {
        nx = params.x * 2 - params.bx;
        ny = params.y * 2 - params.by;
      }
      else {
        nx = params.x;
        ny = params.y;
      }
      segment = ["C", nx, ny].concat(segment.slice(1));
      break;
    case "T":
      if (pathCommand === "Q" || pathCommand === "T") {
        params.qx = params.x * 2 - params.qx;
        params.qy = params.y * 2 - params.qy;
      }
      else {
        params.qx = params.x;
        params.qy = params.y;
      }
      segment = ["C"].concat(q2c(params.x, params.y, params.qx, params.qy, segment[1], segment[2]));
      break;
    case "Q":
      params.qx = segment[1];
      params.qy = segment[2];
      segment = ["C"].concat(q2c(params.x, params.y, segment[1], segment[2], segment[3], segment[4]));
      break;
    case "L":
      segment = ["C"].concat(l2c(params.x, params.y, segment[1], segment[2]));
      break;
    case "H":
      segment = ["C"].concat(l2c(params.x, params.y, segment[1], params.y));
      break;
    case "V":
      segment = ["C"].concat(l2c(params.x, params.y, params.x, segment[1]));
      break;
    case "Z":
      segment = ["C"].concat(l2c(params.x, params.y, params.X, params.Y));
      break;
  }
  return segment;
}

function fixM(path1, path2, a1, a2, i, count) {
  if (path1 && path2 && path1[i][0] === "M" && path2[i][0] !== "M") {
    path2.splice(i, 0, ["M", a2.x, a2.y]);
    a1.bx = 0;
    a1.by = 0;
    a1.x = path1[i][1];
    a1.y = path1[i][2];
    count = Math.max(p.length, p2 && p2.length || 0);
  }
}

function fixArc(p, p2, pc1, pc2, i, count) {
  if (p[i].length > 7) {
    p[i].shift();
    var pi = p[i];
    while (pi.length) {
      pc1[i] = "A";
      p2 && (pc2[i] = "A");
      p.splice(i++, 0, ["C"].concat(pi.splice(0, 6)));
    }
    p.splice(i, 1);
    count = Math.max(p.length, p2 && p2.length || 0);
  }
}

function pathToCurve(path, path2) {
  var p = pathToAbsolute(path),
      p2 = path2 && pathToAbsolute(path2),
      attrs = {x: 0, y: 0, bx: 0, by: 0, X: 0, Y: 0, qx: null, qy: null},
      attrs2 = {x: 0, y: 0, bx: 0, by: 0, X: 0, Y: 0, qx: null, qy: null};
  var pcoms1 = [], pcoms2 = [],
      pathCommand = "", pcom = "",
      ii = Math.max(p.length, p2 && p2.length || 0);
  for (var i = 0; i < (ii = Math.max(p.length, p2 && p2.length || 0)); i++) {
    p[i] && (pathCommand = p[i][0]);
    if (pathCommand !== "C") {
      pcoms1[i] = pathCommand;
      i && ( pcom = pcoms1[i - 1]);
    }
    p[i] = processSegment(p[i], attrs, pcom);
    if (pcoms1[i] !== "A" && pathCommand === "C") { pcoms1[i] = "C"; }
    fixArc(p,p2,pcoms1,pcoms2,i,ii);
    if (p2) {
      p2[i] && (pathCommand = p2[i][0]);
      if (pathCommand !== "C") {
        pcoms2[i] = pathCommand;
        i && (pcom = pcoms2[i - 1]);
      }
      p2[i] = processSegment(p2[i], attrs2, pcom);
      if (pcoms2[i] !== "A" && pathCommand === "C") {
        pcoms2[i] = "C";
      }
      fixArc(p2,p,pcoms2,pcoms1,i,ii);
    }
    fixM(p, p2, attrs, attrs2, i, ii);
    fixM(p2, p, attrs2, attrs, i, ii);
    var seg = p[i],
        seg2 = p2 && p2[i],
        seglen = seg.length,
        seg2len = p2 && seg2.length;
    attrs.x = +seg[seglen - 2];
    attrs.y = +seg[seglen - 1];
    attrs.bx = +(seg[seglen - 4]) || attrs.x;
    attrs.by = +(seg[seglen - 3]) || attrs.y;
    attrs2.bx = p2 && (+(seg2[seg2len - 4]) || attrs2.x);
    attrs2.by = p2 && (+(seg2[seg2len - 3]) || attrs2.y);
    attrs2.x = p2 && seg2[seg2len - 2];
    attrs2.y = p2 && seg2[seg2len - 1];
  }
  return p2 ? [roundPath(p), roundPath(p2)] : roundPath(p)
}

function reversePath(pathArray){
  var isClosed = pathToAbsolute(pathArray).some(function (x){ return x[0].toUpperCase() === 'Z'; }),
      pathCurveArray = reverseCurve(pathToCurve(pathArray)),
      result = [],
      pathCommand,
      x1, y1, x2, y2, x, y,
      prevSeg = [],
      px, py;
  return pathCurveArray.map(function (p,i){
    x  = p[p.length - 2];
    y  = p[p.length - 1];
    x1 = p[1]; y1 = p[2];
    x2 = p[3]; y2 = p[4];
    prevSeg = i - 1 < 0 ? pathCurveArray[pathCurveArray.length - 1] : pathCurveArray[i - 1];
    px = prevSeg[prevSeg.length - 2];
    py = prevSeg[prevSeg.length - 1];
    if (p.length === 3) {
      pathCommand = 'M';
    } else if (py===y && py===y1) {
      pathCommand = 'H';
    } else if (px===x && px===x1) {
      pathCommand = 'V';
    } else if ( px===x1 && py===y1 && x===x2 && y===y2 ) {
      pathCommand = 'L';
    } else {
      pathCommand = p[0];
    }
    switch(pathCommand) {
      case 'M':
        result = ['M', x,y];
        break;
      case 'L':
        result = [pathCommand, x,y];
        break;
      case 'V':
        result = [pathCommand, y];
        break;
      case 'H':
        result = [pathCommand, x];
        break;
      case 'C':
        result = [pathCommand,x1,y1,x2,y2,x,y];
        break;
      default:
        result = [pathCommand];
    }
    return result
  })
  .concat(isClosed ? [['Z']] : [])
}

function splitPath(pathString) {
  return pathString
    .replace( /(m|M)/g, "|$1")
    .split('|')
    .map(function (s){ return s.trim(); })
    .filter(function (s){ return s; })
}

function optimizePath(pathArray){
  var absolutePath = pathToAbsolute(pathArray),
      relativePath = pathToRelative(pathArray);
  return absolutePath.map(function (x,i) { return i ? (x.join('').length < relativePath[i].join('').length ? x : relativePath[i]) : x; } )
}

var SVGPathCommander = function SVGPathCommander(pathValue){
  var path = parsePathString(pathValue);
  this.segments = clonePath(path);
  this.pathValue = pathValue;
  return this
};
SVGPathCommander.prototype.toAbsolute = function toAbsolute (){
  var path = pathToAbsolute(this.segments);
  this.segments = clonePath(path);
  return this
};
SVGPathCommander.prototype.toRelative = function toRelative (){
  var path = pathToRelative(this.segments);
  this.segments = clonePath(path);
  return this
};
SVGPathCommander.prototype.reverse = function reverse (onlySubpath){
  this.toAbsolute();
  var subPath = splitPath(this.pathValue).length > 1 && splitPath(this.toString()),
      absoluteMultiPath = subPath && clonePath(subPath).map(function (x,i){
        return onlySubpath ? (i ? reversePath(x) : parsePathString(x)) : reversePath(x)
      }),
      path = subPath ? [].concat.apply([], absoluteMultiPath) : reversePath(this.segments);
  this.segments = clonePath(path);
  return this
};
SVGPathCommander.prototype.optimize = function optimize (){
  var path = optimizePath(this.segments);
  this.segments = clonePath(path);
  return this
};
SVGPathCommander.prototype.toString = function toString (){
  return pathToString(this.segments)
};

function getArea(v) {
  var x0 = v[0], y0 = v[1],
      x1 = v[2], y1 = v[3],
      x2 = v[4], y2 = v[5],
      x3 = v[6], y3 = v[7];
  return 3 * ((y3 - y0) * (x1 + x2) - (x3 - x0) * (y1 + y2)
          + y1 * (x0 - x2) - x1 * (y0 - y2)
          + y3 * (x2 + x0 / 3) - x3 * (y2 + y0 / 3)) / 20;
}

function getShapeArea(curveArray) {
  var cv = curveArray.slice(1), previous;
  return cv.map(function (seg,i){
    previous = cv[i === 0 ? cv.length-1 : i-1];
    return getArea(previous.slice(previous.length-2).concat(seg.slice(1)))
  }).reduce(function (a, b) { return a + b; }, 0)
}

function getDrawDirection(curveArray) {
  if (Array.isArray(curveArray) && curveArray.slice(1).every(function (x){ return x[0] === 'C'; })) {
    return getShapeArea(curveArray) >= 0
  } else {
    throw("getDrawDirection expects a curveArray")
  }
}

var util = {
  clonePath: clonePath,
  getDrawDirection: getDrawDirection,
  getShapeArea: getShapeArea,
  splitPath: splitPath,
  roundPath: roundPath,
  optimizePath: optimizePath,
  pathToAbsolute: pathToAbsolute,
  pathToRelative: pathToRelative,
  pathToCurve: pathToCurve,
  pathToString: pathToString,
  parsePathString: parsePathString,
  reverseCurve: reverseCurve,
  reversePath: reversePath,
  options: SVGPathCommanderOptions
};

for (var x in util) { SVGPathCommander[x] = util[x]; }

export default SVGPathCommander;