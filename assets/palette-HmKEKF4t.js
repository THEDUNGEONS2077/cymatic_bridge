function e(e){if(!e)return null;let n;try{n=JSON.parse(e)}catch{return null}if(!n||typeof n!=`object`)return null;let r=n;return r.app!==`cymatic_bridge`||typeof r.v!=`string`||typeof r.title!=`string`?null:{v:r.v.slice(0,32),title:t(r.title)}}function t(e){let t=e.replace(/\s+/g,` `).trim();return t=t.replace(/^\(\d+\+?\)\s*/,``),t=t.replace(/\s*[-–—]\s*YouTube( Music)?$/i,``),/^YouTube( Music)?$/i.test(t)?``:t.slice(0,300)}function n(e,t){let n=e.split(`.`).map(e=>parseInt(e,10)||0),r=t.split(`.`).map(e=>parseInt(e,10)||0);for(let e=0;e<Math.max(n.length,r.length);e++){let t=n[e]??0,i=r[e]??0;if(t!==i)return t<i}return!1}var r={bandsL:0,bandsR:64,wave:128,scalars:192},i={level:0,bass:1,lowMid:2,highMid:3,treble:4,beat:5,beatCount:6,accent:7,flow:8,balance:9,idle:10,cost:11},a=r.scalars+12;function o(e,t,n){e[r.scalars+i[t]]=n}function s(e,t){return e[r.scalars+i[t]]??0}var c=3.5,l=-120;function u(e,t,n,r=30,i=16e3){let a=n/(t*2),o=(i/r)**(1/e),s=[];for(let n=0;n<e;n++){let e=r*o**+n,i=e*o,l=Math.sqrt(e*i);s.push({lowHz:e,highHz:i,centreHz:l,from:e/a,to:Math.min(t-1,i/a),tiltDb:c*Math.log2(l/1e3)})}return s}var d=e=>10**(Math.max(l,e)/10);function f(e,t){let n=Math.floor(t),r=t-n,i=d(e[n]??-120);return i+(d(e[n+1]??-120)-i)*r}function ee(e,t,n){for(let r=0;r<t.length;r++){let i=t[r],a;if(i.to-i.from<1)a=f(e,(i.from+i.to)/2);else{let t=0,n=0;for(let r=Math.round(i.from);r<=Math.round(i.to);r++)t+=d(e[r]??-120),n++;a=n?t/n:d(l)}n[r]=10*Math.log10(Math.max(a,1e-30))+i.tiltDb}}function p(e,t,n){let r=e.length,i=0;return e.forEach((e,a)=>{e.centreHz>=t&&e.centreHz<n&&(r=Math.min(r,a),i=Math.max(i,a+1))}),r<i?[r,i]:[0,0]}var m=1.5,te=1.6,h=.35,g=.15;function _(e){return{prev:new Float32Array(e),mean:0,variance:0,since:1/0,pulse:0,count:0}}function ne(e,t,n,r){let i=0;for(let r=0;r<t.length;r++){let a=t[r]-e.prev[r];a>0&&(i+=a*(n[r]??1)),e.prev[r]=t[r]}i*=1/60/Math.max(r,1/240)*(64/Math.max(1,t.length)),e.since+=r,e.pulse*=Math.exp(-r/g);let a=Math.sqrt(e.variance),o=Math.max(h,e.mean+te*a),s=0;i>o&&e.since>=.12&&(s=Math.min(1,.5+.5*((i-o)/o)),e.pulse=Math.max(e.pulse,s),e.since=0,e.count++);let c=1-Math.exp(-r/m),l=i-e.mean;return e.mean+=c*l,e.variance=(1-c)*(e.variance+c*l*l),s}function v(e,t,n){let r=new Float32Array(e);return t.forEach(([e,t],i)=>{for(let a=e;a<t;a++)r[a]=n[i]??1}),r}var y=2.5;function re(){return{peakDb:-62}}function ie(e,t,n){let r=e.peakDb-y*n;e.peakDb=Math.max(-62,Number.isFinite(t)?Math.max(r,Math.min(12,t)):r)}function ae(e,t){let n=(t-(e.peakDb-48))/48;return n<=0||!Number.isFinite(n)?0:n>=1?1:n}function b(e,t,n,r){let i=t>e?r.attack:r.release;return i<=0?t:e+(t-e)*(1-Math.exp(-n/i))}var x=.8,S=.14,C=.08;function oe(){return{amount:1,silentFor:1/0}}function se(e,t,n){e.silentFor=t<.02?e.silentFor+n:0;let r=+(e.silentFor>=1.5);return e.amount+=(r-e.amount)*(1-Math.exp(-n/x)),e.amount}function ce(e,t){let n=2*Math.PI*t/7,r=Math.sin(n),i=Math.sin(n*.6-e*5.3),a=S+C*(.6*r+.4*i);return Math.max(0,a*(1-.55*e))}var w=.8,T=.2;function E(){return{value:0,since:1/0}}function le(e,t,n){return e.since+=n,e.value*=Math.exp(-n/T),t>=.6&&e.since>=.34&&(e.value=w*t,e.since=0),e.value}var D={bands:{attack:.015,release:.14},levels:{attack:.01,release:.25},beatWeights:[1,.6,.35,.25]},ue=[[0,150],[150,600],[600,2500],[2500,1e9]],de=.25,fe=1.75,pe={attack:.3,release:.3},me=.5;function O(e,t,n=D,o=0){let s=u(64,e,t),c=ue.map(([e,t])=>p(s,e,t)),d=v(64,c,n.beatWeights),f=o?u(16,o,t,40):[],m=ue.map(([e,t])=>p(f,e,t)),te=v(16,m,n.beatWeights),h=new Float32Array(16),g=new Float32Array(16),y=re(),x=_(16),S=n,C=new Float32Array(64),w=new Float32Array(64),T=new Float32Array(64),O=new Float32Array(64),k=new Float32Array(64),A=new Float32Array(e).fill(l),j=new Float32Array(a),M=re(),N=_(64),he=E(),P=oe();j[r.scalars+i.idle]=1;let F=.05,I=0,L=(e,t)=>j[r.scalars+i[e]]=t,R=e=>j[r.scalars+i[e]];return{signal:j,setProfile(e){S=e,d=v(64,c,e.beatWeights),te=v(16,m,e.beatWeights)},step(e,t,n){t=Math.min(Math.max(t,0),.1),ee(e?.binsL??A,s,C),ee(e?.binsR??A,s,w);let i=-1/0;for(let e=0;e<64;e++)i=Math.max(i,C[e],w[e]);ie(M,i,t);let a=0,o=0,l=0;for(let e=0;e<64;e++)T[e]=ae(M,C[e]),O[e]=ae(M,w[e]),k[e]=(T[e]+O[e])/2,a+=k[e],o+=T[e],l+=O[e];a/=64;let u=se(P,a,t),p=1-u,m,_;if(e?.binsFast&&f.length){ee(e.binsFast,f,h);let n=-1/0;for(let e=0;e<16;e++)n=Math.max(n,h[e]);ie(y,n,t);for(let e=0;e<16;e++)g[e]=ae(y,h[e]);m=ne(x,g,te,t),_=x}else m=ne(N,k,d,t),_=N;let v=m*+(u<.5),re=le(he,v,t);for(let e=0;e<64;e++){let i=ce(e/63,n)*u,a=T[e]*p+i,o=O[e]*p+i;j[r.bandsL+e]=b(j[r.bandsL+e],a,t,S.bands),j[r.bandsR+e]=b(j[r.bandsR+e],o,t,S.bands)}let oe=0;for(let e=0;e<64;e++)oe+=(j[r.bandsL+e]+j[r.bandsR+e])/2;L(`level`,b(R(`level`),oe/64,t,S.levels));let E=[`bass`,`lowMid`,`highMid`,`treble`];c.forEach(([e,n],i)=>{let a=0;for(let t=e;t<n;t++)a+=(j[r.bandsL+t]+j[r.bandsR+t])/2;L(E[i],b(R(E[i]),n>e?a/(n-e):0,t,S.levels))}),L(`beat`,_.pulse*p),L(`beatCount`,N.count+x.count),L(`accent`,re*p);let D=o+l;return L(`balance`,b(R(`balance`),D>.001?(l-o)/D:0,t,pe)),ge(e,j,t,p),L(`idle`,u),I+=t*(de+fe*R(`level`)),L(`flow`,I),j}};function ge(e,t,n,i){if(!e){for(let e=0;e<64;e++)t[r.wave+e]=0;return}let a=e.waveL.length,o=Math.max(1,Math.floor(a/64)),s=0;for(let n=0;n<64;n++){let i=0;for(let t=n*o;t<Math.min(a,(n+1)*o);t++){let n=(e.waveL[t]+(e.waveR[t]??e.waveL[t]))/2;Math.abs(n)>Math.abs(i)&&(i=n)}s=Math.max(s,Math.abs(i)),t[r.wave+n]=i}F=Math.max(s,F*Math.exp(-n/me),.02);for(let e=0;e<64;e++)t[r.wave+e]=t[r.wave+e]/F*i}}var k=[{id:`uv`,label:`UV`,colors:{bg:`#000000`,surface:`#07050d`,surfaceRaised:`#0e0a18`,line:`#261a3d`,lineLit:`#3d1a5c`,wash:`#1e0838`,textDim:`#a173e0`,text:`#bb8ef0`,accent:`#c25bff`,accentDeep:`#6a2aa8`,textBright:`#ecd6ff`,cool:`#20e0c0`}},{id:`laser`,label:`LASER`,colors:{bg:`#000000`,surface:`#090203`,surfaceRaised:`#110305`,line:`#33090f`,lineLit:`#59101b`,wash:`#29070c`,textDim:`#d34b5f`,text:`#ee576e`,accent:`#ff2e4d`,accentDeep:`#8c192a`,textBright:`#ffcbd2`,cool:`#5fe3ff`}},{id:`acid`,label:`ACID`,colors:{bg:`#000000`,surface:`#060902`,surfaceRaised:`#0c1103`,line:`#253309`,lineLit:`#405910`,wash:`#1d2907`,textDim:`#a4d34b`,text:`#b3ec45`,accent:`#b8ff2e`,accentDeep:`#658c19`,textBright:`#edffcb`,cool:`#8a5cff`}},{id:`solar`,label:`SOLAR`,colors:{bg:`#000000`,surface:`#090501`,surfaceRaised:`#110902`,line:`#331c06`,lineLit:`#59300b`,wash:`#291605`,textDim:`#d38641`,text:`#ec8e39`,accent:`#ff8a1f`,accentDeep:`#8c4c11`,textBright:`#ffe2c7`,cool:`#3a6dff`}},{id:`aurora`,label:`AURORA`,colors:{bg:`#000000`,surface:`#020906`,surfaceRaised:`#04110b`,line:`#0c3323`,lineLit:`#15593e`,wash:`#0a291c`,textDim:`#54d39f`,text:`#51ecad`,accent:`#3dffb0`,accentDeep:`#228c61`,textBright:`#ceffeb`,cool:`#ff4fd8`}},{id:`toxic`,label:`TOXIC`,colors:{bg:`#000000`,surface:`#090802`,surfaceRaised:`#110f03`,line:`#332d09`,lineLit:`#594f10`,wash:`#292407`,textDim:`#d3c04b`,text:`#ecd645`,accent:`#ffe32e`,accentDeep:`#8c7d19`,textBright:`#fff8cb`,cool:`#a04dff`}},{id:`frost`,label:`FROST`,colors:{bg:`#000000`,surface:`#060809`,surfaceRaised:`#0a0e11`,line:`#202b33`,lineLit:`#384c59`,wash:`#192329`,textDim:`#94b9d3`,text:`#9fcdec`,accent:`#9fd8ff`,accentDeep:`#57778c`,textBright:`#e7f5ff`,cool:`#5b5bff`}},{id:`flare`,label:`FLARE`,colors:{bg:`#000000`,surface:`#090306`,surfaceRaised:`#11050c`,line:`#331024`,lineLit:`#591c3f`,wash:`#290d1d`,textDim:`#d360a1`,text:`#ec5faf`,accent:`#ff4fb3`,accentDeep:`#8c2b62`,textBright:`#ffd3ec`,cool:`#2ee6ff`}}];k.map(e=>e.id);function A(e){return k.find(t=>t.id===e)??k[0]}var j={bg:`--bg`,surface:`--surface`,surfaceRaised:`--surface-raised`,line:`--line`,lineLit:`--line-lit`,wash:`--xp-wash`,textDim:`--text-dim`,text:`--text`,accent:`--accent`,accentDeep:`--accent-deep`,textBright:`--text-bright`,cool:`--cool`},M=[`low`,`medium`,`high`,`max`],N=[.5,.67,.75,.8,.9,1,1.1,1.25,1.5,1.75,2],he=[.5,.75,1,1.25,1.5,2],P=[{id:`plexus`,name:`PLEXUS`,defaults:{palette:`uv`,glow:`high`,sensitivity:1,trails:0,zoom:1},profile:D,trails:!0},{id:`coderain`,name:`CODE RAIN EQ`,defaults:{palette:`uv`,glow:`high`,sensitivity:1,trails:0,zoom:1},profile:D,trails:!1},{id:`test`,name:`TEST`,defaults:{palette:`uv`,glow:`high`,sensitivity:1,trails:.5,zoom:1},profile:D,trails:!0,dev:!0}],F=P[0].id;function I(e){return P.find(t=>t.id===e)??P[0]}function L(e,t){let n=P.findIndex(t=>t.id===e),r=P.length;return P[(((n<0?0:n)+t)%r+r)%r].id}var R=1e3,ge=3e3;function _e(e,t,n){return Math.min(Number.isFinite(e)&&e>0?Math.max(1,e):1,n===`safe`?t:3)}function ve(e,t){return _e(e,t,`full`)>t+1e-6}function ye(e,t){if(!e.length)return NaN;let n=[...e].sort((e,t)=>e-t);return n[Math.min(n.length-1,Math.max(0,Math.ceil(t*n.length)-1))]}function be(e,t=8){return e.length<30?null:ye(e,.95)>t?`safe`:`full`}function xe(e){let t={};if(!e||typeof e!=`object`||Array.isArray(e))return t;for(let[n,r]of Object.entries(e))n&&n.length<=64&&(r===`full`||r===`safe`)&&(t[n]=r);return t}var Se=`[{id:\`uv\`,label:\`UV\`,colors:{bg:\`#000000\`,surface:\`#07050d\`,surfaceRaised:\`#0e0a18\`,line:\`#261a3d\`,lineLit:\`#3d1a5c\`,wash:\`#1e0838\`,textDim:\`#a173e0\`,text:\`#bb8ef0\`,accent:\`#c25bff\`,accentDeep:\`#6a2aa8\`,textBright:\`#ecd6ff\`,cool:\`#20e0c0\`}},{id:\`laser\`,label:\`LASER\`,colors:{bg:\`#000000\`,surface:\`#090203\`,surfaceRaised:\`#110305\`,line:\`#33090f\`,lineLit:\`#59101b\`,wash:\`#29070c\`,textDim:\`#d34b5f\`,text:\`#ee576e\`,accent:\`#ff2e4d\`,accentDeep:\`#8c192a\`,textBright:\`#ffcbd2\`,cool:\`#5fe3ff\`}},{id:\`acid\`,label:\`ACID\`,colors:{bg:\`#000000\`,surface:\`#060902\`,surfaceRaised:\`#0c1103\`,line:\`#253309\`,lineLit:\`#405910\`,wash:\`#1d2907\`,textDim:\`#a4d34b\`,text:\`#b3ec45\`,accent:\`#b8ff2e\`,accentDeep:\`#658c19\`,textBright:\`#edffcb\`,cool:\`#8a5cff\`}},{id:\`solar\`,label:\`SOLAR\`,colors:{bg:\`#000000\`,surface:\`#090501\`,surfaceRaised:\`#110902\`,line:\`#331c06\`,lineLit:\`#59300b\`,wash:\`#291605\`,textDim:\`#d38641\`,text:\`#ec8e39\`,accent:\`#ff8a1f\`,accentDeep:\`#8c4c11\`,textBright:\`#ffe2c7\`,cool:\`#3a6dff\`}},{id:\`aurora\`,label:\`AURORA\`,colors:{bg:\`#000000\`,surface:\`#020906\`,surfaceRaised:\`#04110b\`,line:\`#0c3323\`,lineLit:\`#15593e\`,wash:\`#0a291c\`,textDim:\`#54d39f\`,text:\`#51ecad\`,accent:\`#3dffb0\`,accentDeep:\`#228c61\`,textBright:\`#ceffeb\`,cool:\`#ff4fd8\`}},{id:\`toxic\`,label:\`TOXIC\`,colors:{bg:\`#000000\`,surface:\`#090802\`,surfaceRaised:\`#110f03\`,line:\`#332d09\`,lineLit:\`#594f10\`,wash:\`#292407\`,textDim:\`#d3c04b\`,text:\`#ecd645\`,accent:\`#ffe32e\`,accentDeep:\`#8c7d19\`,textBright:\`#fff8cb\`,cool:\`#a04dff\`}},{id:\`frost\`,label:\`FROST\`,colors:{bg:\`#000000\`,surface:\`#060809\`,surfaceRaised:\`#0a0e11\`,line:\`#202b33\`,lineLit:\`#384c59\`,wash:\`#192329\`,textDim:\`#94b9d3\`,text:\`#9fcdec\`,accent:\`#9fd8ff\`,accentDeep:\`#57778c\`,textBright:\`#e7f5ff\`,cool:\`#5b5bff\`}},{id:\`flare\`,label:\`FLARE\`,colors:{bg:\`#000000\`,surface:\`#090306\`,surfaceRaised:\`#11050c\`,line:\`#331024\`,lineLit:\`#591c3f\`,wash:\`#290d1d\`,textDim:\`#d360a1\`,text:\`#ec5faf\`,accent:\`#ff4fb3\`,accentDeep:\`#8c2b62\`,textBright:\`#ffd3ec\`,cool:\`#2ee6ff\`}}].map(e=>e.id);function e(e){let t=parseInt(e.replace(\`#\`,\`\`),16);return[(t>>16&255)/255,(t>>8&255)/255,(t&255)/255]}const t={bandsL:0,bandsR:64,wave:128,scalars:192},n={level:0,bass:1,lowMid:2,highMid:3,treble:4,beat:5,beatCount:6,accent:7,flow:8,balance:9,idle:10,cost:11},r=t.scalars+12;function i(){let e=new Float32Array(r);return e[t.scalars+n.idle]=1,e}const a={bands:{attack:.015,release:.14},levels:{attack:.01,release:.25},beatWeights:[1,.6,.35,.25]},o=[\`low\`,\`medium\`,\`high\`,\`max\`];({id:\`plexus\`,name:\`PLEXUS\`,defaults:{palette:\`uv\`,glow:\`high\`,sensitivity:1,trails:0,zoom:1},profile:a,trails:!0}).id;var s=\`// src/scene/shaders/draw.glsl: drawing helpers for fragment shaders, put
// after signal.glsl in front of every scene's fragment shader
// (scene/gl/program.ts). They use screen-space derivatives (dFdx) or
// gl_FragCoord, which only a fragment shader has.

// A smooth glowing line (cyberdeck's, PLAYBOOK 6.2): \\\`f\\\` is a field that's 0
// on the line, \\\`width\\\` its core in CSS px. Its distance in device px comes
// from the field's gradient length, so the line keeps its width at any
// angle. Returns the core plus a Gaussian glow scaled by GLOW.
float glowLine(float f, float width) {
  float g = length(vec2(dFdx(f), dFdy(f)));
  float d = abs(f) / max(g, 1e-6) / uDpr;           // CSS px from the line
  float core = exp(-0.5 * pow(d / max(width * 0.5, 0.35), 2.0));
  float glow = exp(-0.5 * pow(d / (width * 3.0 + 6.0 * uGlow), 2.0));
  return core + glow * (0.18 + 0.5 * uGlow);
}

// A tiny ordered noise (±0.5 of one 8-bit step), added last, so faint fades don't band.
vec3 dither(vec2 fragCoord) {
  float n = fract(52.9829189 * fract(dot(fragCoord, vec2(0.06711056, 0.00583715))));
  return vec3((n - 0.5) / 255.0);
}

// A fragment's light, rounded to the 8-bit step above or below at random
// (weighted, so on average it's exact): light drawn straight onto the canvas
// (a direct scene, stage.ts) fades smoothly, with no bands, even when many
// faint glows add up. Harmless in a half-float target.
vec3 ditherOut(vec3 c) {
  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  return floor(c * 255.0 + n) / 255.0;
}
\`,c=\`// src/scene/shaders/signal.glsl: the SIGNAL include, put in front of every
// scene shader, vertex and fragment alike (scene/gl/program.ts).
//
// Layer: scene shaders (GLSL ES 3.00). Everything a scene needs from the
// music, and the helpers that work in either stage (the fragment-only
// drawing helpers, glowLine and dither, are in draw.glsl):
//   - the signal texture (scene/gl/signalTexture.ts), 64 bands wide:
//       row 0     the bands now (R = left, G = right), 0..1;
//       row 1     the waveform (R), -1..1;
//       rows 2..  the history ring: HISTORY_ROWS past frames of the bands,
//                 the newest at uHead;
//   - the scalars as uniforms (lib/signal/layout.ts SCALAR);
//   - the scene's settings (palette, glow, sensitivity, trails, zoom);
//   - freqColor (frequency → the palette's pair, R22) and accentFlash (the
//     limited beat flash, R18).
// A vertex shader may read the signal too (PLEXUS sizes its links and nodes
// by their bands there): texture reads work in both stages.

precision highp float;
precision highp int;

// The signal.
uniform sampler2D uSignal;
uniform float uHead;
uniform vec4 uGroups;      // bass, low mids, high mids, treble (0..1)
uniform float uLevel;      // overall loudness (0..1)
uniform float uBeat;       // the beat pulse (0..1, decays)
uniform float uBeatCount;  // beats so far
uniform float uAccent;     // the beat accent, already limited (0..0.8)
uniform float uFlow;       // the flow clock (s): faster when loud
uniform float uBalance;    // stereo balance (-1..1)
uniform float uIdle;       // how idle (0..1)
uniform float uTime;       // real time (s)
uniform float uDt;         // this frame's step (s): fades and drifts per second, not per frame

// The canvas and the scene's settings.
uniform vec2 uRes;         // the target's size in device px
uniform float uDpr;        // device px per CSS px (lines are sized in CSS px)
uniform float uZoom;       // ZOOM (1 = as designed)
uniform float uGlow;       // GLOW: 0.25 (LOW) .. 1 (MAX)
uniform float uSensitivity;// SENSITIVITY (×)
uniform float uTrails;     // TRAILS (0..1)
uniform sampler2D uPrev;   // the scene's last frame (black without trails)

// The palette (lib/palettes.ts), sRGB 0..1.
uniform vec3 uColBg;
uniform vec3 uColLine;
uniform vec3 uColDim;
uniform vec3 uColText;
uniform vec3 uColAccent;
uniform vec3 uColBright;
uniform vec3 uColCool;

const float SIG_BANDS = 64.0;
const float HISTORY_ROWS = 128.0;
const float SIG_ROWS = HISTORY_ROWS + 2.0;

// The texture's u for band position x (0 = bass .. 1 = treble): band centres, interpolated between.
float sigU(float x) {
  return (clamp(x, 0.0, 1.0) * (SIG_BANDS - 1.0) + 0.5) / SIG_BANDS;
}

// The v of row r's centre (rows are never blended: always read at a centre).
float sigV(float r) {
  return (r + 0.5) / SIG_ROWS;
}

// Both channels at x now, after SENSITIVITY.
vec2 bandLR(float x) {
  return min(texture(uSignal, vec2(sigU(x), sigV(0.0))).rg * uSensitivity, vec2(1.0));
}

// The mean of both channels at x now.
float band(float x) {
  vec2 lr = bandLR(x);
  return (lr.x + lr.y) * 0.5;
}

// The waveform at x (0..1 across its window), -1..1.
float wave(float x) {
  return texture(uSignal, vec2(sigU(x), sigV(1.0))).r;
}

// Both channels at x, \\\`age\\\` ago (0 = the newest history row .. 1 = the oldest, ~2 s), eased between rows.
vec2 pastLR(float x, float age) {
  float r = clamp(age, 0.0, 1.0) * (HISTORY_ROWS - 1.0);
  float i = floor(r);
  float r0 = 2.0 + mod(uHead - i + HISTORY_ROWS, HISTORY_ROWS);
  float r1 = 2.0 + mod(uHead - i - 1.0 + HISTORY_ROWS, HISTORY_ROWS);
  vec2 a = texture(uSignal, vec2(sigU(x), sigV(r0))).rg;
  vec2 b = texture(uSignal, vec2(sigU(x), sigV(r1))).rg;
  return min(mix(a, b, r - i) * uSensitivity, vec2(1.0));
}

// The mean of both channels at x, \\\`age\\\` ago.
float past(float x, float age) {
  vec2 lr = pastLR(x, age);
  return (lr.x + lr.y) * 0.5;
}

// A level with SENSITIVITY applied.
float sens(float v) {
  return min(v * uSensitivity, 1.0);
}

// Frequency → colour (R22): the bass at the accent, the treble at the cool hue,
// through their mix, lifted a little toward bright where loud (energy 0..1).
vec3 freqColor(float x, float energy) {
  vec3 c = mix(uColAccent, uColCool, smoothstep(0.0, 1.0, clamp(x, 0.0, 1.0)));
  return mix(c, uColBright, 0.35 * energy * energy);
}

// The beat accent as a flash colour (R18: already limited to 3 a second, at most 0.8).
vec3 accentFlash(float strength) {
  return uColBright * uAccent * strength;
}

// How much of the last frame a trail keeps this frame: TRAILS sets how long
// a trail lasts (0.05 s .. 0.8 s to fade to a third), per second, so a 144 Hz
// screen trails as long as a 60 Hz one. 0 when TRAILS is off.
float trailKeep() {
  if (uTrails < 0.001) return 0.0;
  return exp(-uDt / mix(0.05, 0.8, uTrails));
}

// Screen position in CSS px, centred, zoomed (ZOOM: as if the screen were 1/zoom as big).
vec2 sceneCoord(vec2 fragCoord) {
  return (fragCoord - 0.5 * uRes) / uDpr / uZoom;
}
\`,l=\`#version 300 es
// src/scene/shaders/fullscreen.vert: the full-screen triangle, from gl_VertexID alone
// (corners at (-1,-1), (3,-1) and (-1,3): it covers the screen with no seam).
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
\`;function u(e,t,n){let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)&&!e.isContextLost()){let t=e.getShaderInfoLog(r);throw e.deleteShader(r),Error(\`shader: \${t}\`)}return r}function d(e,t,n){let r=e.createProgram(),i=u(e,e.VERTEX_SHADER,t),a=u(e,e.FRAGMENT_SHADER,n);if(e.attachShader(r,i),e.attachShader(r,a),e.linkProgram(r),e.deleteShader(i),e.deleteShader(a),!e.getProgramParameter(r,e.LINK_STATUS)&&!e.isContextLost())throw Error(\`program: \${e.getProgramInfoLog(r)}\`);return r}const f=e=>\`#version 300 es\\n\${c}\\n\${s}\\n\${e}\`;function p(e,t){return d(e,l,f(t))}function m(e,t,n){return d(e,\`#version 300 es\\n\${c}\\n\${t}\`,f(n))}function h(e,t){return d(e,l,t)}function g(e){e.drawArrays(e.TRIANGLES,0,3)}function _(e){let n=e.createTexture();e.bindTexture(e.TEXTURE_2D,n),e.texImage2D(e.TEXTURE_2D,0,e.RG16F,64,130,0,e.RG,e.FLOAT,/* @__PURE__ */ new Float32Array(16640)),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);let r=/* @__PURE__ */ new Float32Array(128),i=/* @__PURE__ */ new Float32Array(128),a=0,o=0;return{texture:n,get head(){return a},upload(s,c){for(let e=0;e<64;e++)r[e*2]=s[t.bandsL+e],r[e*2+1]=s[t.bandsR+e];for(let e=0;e<64;e++)i[e*2]=s[t.wave+e];for(e.bindTexture(e.TEXTURE_2D,n),e.texSubImage2D(e.TEXTURE_2D,0,0,0,64,1,e.RG,e.FLOAT,r),e.texSubImage2D(e.TEXTURE_2D,0,0,1,64,1,e.RG,e.FLOAT,i),o=Math.min(o+c*64,128);o>=1;)--o,a=(a+1)%128,e.texSubImage2D(e.TEXTURE_2D,0,0,2+a,64,1,e.RG,e.FLOAT,r)},destroy(){e.deleteTexture(n)}}}function v(e){return!!e.getExtension(\`EXT_color_buffer_float\`)}function y(e,t,n,r){let i=e.createTexture();e.bindTexture(e.TEXTURE_2D,i),r?e.texImage2D(e.TEXTURE_2D,0,e.RGBA16F,t,n,0,e.RGBA,e.HALF_FLOAT,null):e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t,n,0,e.RGBA,e.UNSIGNED_BYTE,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);let a=e.createFramebuffer();return e.bindFramebuffer(e.FRAMEBUFFER,a),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,i,0),e.clearColor(0,0,0,1),e.clear(e.COLOR_BUFFER_BIT),e.bindFramebuffer(e.FRAMEBUFFER,null),{texture:i,framebuffer:a,w:t,h:n}}function b(e,t){e.deleteTexture(t.texture),e.deleteFramebuffer(t.framebuffer)}function x(e){let t=e.createTexture();return e.bindTexture(e.TEXTURE_2D,t),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([0,0,0,255])),t}var S=\`// src/scene/scenes/coderain/beam.frag: the scan's beam and its point (the
// user's pick, SCAN, bouncing: monitor.ts).
//
// A full-screen pass scissored to the beam's strip (engine.ts). The beam: a
// soft column of light up and down the view at the scan, brightest at the
// horizon (the mock-ups' glow, stretched tall: an ellipse uBeam.y wide and
// 0.62 of the view tall), brighter while the heartbeat spikes. The point: a
// bright spark where the trace is being written, a near-white middle and a
// body in the beam's colour. Drawn additively, dithered.

uniform vec2 uCentre;   // the vanishing point, on the horizon (device px)
uniform vec3 uBeam;     // x, half-width (device px), brightness
uniform float uBand;    // the band under the scan (its colour)
uniform vec3 uSpark;    // x, y, radius (device px)
out vec4 outColor;

void main() {
  vec2 p = gl_FragCoord.xy;
  vec3 tint = freqColor(uBand, 0.25);
  vec2 u = vec2((p.x - uBeam.x) / uBeam.y, (p.y - uCentre.y) / (0.62 * uRes.y));
  float r2 = dot(u, u);
  vec3 col = tint * (uBeam.z * 0.85 * exp(-r2 / (2.0 * 0.28 * 0.28)) * (1.0 - smoothstep(0.8, 1.0, sqrt(r2))));
  vec2 s = (p - uSpark.xy) / uSpark.z;
  float s2 = dot(s, s);
  col += (mix(tint, vec3(1.0), 0.5) * exp(-s2 * 50.0) + tint * 0.9 * exp(-s2 * 8.0)) * (0.9 * (1.0 - smoothstep(0.8, 1.0, sqrt(s2))));
  // Light the screen can't show isn't blended (fewer writes).
  if (max(col.r, max(col.g, col.b)) < 1.0 / 1024.0) discard;
  outColor = vec4(ditherOut(col), 1.0);
}
\`,C=\`// src/scene/scenes/coderain/glyph.frag: a glyph of code.
//
// Its shape from the glyph sheet (glyphs.ts: the shape in R, a soft glow round
// it in G), in its colour, the glow as strong as GLOW makes it. A flaring head
// (its quad 2.8× the glyph) adds a soft light round it: a near-white middle
// and a body in its band's colour (the mock-ups' flare). Drawn additively and
// dithered here: CODE RAIN EQ draws straight onto the canvas (stage.ts direct).

uniform sampler2D uSheetTex;
uniform vec2 uSheet;  // the sheet's cells across and down

in vec2 vUv;
flat in vec2 vCell;
flat in float vScale;
flat in vec3 vColor;
flat in float vAlpha;
flat in float vFlare;
flat in vec3 vFlareColor;
out vec4 outColor;

void main() {
  // Where in the glyph's own cell (-1..1); beyond it (a flaring head's quad), no glyph, only the flare.
  vec2 g = vUv * vScale;
  float inside = step(abs(g.x), 1.0) * step(abs(g.y), 1.0);
  vec2 c = clamp(g, -1.0, 1.0);
  // The sheet's rows run down the image: up on the screen is up in the glyph. Sampled everywhere (then masked), so mipmaps see smooth derivatives.
  vec2 uv = vCell + vec2(c.x * 0.5 + 0.5, 0.5 - c.y * 0.5) / uSheet;
  vec2 t = texture(uSheetTex, uv).rg * inside;
  vec3 col = vColor * vAlpha * (t.r + t.g * (0.12 + 0.45 * uGlow));
  if (vFlare > 0.0) {
    float r2 = dot(vUv, vUv);
    col += (mix(vFlareColor, vec3(1.0), 0.5) * exp(-r2 * 50.0) + vFlareColor * 0.9 * exp(-r2 * 8.0)) * vFlare * (1.0 - smoothstep(0.8, 1.0, sqrt(r2)));
  }
  // Light the screen can't show isn't blended (fewer writes).
  if (max(col.r, max(col.g, col.b)) < 1.0 / 1024.0) discard;
  outColor = vec4(ditherOut(col), 1.0);
}
\`,w=\`// src/scene/scenes/coderain/glyph.vert: one glyph of a stream of code, as a quad.
//
// Instances come in runs of uTrail (engine.ts): each run is one stream (aStream
// and aState advance once a run: their divisor is TRAIL), and an instance's
// place in its run is its glyph's place in the stream: 0 the head, nearest the
// camera, then the trail behind it, uGap farther each. A glyph past the
// stream's length, faded out, or off the screen is hidden. The head is
// near-white (the palette's bright colour) and flares on a beat (bass
// streams); the trail is in its band's colour, fading toward its end, brighter
// with its band's loudness. The scan's beam lights the code it passes
// (uBeam): the nearer, the brighter (the user's pick, SCAN).

layout(location = 0) in vec4 aStream;  // angle, r, z (the head's depth), band
layout(location = 1) in vec4 aState;   // length (glyphs), loudness, flare, unused
layout(location = 2) in uint aGlyph;   // the glyph: its cell in the sheet

uniform float uTrail;    // glyphs a stream can show (rain.ts TRAIL)
uniform float uGap;      // depth between a stream's glyphs
uniform float uDeep;     // how deep the streams reach
uniform float uGlyphPx;  // a glyph's quad at depth 1 (device px)
uniform float uMaxPx;    // the biggest a glyph's quad gets (device px)
uniform vec2 uSheet;     // the sheet's cells across and down
uniform vec3 uBeam;      // the scan's beam: x, half-width (device px), how much it lights

out vec2 vUv;            // -1..1 across the quad
flat out vec2 vCell;     // the glyph's cell in the sheet: its top-left corner (0..1)
flat out float vScale;   // the quad's size over the glyph's (2.8 for a flaring head: room for its glow)
flat out vec3 vColor;
flat out float vAlpha;
flat out float vFlare;   // a head's flare (× its fog), drawn as a glow round it
flat out vec3 vFlareColor;

void main() {
  vec2 q = vec2[4](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0))[gl_VertexID];
  float i = float(gl_InstanceID % int(uTrail));
  float len = aState.x;
  float e = aState.y;
  float z = aStream.z + i * uGap;
  float fog = fogOf(z, uDeep);
  bool head = i < 0.5;
  // The head at full strength; the trail fading toward its end, brighter with its band's loudness.
  float a = head ? fog : pow(1.0 - i / (len + 1.0), 1.5) * (0.3 + 0.7 * e) * fog;
  if (i > len || a < 0.004) {
    gl_Position = HIDDEN;
    return;
  }
  vec2 p = project(aStream.x, aStream.y, z);
  float flare = head ? aState.z : 0.0;
  // A flaring head is drawn larger, and its quad 2.8× wider again for the glow round it.
  float glyph = 0.5 * min(uMaxPx, uGlyphPx / z) * (1.0 + 0.6 * flare);
  float scale = flare > 0.05 ? 2.8 : 1.0;
  float reach = glyph * scale;
  if (p.x < -reach || p.x > uRes.x + reach || p.y < -reach || p.y > uRes.y + reach) {
    gl_Position = HIDDEN;
    return;
  }
  // The beam lights the code under it.
  float dx = (p.x - uBeam.x) / uBeam.y;
  vAlpha = a * (1.0 + uBeam.z * exp(-dx * dx));
  vFlare = flare * 0.7 * fog;
  vFlareColor = freqColor(aStream.w, 0.2);
  vColor = head ? mix(uColBright, vec3(1.0), 0.4) : freqColor(aStream.w, 0.15);
  uint across = uint(uSheet.x);
  vCell = vec2(float(aGlyph % across), float(aGlyph / across)) / uSheet;
  vScale = scale;
  vUv = q;
  gl_Position = clipOf(p + q * reach);
}
\`;const T=\`"MS Gothic", "Yu Gothic", "Hiragino Sans", "Noto Sans CJK JP", "Noto Sans Mono CJK JP", monospace\`;let E=null;function D(){return E??=k(),E}function O(e){let t=new OffscreenCanvas(24,24).getContext(\`2d\`,{willReadFrequently:!0});if(!t)return!1;let n=e=>(t.clearRect(0,0,24,24),t.font=\`16px \${T}\`,t.textBaseline=\`middle\`,t.textAlign=\`center\`,t.fillStyle=\`#fff\`,t.fillText(e,12,12),t.getImageData(0,0,24,24).data),r=n(e),i=n(\`͸\`),a=!0,o=!0;for(let e=3;e<r.length;e+=4)r[e]&&(a=!1),r[e]!==i[e]&&(o=!1);return!a&&!o}function k(){let e=O(\`ｱ\`)?[...\`ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ\`]:[],t=[...e.map(e=>({char:e,mirrored:!0})),...[...\`0123456789ZTHEMXAKR:.=*+-<>¦|"\`].map(e=>({char:e,mirrored:!1}))],n=Math.ceil(t.length/16),r=1024,i=n*64,a=new Uint8Array(r*i*2),o=e=>{let n=new OffscreenCanvas(r,i).getContext(\`2d\`);return n?(n.font=\`42px \${T}\`,n.textAlign=\`center\`,n.textBaseline=\`middle\`,n.fillStyle=\`#fff\`,e&&(n.shadowColor=\`#fff\`,n.shadowBlur=e),t.forEach((e,t)=>{n.save(),n.translate((t%16+.5)*64,(Math.floor(t/16)+.5)*64),e.mirrored&&n.scale(-1,1),n.fillText(e.char,0,2),n.restore()}),n.getImageData(0,0,r,i).data):null},s=o(0),c=o(6);if(s&&c)for(let e=0;e<r*i;e++)a[e*2]=s[e*4+3],a[e*2+1]=c[e*4+3];return{data:a,w:r,h:i,cols:16,rows:n,count:t.length,kana:e.length}}var A=\`// src/scene/scenes/coderain/horizon.frag: the horizon: one straight line of
// light through the vanishing point, its glow following the music, and the
// heart monitor's trace on it.
//
// A full-screen pass scissored to a band round the horizon (engine.ts), so
// only those pixels run. Its light, from the user's picks (S5 mock-ups):
//   - the haze: a faint band of light along the horizon, stronger as the
//     music gets louder;
//   - the glow ("the horizon straight line react by how it glows"): a halo
//     along the line, taller and brighter where its band is loud (bass in the
//     middle, treble toward the edges: bandAlong), lifted by the level, and
//     round the scan (brighter while it writes a spike);
//   - the flat horizon, faint, fading out past the edges;
//   - the trace (monitor.ts: "as if it's a heartbeat pattern line"): the
//     heartbeat the bouncing scan has written, one height per column (uTrace:
//     R the height, G when written). It's drawn as a fine glowing line from
//     the pixel's distance to the nearest of the polyline's segments near it:
//     the nearest, not the sum, so the line is even along its length and the
//     sharp spikes stay sharp. Neighbours written on different passes aren't
//     joined, and a stretch fades as it ages.

uniform sampler2D uTrace;  // COLS × 1, RG32F: R the height (spike heights), G when written (uNow's clock)
uniform float uCols;       // COLS
uniform float uNow;        // the monitor's clock (s)
uniform float uTraceA;     // a spike's height (device px)
uniform vec2 uCentre;      // the vanishing point, on the horizon (device px)
uniform float uLvl;        // the level, eased
uniform float uAt;         // the scan: half-widths from the centre (-1..1)
uniform float uLive;       // how high the heartbeat is at the scan now (|height|)
out vec4 outColor;

// The band shown \\\`a\\\` half-widths from the centre: bass in the middle, treble at the edges. The power gives the bass
// and mids more room and joins the mirrored halves smoothly at the centre.
float bandAlong(float a) {
  return pow(min(a, 1.0), 1.4);
}

// A fine glowing line's light \\\`d\\\` CSS px from it: a bright core and two softer layers round it (the mock-ups' three
// strokes), the outer ones stronger and wider with GLOW.
float lineLight(float d) {
  float g = 0.6 + 0.6 * uGlow;
  float wide = 3.0 + 2.0 * uGlow;
  return exp(-0.5 * (d / 0.6) * (d / 0.6)) + 0.3 * g * exp(-0.5 * (d / 1.5) * (d / 1.5)) + 0.08 * g * exp(-0.5 * (d / wide) * (d / wide));
}

void main() {
  vec2 p = gl_FragCoord.xy;
  float x = (p.x - uCentre.x) / (0.5 * uRes.x);
  float a = abs(x);
  float fade = 1.0 - smoothstep(0.9, 1.12, a);
  float b = bandAlong(a);
  float e = band(b);
  float q = (x - uAt) / 0.05;
  // The glow: its band's loudness (squared: quiet stays calm, loud blooms), lifted by the level, plus the scan's own.
  float glow = min(1.4, 1.6 * e * e * (0.7 + 0.9 * uLvl) + (0.25 + 0.8 * uLive) * exp(-q * q));
  float dy = p.y - uCentre.y;
  float h = uRes.y;
  float k = 0.6 + 0.55 * uGlow;
  // The haze.
  float hh = 0.23 * h * (0.06 + 0.06 * uLvl);
  vec3 col = freqColor(0.5, 0.2) * (0.55 * exp(-0.5 * (dy / hh) * (dy / hh)) * min(1.0, 0.22 + 0.5 * uLvl) * k);
  // The glow's halo.
  float gh = 0.28 * h * (0.008 + 0.055 * glow);
  col += freqColor(b, 0.25) * (1.1 * exp(-0.5 * (dy / gh) * (dy / gh)) * min(1.0, 0.16 + 0.7 * glow) * fade * k);
  // The flat horizon.
  vec3 lineCol = freqColor(b, min(1.0, glow));
  float lineA = fade * min(1.0, 0.45 + 0.6 * glow);
  col += lineCol * (lineA * 0.3 * lineLight(abs(dy) / uDpr));
  // The trace: the nearest segment among the columns within reach of this pixel.
  float reach = 12.0 * uDpr;
  if (dy > -0.4 * uTraceA - reach && dy < 1.1 * uTraceA + reach) {
    float perPx = (uCols - 1.0) / uRes.x;
    float first = floor((p.x - reach) * perPx);
    float last = (p.x + reach) * perPx;
    float best = 1e9;
    float age = 1e9;
    for (int n = 0; n < 48; n++) {
      float c = first + float(n);
      if (c > last) break;
      if (c < 0.0 || c > uCols - 2.0) continue;
      vec2 s0 = texelFetch(uTrace, ivec2(int(c), 0), 0).rg;
      vec2 s1 = texelFetch(uTrace, ivec2(int(c) + 1, 0), 0).rg;
      // Not written yet, or written on different passes (the scan turned between them): not joined.
      if (s0.g < -1e8 || s1.g < -1e8 || abs(s0.g - s1.g) > 0.25) continue;
      vec2 pa = vec2(c / perPx, uCentre.y + s0.r * uTraceA);
      vec2 pb = vec2((c + 1.0) / perPx, uCentre.y + s1.r * uTraceA);
      vec2 ab = pb - pa;
      float t = clamp(dot(p - pa, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
      float d = length(p - (pa + ab * t));
      if (d < best) {
        best = d;
        age = uNow - max(s0.g, s1.g);
      }
    }
    if (best < reach) col += lineCol * (lineA * exp(-age) * lineLight(best / uDpr));
  }
  // Light the screen can't show isn't blended (fewer writes).
  if (max(col.r, max(col.g, col.b)) < 1.0 / 1024.0) discard;
  outColor = vec4(ditherOut(col), 1.0);
}
\`;const j=1024,M=[[0,0],[.012,-.1],[.028,1],[.046,-.3],[.066,0]],N=-1e9;function P(e){if(e<0||e>.3)return 0;if(e>=.12)return .26*Math.sin((e-.12)/.18*Math.PI);for(let t=0;t<M.length-1;t++){let[n,r]=M[t],[i,a]=M[t+1];if(e>=n&&e<i)return r+(a-r)*(e-n)/(i-n)}return 0}function F(){return{trace:new Float32Array(j),wrote:new Float32Array(j).fill(N),head:0,dir:1,now:0,live:0,lo:j,hi:-1,beats:[],quiet:0,wait:0}}function I(e,t){e.beats.push({t:e.now,a:t}),e.quiet=0}function L(e,t){let n=0;for(let r of e.beats)n+=r.a*P(t-r.t);return n}function R(e,t,n){e.trace[t]=L(e,n),e.wrote[t]=n,t<e.lo&&(e.lo=t),t>e.hi&&(e.hi=t)}function z(e,t,n,r,i){let a=t*1023,o=n*1023;if(o>a)for(let t=Math.floor(a)+1;t<=Math.floor(o);t++)R(e,t,r+(t-a)/(o-a)*(i-r));else if(o<a)for(let t=Math.ceil(a)-1;t>=Math.ceil(o);t--)R(e,t,r+(a-t)/(a-o)*(i-r))}function B(e,t){e.quiet+=t,e.quiet>=1.6?(e.wait-=t,e.wait<=0&&(e.beats.push({t:e.now,a:.32}),e.wait=1.1)):e.wait=0,e.lo=j,e.hi=-1;let n=t/2,r=e.head,i=e.now,a=n;for(;a>1e-12;){let o=e.dir>0?1-r:r,s=Math.min(a,o),c=s>=o,l=c?+(e.dir>0):r+e.dir*s,u=i+s/n*t;z(e,r,l,i,u),r=l,i=u,a-=s,c&&(e.dir=e.dir>0?-1:1)}e.head=r,e.now+=t,e.live=L(e,e.now);let o=0;for(let t of e.beats)e.now-t.t<=.35&&(e.beats[o++]=t);e.beats.length=o}const V=Math.PI*2;function H(e){let t=e%2147483647;return t<=0&&(t+=2147483646),()=>(t=t*16807%2147483647)/2147483647}function U(e,t,n){return()=>e>0&&(t===0||n()<2/3)?Math.floor(n()*e):e+Math.floor(n()*Math.max(1,t))}function W(e,t){e.angle=t()*V,e.r=.55+t()*.9}function G(e,t,n){return Array.from({length:120},(r,i)=>{let a={angle:0,r:1,z:e()*8,band:e(),e:0,len:5,flare:0,glyphs:n.subarray(i*24,(i+1)*24)};W(a,e);for(let e=0;e<24;e++)a.glyphs[e]=t();return a})}function K(e,t,n,r,i,a,o){return e.e=t,e.len+=(5+18*t-e.len)*(1-Math.exp(-n/.3)),e.z-=(.5+3.5*t)*r*n,e.flare*=Math.exp(-n/.2),a()<i*n&&(e.glyphs[Math.floor(a()*24)]=o()),e.z+e.len*.32>=.3?!1:(W(e,a),e.z=8+a(),e.flare=0,!0)}function q(e){return Array.from({length:220},()=>{let t={angle:0,r:1,z:e()*12,band:0};return J(t,e),t})}function J(e,t){e.angle=t()*V,e.r=.3+Math.sqrt(t())*2.4,e.band=t()}function ee(e){return .05+.45*Math.max(0,e-.9)}function te(e,t,n,r,i){e.z-=(1+1.5*t)*n*r,e.z+ee(n)>=.3||(J(e,i),e.z=12+i())}function Y(){return{speed:.99,surge:0}}function ne(e){e.surge=1}function re(e,t,n){e.surge*=Math.exp(-n/.35);let r=.6+1.3*t+2*e.surge;e.speed+=(r-e.speed)*(1-Math.exp(-n/(r>e.speed?.1:.35)))}function ie(e){return .85+.15*e}function ae(e,n,r){let i=Math.max(0,Math.min(1,n))*63,a=Math.floor(i),o=Math.min(63,a+1),s=i-a,c=n=>.5*(e[t.bandsL+n]+e[t.bandsR+n]);return Math.min(1,(c(a)*(1-s)+c(o)*s)*r)}var X=\`// src/scene/scenes/coderain/speck.frag: a warp speck's streak: soft across its
// width, brightest at its near end and fading to nothing at its far end (the
// mock-ups' gradient line), its near end rounded. Drawn additively, dithered
// (CODE RAIN EQ draws straight onto the canvas).

in vec2 vPix;
flat in vec2 vPa;
flat in vec2 vPb;
flat in float vWidth;
flat in vec3 vColor;
flat in float vAlpha;
out vec4 outColor;

void main() {
  vec2 ab = vPb - vPa;
  float t = clamp(dot(vPix - vPa, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  float d = length(vPix - (vPa + ab * t)) / (0.5 * vWidth);
  vec3 col = vColor * vAlpha * exp(-0.5 * d * d) * (1.0 - t);
  // Light the screen can't show isn't blended (fewer writes).
  if (max(col.r, max(col.g, col.b)) < 1.0 / 1024.0) discard;
  outColor = vec4(ditherOut(col), 1.0);
}
\`,Z=\`// src/scene/scenes/coderain/speck.vert: one warp speck, a thin streak of light
// behind the code (C5 WARP, as light only).
//
// Each instance is a speck (angle, r, z, band; rain.ts). It reaches from its
// near end (its depth, or 0.45 once it nears the camera) uStretch units back:
// a dot at cruise, a long streak in a surge. Its band's loudness brightens
// it; the far and near fades hide it at the ends. The quad covers the
// projected streak and its width; speck.frag lights it brightest at the near
// end, fading to nothing at the far end. A streak runs straight out from the
// vanishing point, so if its far end is off the screen, all of it is.

layout(location = 0) in vec4 aSpeck;  // angle, r, z, band

uniform float uStretch;    // how far back a speck reaches (units of depth: rain.ts speckStretch)
uniform float uSpeckDeep;  // how deep the specks reach

out vec2 vPix;
flat out vec2 vPa;
flat out vec2 vPb;
flat out float vWidth;  // its width (device px)
flat out vec3 vColor;
flat out float vAlpha;

void main() {
  vec2 q = vec2[4](vec2(0.0, -1.0), vec2(1.0, -1.0), vec2(0.0, 1.0), vec2(1.0, 1.0))[gl_VertexID];
  float za = max(aSpeck.z, 0.45);
  float zb = min(uSpeckDeep, aSpeck.z + uStretch);
  float e = band(aSpeck.w);
  float a = 0.42 * fogOf(0.5 * (za + zb), uSpeckDeep) * (0.4 + 0.6 * e);
  vec2 pa = project(aSpeck.x, aSpeck.y, za);
  vec2 pb = project(aSpeck.x, aSpeck.y, zb);
  if (zb <= za || a < 0.004 || pb.x < 0.0 || pb.x > uRes.x || pb.y < 0.0 || pb.y > uRes.y) {
    gl_Position = HIDDEN;
    return;
  }
  // Its width: about a sixteenth of a glyph's size at its near end, 0.7..2.5 CSS px.
  float width = clamp(0.006 * uFocal / za / uDpr, 0.7, 2.5) * uDpr;
  float reach = 1.5 * width + uDpr;
  vec2 d = pb - pa;
  float len = length(d);
  vec2 dir = len > 1e-3 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  vec2 p = mix(pa - dir * reach, pb + dir * reach, q.x) + n * (q.y * reach);
  vPix = p;
  vPa = pa;
  vPb = pb;
  vWidth = width;
  vColor = freqColor(aSpeck.w, 0.15);
  vAlpha = a;
  gl_Position = clipOf(p);
}
\`,oe=\`// src/scene/scenes/coderain/view.glsl: CODE RAIN EQ's camera, put in front of
// its vertex shaders (after signal.glsl; engine.ts).
//
// The camera looks down a tunnel of code from its vanishing point, which sits
// on the horizon (the middle of the view): a point at angle a, distance r from
// the axis and depth z ahead lands at uCentre + (cos a, sin a) · r / z ·
// uFocal (device px). Things fade in over the tunnel's far third and out just
// before they reach the camera (fogOf), so nothing pops in or out.

uniform vec2 uCentre;  // the vanishing point (device px)
uniform float uFocal;  // device px per unit at depth 1 (ZOOM included)

// The nearest depth drawn (rain.ts NEAR): closer, a thing has passed the camera.
const float NEAR = 0.3;

// How visible a point at depth z is in a tunnel \\\`deep\\\` units deep.
float fogOf(float z, float deep) {
  return clamp((deep - z) / (deep * 0.35), 0.0, 1.0) * clamp((z - NEAR) / 0.6, 0.0, 1.0);
}

// Where a point at \\\`angle\\\`, \\\`r\\\` from the axis, depth z ahead lands (device px).
vec2 project(float angle, float r, float z) {
  return uCentre + vec2(cos(angle), sin(angle)) * (r / z * uFocal);
}

// Device px to clip space.
vec4 clipOf(vec2 px) {
  return vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);
}

// Off screen: a vertex placed where nothing is drawn (a hidden instance).
const vec4 HIDDEN = vec4(2.0, 2.0, 2.0, 1.0);
\`;const se=1.25,ce=.031,le={id:\`coderain\`,direct:!0,create(e){let r=m(e,\`\${oe}\\n\${w}\`,C),i=m(e,\`\${oe}\\n\${Z}\`,X),a=p(e,A),o=p(e,S),s=/* @__PURE__ */ new Float32Array(960),c=/* @__PURE__ */ new Uint8Array(2880),l=/* @__PURE__ */ new Float32Array(880),u={streams:e.createBuffer(),glyphs:e.createBuffer(),specks:e.createBuffer()};for(let[t,n]of[[u.streams,s],[u.glyphs,c],[u.specks,l]])e.bindBuffer(e.ARRAY_BUFFER,t),e.bufferData(e.ARRAY_BUFFER,n.byteLength,e.DYNAMIC_DRAW);let d=e.createVertexArray();e.bindVertexArray(d),e.bindBuffer(e.ARRAY_BUFFER,u.streams);for(let[t,n]of[[0,0],[1,4]])e.enableVertexAttribArray(t),e.vertexAttribPointer(t,4,e.FLOAT,!1,32,n*4),e.vertexAttribDivisor(t,24);e.bindBuffer(e.ARRAY_BUFFER,u.glyphs),e.enableVertexAttribArray(2),e.vertexAttribIPointer(2,1,e.UNSIGNED_BYTE,1,0),e.vertexAttribDivisor(2,1);let f=e.createVertexArray();e.bindVertexArray(f),e.bindBuffer(e.ARRAY_BUFFER,u.specks),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,4,e.FLOAT,!1,16,0),e.vertexAttribDivisor(0,1),e.bindVertexArray(null);let h=D(),_=e.createTexture();e.activeTexture(e.TEXTURE0+2),e.bindTexture(e.TEXTURE_2D,_),e.pixelStorei(e.UNPACK_ALIGNMENT,1),e.texImage2D(e.TEXTURE_2D,0,e.RG8,h.w,h.h,0,e.RG,e.UNSIGNED_BYTE,h.data),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR_MIPMAP_LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.generateMipmap(e.TEXTURE_2D);let v=new Float32Array(j*2);for(let e=0;e<j;e++)v[e*2+1]=N;let y=e.createTexture();e.activeTexture(e.TEXTURE0+3),e.bindTexture(e.TEXTURE_2D,y),e.texImage2D(e.TEXTURE_2D,0,e.RG32F,j,1,0,e.RG,e.FLOAT,v),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.bindTexture(e.TEXTURE_2D,null),e.activeTexture(e.TEXTURE0+2),e.bindTexture(e.TEXTURE_2D,null),e.activeTexture(e.TEXTURE0);let b=H(19),x=U(h.kana,h.count-h.kana,b),T=G(b,x,c),E=q(b),O=Y(),k=F(),M=.3,P=-1,L=/* @__PURE__ */ new Map,R=(t,n)=>{let r=L.get(t);return r||L.set(t,r=/* @__PURE__ */ new Map),r.has(n)||r.set(n,e.getUniformLocation(t,n)),r.get(n)},z=(t,n,r,i)=>{e.activeTexture(e.TEXTURE0+r),e.bindTexture(e.TEXTURE_2D,i),e.uniform1i(R(t,n),r)};return{draw(p){let m=p.signal,S=p.dt,C=p.sensitivity,w=e=>m[t.scalars+n[e]],D=Math.min(1,w(\`level\`)*C),A=w(\`beatCount\`);if(P>=0&&A>P){ne(O),I(k,.65+.7*(Math.max(.5,w(\`beat\`))-.5));for(let e of T)e.band<.3&&(e.flare=1)}P=A,re(O,D,S);let N=ie(O.speed),F=.5+5*Math.min(1,w(\`treble\`)*C);for(let e of T)K(e,ae(m,e.band,C),S,N,F,b,x);for(let e of E)te(e,ae(m,e.band,C),O.speed,S,b);B(k,S),M+=(D-M)*(1-Math.exp(-S/.25)),T.forEach((e,t)=>{let n=t*8;s[n]=e.angle,s[n+1]=e.r,s[n+2]=e.z,s[n+3]=e.band,s[n+4]=e.len,s[n+5]=e.e,s[n+6]=e.flare}),E.forEach((e,t)=>{let n=t*4;l[n]=e.angle,l[n+1]=e.r,l[n+2]=e.z,l[n+3]=e.band});for(let[t,n]of[[u.streams,s],[u.glyphs,c],[u.specks,l]])e.bindBuffer(e.ARRAY_BUFFER,t),e.bufferSubData(e.ARRAY_BUFFER,0,n);if(k.hi>=k.lo){for(let e=k.lo;e<=k.hi;e++)v[e*2]=k.trace[e],v[e*2+1]=k.wrote[e];e.activeTexture(e.TEXTURE0+3),e.bindTexture(e.TEXTURE_2D,y),e.texSubImage2D(e.TEXTURE_2D,0,k.lo,0,k.hi-k.lo+1,1,e.RG,e.FLOAT,v,k.lo*2)}let{w:L,h:V}=p,H=.42*Math.min(L,1.6*V)*p.zoom,U=L/2,W=V/2,G=.12*V,q=Math.abs(k.live),J=k.head*L,Y=.03*L,X=k.head*2-1,Z=W+G*k.trace[Math.round(k.head*1023)];e.clearColor(0,0,0,1),e.clear(e.COLOR_BUFFER_BIT),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE),p.bind(i),e.uniform2f(R(i,\`uCentre\`),U,W),e.uniform1f(R(i,\`uFocal\`),H),e.uniform1f(R(i,\`uStretch\`),ee(O.speed)),e.uniform1f(R(i,\`uSpeckDeep\`),12),e.bindVertexArray(f),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,220),e.bindVertexArray(null),e.enable(e.SCISSOR_TEST);let oe=Math.max(0,Math.floor(W-.1*V)),le=Math.min(V,Math.ceil(W+.17*V));e.scissor(0,oe,L,le-oe),p.bind(a),z(a,\`uTrace\`,3,y),e.uniform1f(R(a,\`uCols\`),j),e.uniform1f(R(a,\`uNow\`),k.now),e.uniform1f(R(a,\`uTraceA\`),G),e.uniform2f(R(a,\`uCentre\`),U,W),e.uniform1f(R(a,\`uLvl\`),M),e.uniform1f(R(a,\`uAt\`),X),e.uniform1f(R(a,\`uLive\`),q),g(e);let ue=Math.max(Y,ce*V),de=Math.max(0,Math.floor(J-ue));e.scissor(de,0,Math.max(1,Math.min(L,Math.ceil(J+ue))-de),V),p.bind(o),e.uniform2f(R(o,\`uCentre\`),U,W),e.uniform3f(R(o,\`uBeam\`),J,Y,.25+.6*q),e.uniform1f(R(o,\`uBand\`),Math.min(1,Math.abs(X))**1.4),e.uniform3f(R(o,\`uSpark\`),J,Z,ce*V),g(e),e.disable(e.SCISSOR_TEST),p.bind(r),z(r,\`uSheetTex\`,2,_),e.uniform2f(R(r,\`uCentre\`),U,W),e.uniform1f(R(r,\`uFocal\`),H),e.uniform1f(R(r,\`uTrail\`),24),e.uniform1f(R(r,\`uGap\`),.32),e.uniform1f(R(r,\`uDeep\`),8),e.uniform1f(R(r,\`uGlyphPx\`),se*.1*H),e.uniform1f(R(r,\`uMaxPx\`),se*72*p.dpr),e.uniform2f(R(r,\`uSheet\`),h.cols,h.rows),e.uniform3f(R(r,\`uBeam\`),J,Y,.6+.9*q),e.bindVertexArray(d),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,2880),e.bindVertexArray(null),e.disable(e.BLEND);for(let t of[2,3])e.activeTexture(e.TEXTURE0+t),e.bindTexture(e.TEXTURE_2D,null);e.activeTexture(e.TEXTURE0)},destroy(){for(let t of[r,i,a,o])e.deleteProgram(t);for(let t of Object.values(u))e.deleteBuffer(t);for(let t of[d,f])e.deleteVertexArray(t);for(let t of[_,y])e.deleteTexture(t)}}}};var ue=\`// src/scene/scenes/plexus/camera.glsl: PLEXUS's camera, put in front of its
// vertex shaders (after signal.glsl; engine.ts).
//
// The camera follows the main pulse forward through a box of nodes that
// wraps round in depth (field.ts): a node's depth ahead of it is its z less
// the camera's, wrapped into 0..uDepth, and the camera sits a little behind
// the pulse and eases sideways after it (uCamXY), so the pulse stays in
// focus at the centre. No sway: the net holds still (the user: the last
// build was "too chaotic / busy"). Projection is a plain pinhole: px =
// centre + xy / depth × uScale.

uniform float uCamZ;   // the camera's depth in the box, 0..uDepth (the engine wraps it)
uniform float uDepth;  // the box's depth (field.ts DEPTH)
uniform float uScale;  // device px per world unit at depth 1 (ZOOM included)
uniform vec2 uCamXY;   // the camera's sideways position (following the pulse)

// A world point in camera space: x and y relative to the camera, z = depth ahead (never 0).
vec3 toCamera(vec3 p) {
  float z = mod(p.z - uCamZ, uDepth) + 0.05;
  return vec3(p.xy - uCamXY, z);
}

// Camera space to device px.
vec2 project(vec3 c) {
  return 0.5 * uRes + c.xy / c.z * uScale;
}

// How visible at depth z: faded in from the far dark, and out before the
// camera passes it, so nothing pops in or out. The far fade is long and
// curved (0.4.0's first build faded only the last 2.5 units, and the far
// field, crowded into the centre by perspective, added up to a white knot).
// The near fade is gone by depth 0.35 and full by 1.1 (0.4.1): with the net
// filling the screen, what passes right by the camera is drawn huge (long,
// wide quads, big halos) for faint, out-of-focus light, and was most of
// each frame's pixels. The pulse is 1.7 ahead, in full view.
float fogOf(float z) {
  float far = clamp((uDepth - z) / 5.0, 0.0, 1.0);
  float near = clamp((z - 0.35) / 0.75, 0.0, 1.0);
  return far * far * near * near;
}

// Device px to clip space.
vec4 clipOf(vec2 px) {
  return vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);
}

// Off screen: a vertex placed where nothing is drawn (a hidden instance).
const vec4 HIDDEN = vec4(2.0, 2.0, 2.0, 1.0);
\`,de=\`// src/scene/scenes/plexus/compose.frag: the frame onto the scene's target:
// this frame's light (uFresh), with the trail history (uTrail, trail.frag)
// behind it, shown at TRAIL_SHOW of its strength. The brighter wins, never
// added: added, trails washed the picture out at high frame rates (0.4.0's
// first build). Shown dimmed, a trail is a soft afterglow behind the net,
// never as bright as what left it.

uniform sampler2D uFresh;
uniform sampler2D uTrail;

in vec2 vUv;
out vec4 outColor;

const float TRAIL_SHOW = 0.4;

void main() {
  // Dithered: onto the canvas when PLEXUS draws direct (stage.ts).
  outColor = vec4(ditherOut(max(texture(uFresh, vUv).rgb, texture(uTrail, vUv).rgb * TRAIL_SHOW)), 1.0);
}
\`;const fe=2.6,pe=1.1;function me(e){let t=e%2147483647;return t<=0&&(t+=2147483646),()=>(t=t*16807%2147483647)/2147483647}function he(e,t){let n=Math.abs(e-t)%8;return Math.min(n,8-n)}function ge(e,t){return((t-e)%8+12)%8-4}function _e(e,t,n){let r=e.pos;return Math.hypot(r[t*3]-r[n*3],r[t*3+1]-r[n*3+1],he(r[t*3+2],r[n*3+2]))}function ve(e,t=31){let n=Math.min(2.4,Math.max(.5,e/(16/9))),r=4.6*n,i=Math.round(1100*n),a=me(t),o=new Float32Array(i*3),s=new Float32Array(i),c=new Float32Array(i);for(let e=0;e<i;e++){let t=(a()*2-1)*r,n=(a()*2-1)*fe;o[e*3]=t,o[e*3+1]=n,o[e*3+2]=a()*8,s[e]=a();let i=Math.min(1,Math.hypot(t/r,n/fe)/Math.SQRT2),l=Math.min(1,.25*i+.75*a());c[e]=Math.hypot(t,n)<.7?l*.3:l}let l=[],u=/* @__PURE__ */ new Set,d={count:i,pos:o,band:s,rank:c,pairs:/* @__PURE__ */ new Uint16Array,adj:[],halfWidth:r},f=Math.max(1,Math.ceil(2*r/pe)),p=e=>[Math.min(f-1,Math.floor((o[e*3]+r)/pe)),Math.min(4,Math.floor((o[e*3+1]+fe)/pe)),Math.min(6,Math.floor(o[e*3+2]/8*7))],m=/* @__PURE__ */ new Map,h=(e,t,n)=>(n*5+t)*f+e;for(let e=0;e<i;e++){let[t,n,r]=p(e),i=h(t,n,r),a=m.get(i);a?a.push(e):m.set(i,[e])}for(let e=0;e<i;e++){let t=[],[n,r,a]=p(e),o=/* @__PURE__ */ new Set([(a-1+7)%7,a,(a+1)%7]);for(let i=Math.max(0,n-1);i<=Math.min(f-1,n+1);i++)for(let n=Math.max(0,r-1);n<=Math.min(4,r+1);n++)for(let r of o)for(let a of m.get(h(i,n,r))??[]){if(a===e)continue;let n=_e(d,e,a);n<1.1&&t.push([a,n])}t.sort((e,t)=>e[1]-t[1]);for(let[n]of t.slice(0,5)){let t=Math.min(e,n)*i+Math.max(e,n);u.has(t)||(u.add(t),l.push(Math.min(e,n),Math.max(e,n)))}}d.pairs=Uint16Array.from(l),d.adj=Array.from({length:i},()=>[]);for(let e=0;e<d.pairs.length;e+=2)d.adj[d.pairs[e]].push([d.pairs[e+1],e/2]),d.adj[d.pairs[e+1]].push([d.pairs[e],e/2]);return d}function ye(e){return Math.min(1.06,.4+1.1*Math.max(0,e))}function be(e,t,n){let r=(n-e.rank[t])/.06;return r<=0?0:r>=1?1:r}function xe(e,t,n,r){let i=e.pos,a=i[t*3+2],o=-1,s=1/0;for(let[c]of e.adj[t]){if(n(c)<.5)continue;let e=ge(a,i[c*3+2]);if(e<.08)continue;let t=2*Math.hypot(i[c*3],i[c*3+1])-.6*e+.25*r();t<s&&(s=t,o=c)}if(o>=0)return o;for(let r=0;r<e.count;r++){if(r===t||n(r)<.5)continue;let e=ge(a,i[r*3+2]);if(e<.08||e>4)continue;let c=Math.hypot(i[r*3],i[r*3+1])+e;c<s&&(s=c,o=r)}return o>=0?o:t}function Se(e,t,n){for(let[r,i]of e.adj[t])if(r===n)return i;return-1}function Ce(e,t,n,r,i,a,o,s){let c=e.adj[n].filter(([e])=>e!==a&&o(e)>=.5);for(let e=0;e<r&&c.length&&t.length<40;e++){let[e,r]=c.splice(Math.floor(s()*c.length),1)[0];t.push({from:n,to:e,t:0,hops:i,pair:r})}}function we(e,t,n,r,i,a,o){for(let s=t.length-1;s>=0;s--){let c=t[s];if(c.t+=n*r,c.pair>=0&&o(c.pair),c.t<1)continue;let l=e.adj[c.to].filter(([e])=>e!==c.from&&i(e)>=.5);if(c.hops>1&&l.length){let[e,n]=l[Math.floor(a()*l.length)];t[s]={from:c.to,to:e,t:c.t-1,hops:c.hops-1,pair:n}}else t.splice(s,1)}}function Te(e,t,n,r,i,a,o){r<=0||(e.speed+=(n/r-e.speed)*(1-Math.exp(-r/a)),e.depth+=e.speed*r,e.depth+=(t-i-e.depth)*(1-Math.exp(-r/o)))}var Ee=\`// src/scene/scenes/plexus/link.frag: a link's smooth glowing line.
//
// The pixel's distance to the segment (so both ends are round), in CSS px,
// shaped as cyberdeck's glowing lines are (draw.glsl glowLine): a bell-shaped
// core and a Gaussian glow, its width from link.vert (slim for a quiet link,
// GLOW's for a marked or loud one). Drawn additively: crossing links add
// their light, as light does.

in vec2 vPix;
flat in vec2 vPa;
flat in vec2 vPb;
flat in float vCore;
flat in float vGlowSigma;
flat in vec3 vColor;
flat in float vAlpha;
out vec4 outColor;

void main() {
  vec2 ab = vPb - vPa;
  float t = clamp(dot(vPix - vPa, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  float d = length(vPix - (vPa + ab * t)) / uDpr;
  float c = d / max(vCore * 0.5, 0.35);
  float g = d / vGlowSigma;
  float core = exp(-0.5 * c * c);
  float glow = exp(-0.5 * g * g) * (0.12 + 0.35 * uGlow);
  vec3 col = vColor * vAlpha * (core + glow);
  // Light the screen can't show isn't blended (fewer writes).
  if (max(col.r, max(col.g, col.b)) < 1.0 / 1024.0) discard;
  // Dithered here: PLEXUS draws straight onto the canvas (stage.ts direct).
  outColor = vec4(ditherOut(col), 1.0);
}
\`,De=\`// src/scene/scenes/plexus/link.vert: one link as a screen-space quad.
//
// Each instance is a visible link (engine.ts culls the rest on the CPU):
// its two nodes' x, y, z and band, how present it is (the lesser of its
// ends' presence: the net grows and shrinks with the music) and its mark (a
// pulse ran along it lately: it glows, fading). Its four vertices
// (gl_VertexID, a triangle strip) make a quad around the projected segment, wide
// enough for the glow and capped at both ends (link.frag rounds them). Its
// loudness (its bands' mean) brightens and thickens it; a mark makes it
// brighter, thicker and whiter, so the pulses' paths stand out (the main
// pulse's most). A link across the depth wrap is hidden: both ends are
// fogged out there anyway.

layout(location = 0) in vec4 aA;       // node A: x, y, z, band
layout(location = 1) in vec4 aB;       // node B
layout(location = 2) in vec2 aState;   // presence, mark

out vec2 vPix;
flat out vec2 vPa;
flat out vec2 vPb;
flat out float vCore;
flat out float vGlowSigma;
flat out vec3 vColor;
flat out float vAlpha;

// The widest a link's core gets (CSS px), however near.
const float MAX_CORE = 6.0;

void main() {
  vec2 q = vec2[4](vec2(0.0, -1.0), vec2(1.0, -1.0), vec2(0.0, 1.0), vec2(1.0, 1.0))[gl_VertexID];
  vec3 ca = toCamera(aA.xyz);
  vec3 cb = toCamera(aB.xyz);
  float fog = min(fogOf(ca.z), fogOf(cb.z));
  float e = 0.5 * (band(aA.w) + band(aB.w));
  float present = aState.x;
  float mark = aState.y;
  // The net is the stage, quiet and gently reacting; the marks (the pulses' paths) are the show.
  vAlpha = ((0.08 + 0.38 * pow(e, 1.3) + 0.3 * uAccent * fog) * present + 1.4 * mark) * fog;
  if (abs(ca.z - cb.z) > 0.5 * uDepth || vAlpha < 0.003) {
    gl_Position = HIDDEN;
    return;
  }
  vec2 pa = project(ca);
  vec2 pb = project(cb);
  // The core's width in CSS px: nearer is wider (perspective); louder and marked are wider.
  float core = min(MAX_CORE, ((0.4 + 0.7 * e) * present + 2.2 * mark) * 0.5 * (1.0 / ca.z + 1.0 / cb.z));
  // How far the quad reaches (device px): as far as the line's light is visible (above
  // 1/512), no further. A quiet link's glow fades out within about 2.5 of its widths,
  // a marked one's within about 3.4: most of the net's quads are far smaller than a
  // fixed 3 widths, and overdraw is the cost (0.4.1: "the smoothest it can be").
  // The glow's width follows importance (0.4.1, measured: the links were most of the frame's cost,
  // nearly all of it faint halo on quiet links): a quiet link's glow is slim, a marked or loud
  // one's as wide as GLOW makes it. The quiet stage reads crisper too.
  float wide = clamp(max(mark, 0.6 * e), 0.0, 1.0);
  float glowSigma = core * (1.5 + 1.5 * wide) + (1.5 + 4.5 * wide) * uGlow;
  float coreSigma = max(core * 0.5, 0.35);
  float glowPeak = vAlpha * (0.12 + 0.35 * uGlow);
  float reachCss = max(glowSigma * sqrt(2.0 * log(max(glowPeak * 512.0, 1.0001))), coreSigma * sqrt(2.0 * log(max(vAlpha * 512.0, 1.0001))));
  float reach = (reachCss + 1.0) * uDpr;
  vec2 d = pb - pa;
  float len = length(d);
  vec2 dir = len > 1e-3 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  vec2 p = mix(pa - dir * reach, pb + dir * reach, q.x) + n * q.y * reach;
  vPix = p;
  vPa = pa;
  vPb = pb;
  vCore = core;
  vGlowSigma = glowSigma;
  vColor = mix(freqColor(0.5 * (aA.w + aB.w), e), uColBright, 0.6 * min(1.0, mark));
  gl_Position = clipOf(p);
}
\`,Oe=\`// src/scene/scenes/plexus/node.frag: a node's glow: a near-white core, a
// body in its colour and a soft halo (stronger with GLOW), all smooth
// Gaussians, so a disc has no edge at any size. Drawn additively.

in vec2 vUv;
flat in vec3 vColor;
flat in float vAlpha;
out vec4 outColor;

void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float core = exp(-r2 / 0.012);
  float body = exp(-r2 / 0.06);
  // The halo reaches the quad's edge at nothing.
  float halo = exp(-r2 / 0.25) * (1.0 - sqrt(r2));
  vec3 col = (mix(vColor, vec3(1.0), 0.5) * core + vColor * (0.9 * body + (0.2 + 0.3 * uGlow) * halo)) * vAlpha;
  // Light the screen can't show isn't blended (fewer writes).
  if (max(col.r, max(col.g, col.b)) < 1.0 / 1024.0) discard;
  // Dithered here: PLEXUS draws straight onto the canvas (stage.ts direct).
  outColor = vec4(ditherOut(col), 1.0);
}
\`,ke=\`// src/scene/scenes/plexus/node.vert: a node, a branch pulse or the main
// pulse, as a glowing disc.
//
// Each instance is a point (x, y, z, band), its swell (0..1: a pulse
// reached it lately; branches are drawn at 1) and its presence (the net
// grows and shrinks with the music: a node fades in and out). The main
// pulse comes with band -1: it's drawn larger, in the palette's bright
// colour, always fully present: the one thing always in focus.

layout(location = 0) in vec4 aNode;  // x, y, z, band (-1: the main pulse)
layout(location = 1) in vec2 aState; // swell, presence

out vec2 vUv;
flat out vec3 vColor;
flat out float vAlpha;

// The largest a disc gets (CSS px), however near.
const float MAX_SIZE = 120.0;

void main() {
  // Four corners, a triangle strip.
  vec2 q = vec2[4](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0))[gl_VertexID];
  vec3 c = toCamera(aNode.xyz);
  float fog = fogOf(c.z);
  bool isMain = aNode.w < 0.0;
  float e = isMain ? uLevel : band(aNode.w);
  float swell = aState.x;
  float present = aState.y;
  vAlpha = isMain ? 1.0 : (0.22 + 0.45 * e + 0.6 * swell) * fog * present;
  if (vAlpha < 0.003 || c.z < 0.35) {
    gl_Position = HIDDEN;
    return;
  }
  // The main pulse: big, breathing with the level and flaring on the beat.
  float css = isMain ? 26.0 + 30.0 * uLevel + 26.0 * uBeat : 4.0 + 12.0 * e + 22.0 * swell;
  // A faint node's halo is invisible at the quad's rim: a smaller quad for it (fewer pixels; same look).
  float size = min(MAX_SIZE, css / c.z * (0.8 + 0.4 * uGlow)) * uDpr * mix(0.6, 1.0, clamp(vAlpha * 2.0, 0.0, 1.0));
  vUv = q;
  vColor = isMain ? uColBright : freqColor(aNode.w, e);
  gl_Position = clipOf(project(c) + q * 0.5 * size);
}
\`,Ae=\`// src/scene/scenes/plexus/trail.frag: PLEXUS's trail history (TRAILS as
// warp streaks), kept in a buffer of the scene's own.
//
// Each frame: the history so far (uTrailPrev), pushed outward from the
// centre (as things fly past a camera moving forward: more when the music
// is loud) and faded, against this frame's light (uFresh): the brighter
// wins. The history is kept at full strength, so a streak keeps its length
// and shape; compose.frag shows it dimmed (0.4.0: "The trails are still too
// intense when activated": shown at full strength, a streak began as
// bright as what left it).
//
// How long a streak lasts follows TRAILS: a third of its light is left
// after 0.05 s (lowest) to 0.6 s (highest), per second, not per frame.

uniform sampler2D uFresh;
uniform sampler2D uTrailPrev;

in vec2 vUv;
out vec4 outColor;

void main() {
  float keep = uTrails < 0.001 ? 0.0 : exp(-uDt / mix(0.05, 0.6, uTrails));
  float push = exp(-uDt * (0.3 + 1.6 * uLevel));
  vec3 trail = texture(uTrailPrev, 0.5 + (vUv - 0.5) * push).rgb * keep;
  outColor = vec4(max(texture(uFresh, vUv).rgb, trail), 1.0);
}
\`;const je=1.7,Me=.25,Ne={id:\`plexus\`,direct:!0,create(e){let r=m(e,\`\${ue}\\n\${De}\`,Ee),i=m(e,\`\${ue}\\n\${ke}\`,Oe),a=p(e,Ae),o=p(e,de),s=v(e),c={links:e.createBuffer(),points:e.createBuffer()},l=e.createVertexArray(),u=e.createVertexArray(),d=(t,n,r,i,a)=>{e.bindBuffer(e.ARRAY_BUFFER,t),e.enableVertexAttribArray(n),e.vertexAttribPointer(n,r,e.FLOAT,!1,i*4,a*4),e.vertexAttribDivisor(n,1)};e.bindVertexArray(l),d(c.links,0,4,10,0),d(c.links,1,4,10,4),d(c.links,2,2,10,8),e.bindVertexArray(u),d(c.points,0,4,6,0),d(c.points,1,2,6,4),e.bindVertexArray(null);let f=null,h=0,_=/* @__PURE__ */ new Float32Array,x=/* @__PURE__ */ new Float32Array,S=/* @__PURE__ */ new Float32Array,C=/* @__PURE__ */ new Float32Array,w=/* @__PURE__ */ new Float32Array,T=/* @__PURE__ */ new Float32Array,E=[],D=me(7),O=e=>_[e]??0,k={from:0,to:0,t:1,hops:0,pair:-1},A=1,j=0,M=-1,N=[0,0],P=0,F=0,I={depth:-1.7,speed:0},L=null,R=[],z=0,B=/* @__PURE__ */ new Map,V=(t,n)=>{let r=B.get(t);return r||B.set(t,r=/* @__PURE__ */ new Map),r.has(n)||r.set(n,e.getUniformLocation(t,n)),r.get(n)},H=t=>{h=t;let n=f=ve(t),r=n.pairs.length/2;_=Float32Array.from({length:n.count},(e,t)=>be(n,t,ye(0))),x=new Float32Array(n.count),S=new Float32Array(r),C=new Float32Array(r*10),w=new Float32Array((n.count+40+1)*6),E.length=0,T=new Float32Array(r);for(let e=0;e<r;e++){let t=n.pos[n.pairs[e*2]*3+2];T[e]=t+ge(t,n.pos[n.pairs[e*2+1]*3+2])}for(let[t,n]of[[c.links,C],[c.points,w]])e.bindBuffer(e.ARRAY_BUFFER,t),e.bufferData(e.ARRAY_BUFFER,n.byteLength,e.DYNAMIC_DRAW);let i=0;for(let e=0;e<n.count;e++)_[e]>.5&&Math.hypot(n.pos[e*3],n.pos[e*3+1])<Math.hypot(n.pos[i*3],n.pos[i*3+1])&&(i=e);k={from:i,to:i,t:1,hops:0,pair:-1},A=1,N=[n.pos[i*3],n.pos[i*3+1]],F=n.pos[i*3+2],P=F,I.depth=P-je,I.speed=0},U=e=>{let t=f.pos,n=Math.min(1,e.t),r=t[e.from*3+2];return[t[e.from*3]+(t[e.to*3]-t[e.from*3])*n,t[e.from*3+1]+(t[e.to*3+1]-t[e.from*3+1])*n,r+ge(r,t[e.to*3+2])*n]},W=e=>{let t=f;for(k.t+=e*(.45+1.9*j)/A,k.pair>=0&&(S[k.pair]=Math.max(S[k.pair],1));k.t>=1;){let e=k.to;x[e]=Math.max(x[e],.9);let n=xe(t,e,O,D);if(k={from:e,to:n,t:k.t-1,hops:0,pair:Se(t,e,n)},A=Math.max(.05,_e(t,e,n)),n===e){k.t=0;break}}},G=e=>{let t=2+Math.round(3*(e-.5)*2),n=2+Math.floor(D()*4);Ce(f,E,k.from,t,n,k.to,O,D)},K=(t,n,r)=>{let{pairs:i,pos:a,band:o,count:s}=f,[l,u]=N,d=e=>((e-t)%8+8)%8,p=(e,t,i)=>i>.35&&i<7.6&&Math.abs(e-l)<(n+Me)*i&&Math.abs(t-u)<(r+Me)*i,m=0;for(let e=0;e<S.length;e++){let t=i[e*2],n=i[e*2+1],r=Math.min(_[t],_[n]);if(r<.01&&S[e]<.01)continue;let s=a[t*3+2],c=T[e],l=d(s),u=l+(c-s);if(!p(a[t*3],a[t*3+1],l)&&!p(a[n*3],a[n*3+1],u))continue;let f=m++*10;C[f]=a[t*3],C[f+1]=a[t*3+1],C[f+2]=s,C[f+3]=o[t],C[f+4]=a[n*3],C[f+5]=a[n*3+1],C[f+6]=c,C[f+7]=o[n],C[f+8]=r,C[f+9]=S[e]}let h=0,g=(e,t,n,r,i,a)=>{let o=h++*6;w[o]=e,w[o+1]=t,w[o+2]=n,w[o+3]=r,w[o+4]=i,w[o+5]=a};for(let e=0;e<s;e++)_[e]<.01||!p(a[e*3],a[e*3+1],d(a[e*3+2]))||g(a[e*3],a[e*3+1],a[e*3+2],o[e],x[e],_[e]);for(let e of E){let[t,n,r]=U(e);g(t,n,r,o[e.from],1,1)}let[v,y,b]=U(k);g(v,y,b,-1,1,1);for(let[t,n]of[[c.links,C.subarray(0,m*10)],[c.points,w.subarray(0,h*6)]])e.bindBuffer(e.ARRAY_BUFFER,t),e.bufferSubData(e.ARRAY_BUFFER,0,n);return[m,h]},q=e=>Math.min(1,e.signal[t.scalars+n.level]*e.sensitivity),J=(t,n,r,i)=>{e.activeTexture(e.TEXTURE0+r),e.bindTexture(e.TEXTURE_2D,i),e.uniform1i(V(t,n),r)};return{draw(c){let d=c.w/Math.max(1,c.h);(!f||Math.abs(d-h)/h>.01)&&H(d);let p=f,m=e.getParameter(e.FRAMEBUFFER_BINDING),v=c.signal,C=c.dt;j+=(q(c)-j)*(1-Math.exp(-C/1.2));let w=ye(j),T=1-Math.exp(-C/.5),A=1-Math.exp(-C/1.4);for(let e=0;e<p.count;e++){let t=be(p,e,w),n=_[e];_[e]=n+(t-n)*(t>n?T:A)}_[k.from]=1,_[k.to]=1,W(C);let B=v[t.scalars+n.beatCount];M>=0&&B>M&&G(Math.max(.5,v[t.scalars+n.beat])),M=B;let ee=Math.exp(-C/3.5);for(let e=0;e<S.length;e++)S[e]*=ee;we(p,E,C,3.2,O,D,e=>S[e]=Math.max(S[e],.55));let te=Math.exp(-C/.35);for(let e=0;e<x.length;e++)x[e]*=te;let[Y,ne,re]=U(k),ie=1-Math.exp(-C/.6);N=[N[0]+(Y-N[0])*ie,N[1]+(ne-N[1])*ie];let ae=ge(F,re);F=re,P+=ae,Te(I,P,ae,C,je,.5,1.5);let X=(I.depth%8+8)%8,Z=c.h*.39*c.zoom,[oe,se]=K(X,.5*c.w/Z,.5*c.h/Z),ce=c.trails>.001;if(ce&&(!L||L.w!==c.w||L.h!==c.h)){L&&b(e,L);for(let t of R)b(e,t);L=y(e,c.w,c.h,s),R=[y(e,c.w,c.h,s),y(e,c.w,c.h,s)]}e.bindFramebuffer(e.FRAMEBUFFER,ce?L.framebuffer:m),e.viewport(0,0,c.w,c.h),e.clearColor(0,0,0,1),e.clear(e.COLOR_BUFFER_BIT),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE);for(let[t,n,a]of[[r,l,oe],[i,u,se]])c.bind(t),e.uniform1f(V(t,\`uCamZ\`),X),e.uniform2f(V(t,\`uCamXY\`),N[0],N[1]),e.uniform1f(V(t,\`uDepth\`),8),e.uniform1f(V(t,\`uScale\`),Z),e.bindVertexArray(n),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,a);if(e.bindVertexArray(null),e.disable(e.BLEND),!ce||!L)return;let le=R[z],ue=R[1-z];z=1-z,e.bindFramebuffer(e.FRAMEBUFFER,le.framebuffer),c.bind(a),J(a,\`uFresh\`,2,L.texture),J(a,\`uTrailPrev\`,3,ue.texture),g(e),e.bindFramebuffer(e.FRAMEBUFFER,m),c.bind(o),J(o,\`uFresh\`,2,L.texture),J(o,\`uTrail\`,3,le.texture),g(e);for(let t of[2,3])e.activeTexture(e.TEXTURE0+t),e.bindTexture(e.TEXTURE_2D,null);e.activeTexture(e.TEXTURE0)},destroy(){for(let t of[r,i,a,o])e.deleteProgram(t);for(let t of Object.values(c))e.deleteBuffer(t);for(let t of[l,u])e.deleteVertexArray(t);L&&b(e,L);for(let t of R)b(e,t)}}}};var Pe=\`// src/scene/scenes/test/test.frag: TEST, every part of SIGNAL drawn plainly.
//
// Layer: scene shader (signal.glsl is put in front). Laid out on the screen,
// top to bottom:
//   - the waveform, a thin scope line near the top;
//   - the left channel's spectrum, a glowing line rising above the middle,
//     bass at the left; the right channel's mirrored below it;
//   - a ring in the middle that swells with the beat;
//   - the history as a waterfall along the bottom (newest at its top);
//   - the beat accent as a faint flash of the bright colour (limited, R18);
//   - trails: the last frame, drifting outward and fading (TRAILS). The
//     flash goes in before the trail is mixed (max, never added), so flashes
//     fade with the trail instead of stacking frame on frame.
// Colours come from frequency (freqColor) and the palette, nothing else.

in vec2 vUv;
out vec4 outColor;

void main() {
  vec2 q = sceneCoord(gl_FragCoord.xy);
  // Half the screen, in the same zoomed CSS px.
  vec2 half_ = 0.5 * uRes / uDpr / uZoom;
  // Band position across the middle 90% of the width (0 = bass at the left).
  float x = q.x / (half_.x * 0.9) * 0.5 + 0.5;
  // The bands end at both ends of their span, softened over a few px (no bend past the end).
  float inside = smoothstep(-0.006, 0.0, x) * smoothstep(1.006, 1.0, x);
  float xc = clamp(x, 0.0, 1.0);
  vec2 lr = bandLR(xc);
  vec3 col = vec3(0.0);

  // The spectrum: left above the middle, right mirrored below.
  float base = 0.1 * half_.y;
  float lift = 0.42 * half_.y;
  float fL = q.y - (base + lr.x * lift);
  float fR = q.y + (base + lr.y * lift);
  col += freqColor(xc, lr.x) * glowLine(fL, 1.6) * inside * (0.55 + 0.45 * lr.x);
  col += freqColor(xc, lr.y) * glowLine(fR, 1.6) * inside * (0.55 + 0.45 * lr.y);
  // A faint fill under each line, so loud bands read as mass, not just an edge.
  float underL = step(base, q.y) * step(q.y, base + lr.x * lift);
  float underR = step(q.y, -base) * step(-(base + lr.y * lift), q.y);
  col += freqColor(xc, 0.0) * (underL * lr.x + underR * lr.y) * 0.07 * inside;

  // The waveform, near the top.
  float wy = 0.78 * half_.y;
  float fw = q.y - (wy + wave(xc) * 0.11 * half_.y);
  col += mix(uColDim, uColText, uLevel) * glowLine(fw, 1.0) * inside * 0.8;

  // The beat ring in the middle.
  float r = 14.0 + 46.0 * uBeat + 20.0 * sens(uGroups.x);
  col += mix(uColAccent, uColBright, uBeat) * glowLine(length(q) - r, 1.2) * (0.25 + 0.75 * uBeat);

  // The waterfall: the bottom 40% of the screen, newest at its top, fading with age.
  float top = -0.6 * half_.y;
  if (q.y < top) {
    float age = (top - q.y) / (half_.y - 0.6 * half_.y);
    float v = past(xc, age);
    col += freqColor(xc, v) * v * v * (1.0 - age) * 0.6 * inside;
  }

  // The beat accent: a faint flash of the bright colour.
  col += accentFlash(0.1);

  // Trails: the last frame, drifting out from the centre (0.35 of the way a second) and fading.
  vec2 drift = (vUv - 0.5) * exp(-0.35 * uDt) + 0.5;
  vec3 prev = texture(uPrev, drift).rgb * trailKeep();
  col = max(col, prev);
  outColor = vec4(col, 1.0);
}
\`;const Fe=[Ne,le,{id:\`test\`,create(e){let t=p(e,Pe);return{draw(e){e.bind(t),g(e.gl)},destroy(){e.deleteProgram(t)}}}}];function Ie(e){return Fe.find(t=>t.id===e)??Fe[0]}var Le=\`#version 300 es
// src/scene/shaders/composite.frag: the scene's target onto the canvas.
// During a crossfade (stage.ts) uA is the new scene and uB the old, mixed by
// uMix; otherwise both are the same. Dithered last (±half an 8-bit step), so
// the faint fades scenes draw in half-float never band on the canvas.
precision highp float;
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uMix;
in vec2 vUv;
out vec4 outColor;

// Interleaved gradient noise: an even, fine pattern with no visible structure.
float noise(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec3 c = mix(texture(uB, vUv).rgb, texture(uA, vUv).rgb, uMix);
  c += (noise(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
\`;const Re={low:.25,medium:.5,high:.75,max:1};function ze(r,a,s,c,l,u){let d=r.getContext(\`webgl2\`,{antialias:!1,alpha:!1,depth:!1,stencil:!1,premultipliedAlpha:!1,preserveDrawingBuffer:!1,powerPreference:\`high-performance\`});if(!d)throw Error(\`WebGL 2 is not available\`);let f=i(),p={w:1,h:1,dpr:1},m,S,C,w=!1,T=null,E=null,D={id:s,look:c,trails:l},O=!1,k=!1,A=0,j=0,M=!1,N=-1/0,P=[],F=/* @__PURE__ */ new WeakMap,I=(e,t)=>{let n=F.get(e);return n||F.set(e,n=/* @__PURE__ */ new Map),n.has(t)||n.set(t,d.getUniformLocation(e,t)),n.get(t)},L=(e,t,n)=>({id:e,engine:Ie(e).create(d),direct:!!Ie(e).direct,look:t,trails:n,targets:Array.from({length:n?2:1},()=>y(d,p.w,p.h,w)),turn:0}),R=e=>{e.engine.destroy();for(let t of e.targets)b(d,t)},z=()=>{w=v(d),m=_(d),S=x(d),C=h(d,Le),T=L(D.id,D.look,D.trails),E=null},B=(r,i,a)=>s=>{d.useProgram(s);let c=f,l=e=>c[t.scalars+n[e]];d.activeTexture(d.TEXTURE0),d.bindTexture(d.TEXTURE_2D,m.texture),d.uniform1i(I(s,\`uSignal\`),0),d.activeTexture(d.TEXTURE1),d.bindTexture(d.TEXTURE_2D,i),d.uniform1i(I(s,\`uPrev\`),1),d.uniform1f(I(s,\`uHead\`),m.head),d.uniform4f(I(s,\`uGroups\`),l(\`bass\`),l(\`lowMid\`),l(\`highMid\`),l(\`treble\`)),d.uniform1f(I(s,\`uLevel\`),l(\`level\`)),d.uniform1f(I(s,\`uBeat\`),l(\`beat\`)),d.uniform1f(I(s,\`uBeatCount\`),l(\`beatCount\`)),d.uniform1f(I(s,\`uAccent\`),l(\`accent\`)),d.uniform1f(I(s,\`uFlow\`),l(\`flow\`)),d.uniform1f(I(s,\`uBalance\`),l(\`balance\`)),d.uniform1f(I(s,\`uIdle\`),l(\`idle\`)),d.uniform1f(I(s,\`uTime\`),j/1e3),d.uniform1f(I(s,\`uDt\`),a),d.uniform2f(I(s,\`uRes\`),p.w,p.h),d.uniform1f(I(s,\`uDpr\`),p.dpr);let u=r.look;d.uniform1f(I(s,\`uZoom\`),u.zoom),d.uniform1f(I(s,\`uGlow\`),Re[u.glow]??Re[o[2]]),d.uniform1f(I(s,\`uSensitivity\`),u.sensitivity),d.uniform1f(I(s,\`uTrails\`),r.trails?u.trails:0);let h=u.colors;d.uniform3fv(I(s,\`uColBg\`),e(h.bg)),d.uniform3fv(I(s,\`uColLine\`),e(h.line)),d.uniform3fv(I(s,\`uColDim\`),e(h.textDim)),d.uniform3fv(I(s,\`uColText\`),e(h.text)),d.uniform3fv(I(s,\`uColAccent\`),e(h.accent)),d.uniform3fv(I(s,\`uColBright\`),e(h.textBright)),d.uniform3fv(I(s,\`uColCool\`),e(h.cool))},V=(e,t,n,i=!1)=>{let a=e.targets[e.turn],o=e.targets.length>1&&!i?e.targets[1-e.turn].texture:S;d.bindFramebuffer(d.FRAMEBUFFER,i?null:a.framebuffer),d.viewport(0,0,i?r.width:a.w,i?r.height:a.h);let s={gl:d,signal:f,w:i?r.width:a.w,h:i?r.height:a.h,dpr:p.dpr,zoom:e.look.zoom,sensitivity:e.look.sensitivity,trails:e.trails?e.look.trails:0,time:t,dt:n,bind:B(e,o,n)};return e.engine.draw(s),i?null:(d.activeTexture(d.TEXTURE1),d.bindTexture(d.TEXTURE_2D,null),e.targets.length>1&&(e.turn=1-e.turn),a.texture)},H=e=>{A=0,k&&!O&&((performance.now()-N>100||P.length)&&U(e),A=u.requestFrame(H))},U=e=>{if(!k||O||!T)return;let t=performance.now(),n=j?Math.min((e-j)/1e3,.1):1/60;j=e;try{if(m.upload(f,n),!E&&T.direct){V(T,e/1e3,n,!0),P.length&&W(),u.frame(t,performance.now()-t),M||(M=!0,u.ready());return}let i=V(T,e/1e3,n),a=i,o=1;if(E){a=V(E,e/1e3,n),E.since+=n;let t=Math.min(1,E.since/.6);o=t*t*(3-2*t),t>=1&&(R(E),E=null)}d.bindFramebuffer(d.FRAMEBUFFER,null),d.viewport(0,0,r.width,r.height),d.useProgram(C),d.activeTexture(d.TEXTURE0),d.bindTexture(d.TEXTURE_2D,i),d.uniform1i(I(C,\`uA\`),0),d.activeTexture(d.TEXTURE1),d.bindTexture(d.TEXTURE_2D,a),d.uniform1i(I(C,\`uB\`),1),d.uniform1f(I(C,\`uMix\`),o),g(d),P.length&&W()}catch(e){u.error(e instanceof Error?e.message:String(e)),k=!1;return}u.frame(t,performance.now()-t),M||(M=!0,u.ready())},W=()=>{let e=r.width,t=r.height,n=new Uint8Array(e*t*4);d.readPixels(0,0,e,t,d.RGBA,d.UNSIGNED_BYTE,n);let i=0,a=0,o=0,s=Math.max(1,Math.floor(e*t/2e4)),c=0;for(let r=0;r<e*t;r+=s){let e=Math.max(n[r*4],n[r*4+1],n[r*4+2]);e>12&&i++,a+=e,o=Math.imul(o,31)+(e>>4)|0,c++}let l={lit:i/c,mean:a/c,sig:o,w:e,h:t};for(let e of P.splice(0))e(l)},G=e=>{if(p={w:Math.max(1,Math.round(e.w*e.dpr)),h:Math.max(1,Math.round(e.h*e.dpr)),dpr:e.dpr},r.width=p.w,r.height=p.h,!O){for(let e of[T,E])if(e){for(let t of e.targets)b(d,t);e.targets=e.targets.map(()=>y(d,p.w,p.h,w))}}},K=()=>{k&&!O&&!A&&(A=u.requestFrame(H))};r.addEventListener(\`webglcontextlost\`,e=>{e.preventDefault(),O=!0,A&&u.cancelFrame(A),A=0}),r.addEventListener(\`webglcontextrestored\`,()=>{O=!1;try{z(),G({w:p.w/p.dpr,h:p.h/p.dpr,dpr:p.dpr}),K()}catch(e){u.error(e instanceof Error?e.message:String(e))}}),G(a),z();let q=d.getExtension(\`WEBGL_lose_context\`);return{get running(){return k&&!O},resize(e){G(e)},setSignal(e){f=e,N=performance.now(),U(N)},setScene(e,t,n){D={id:e,look:t,trails:n},O||(T?.id===e&&T.trails===n?T.look=t:(E&&R(E),E=T?{...T,since:0}:null,T=L(e,t,n)))},setLook(e){D={...D,look:e},T&&(T.look=e)},start(){k=!0,j=0,K()},stop(){k=!1,A&&u.cancelFrame(A),A=0},pixels(){return new Promise(e=>{P.push(e),K()})},lose(){q&&(q.loseContext(),setTimeout(()=>q.restoreContext(),300))},destroy(){k=!1,A&&u.cancelFrame(A),T&&R(T),E&&R(E),m.destroy()}}}const Q=self,Be=/* @__PURE__ */ new Float64Array(512),Ve=/* @__PURE__ */ new Float64Array(512);let He=0,Ue=0,$=null,We={w:0,h:0};function Ge(e){let t=performance.now()-e,n=[],r=[],i=NaN;for(let e=Ue;e>0;e--){let a=(He-e+512)%512;Be[a]<t||(Number.isNaN(i)||n.push(Be[a]-i),i=Be[a],r.push(Ve[a]))}return{gaps:n,durations:r,w:We.w,h:We.h,running:$?.running??!1}}Q.onmessage=({data:e})=>{switch(e.type){case\`init\`:try{$=ze(e.canvas,e.size,e.scene,e.look,e.trails,{ready:()=>Q.postMessage({type:\`ready\`}),error:e=>Q.postMessage({type:\`error\`,message:e}),frame:(t,n)=>{Be[He]=t,Ve[He]=n,He=(He+1)%512,Ue=Math.min(512,Ue+1),We={w:e.canvas.width,h:e.canvas.height}},requestFrame:e=>Q.requestAnimationFrame(e),cancelFrame:e=>Q.cancelAnimationFrame(e)})}catch(e){Q.postMessage({type:\`error\`,message:e instanceof Error?e.message:String(e)})}break;case\`resize\`:$?.resize(e.size);break;case\`signal\`:$?.setSignal(e.signal),Q.postMessage({type:\`drawn\`});break;case\`scene\`:$?.setScene(e.scene,e.look,e.trails);break;case\`look\`:$?.setLook(e.look);break;case\`start\`:$?.start();break;case\`stop\`:$?.stop();break;case\`probe\`:e.what===\`stats\`?Q.postMessage({type:\`probe\`,id:e.id,result:Ge(e.ms)}):$&&$.pixels().then(t=>Q.postMessage({type:\`probe\`,id:e.id,result:t}));break;case\`lose\`:$?.lose();break;case\`destroy\`:$?.destroy(),Q.close()}};`,Ce=typeof self<`u`&&self.Blob&&new Blob([`URL.revokeObjectURL(import.meta.url);`,Se],{type:`text/javascript;charset=utf-8`});function we(e){let t;try{if(t=Ce&&(self.URL||self.webkitURL).createObjectURL(Ce),!t)throw``;let n=new Worker(t,{type:`module`,name:e?.name});return n.addEventListener(`error`,()=>{(self.URL||self.webkitURL).revokeObjectURL(t)}),n}catch{return new Worker(`data:text/javascript;charset=utf-8,`+encodeURIComponent(Se),{type:`module`,name:e?.name})}}var Te=150,Ee=`cymatic_bridge:sharp`,De=`cymatic_bridge:sharp-budget`,z=null,B=``,V=null,Oe=null,H=!1,U=null,ke=()=>{},Ae=new Map,je=0;function Me(e){try{return localStorage.getItem(e)}catch{return null}}var W=(()=>{try{return xe(JSON.parse(Me(Ee)??`{}`))}catch{return{}}})();function G(e,t=[]){z?.postMessage(e,t)}function Ne(e){return new Promise(t=>{Ae.set(++je,t),G(e(je))})}function Pe(){let e=window.devicePixelRatio||1;return{w:window.innerWidth,h:window.innerHeight,dpr:_e(e,2,W[B])}}function Fe(e){return{colors:A(e.palette).colors,glow:e.glow,sensitivity:e.sensitivity,trails:e.trails,zoom:e.zoom}}function K(){let e=Pe();V&&e.w===V.w&&e.h===V.h&&e.dpr===V.dpr||(V=e,G({type:`resize`,size:e}))}var Ie;function Le(){clearTimeout(Ie);let e=B;if(!ve(window.devicePixelRatio||1,2)||W[e]===`safe`)return;let t=Number(Me(De)??NaN);Ie=setTimeout(()=>{He(ge).then(n=>{if(B!==e||!n)return;let r=be(n.durations,Number.isFinite(t)?t:8);if(r){W={...W,[e]:r};try{localStorage.setItem(Ee,JSON.stringify(W))}catch{}r===`safe`&&K()}})},R+ge)}function Re(e,t,n){ke=n;let r=document.getElementById(`scene-canvas`);if(!r||z)return;if(typeof Worker>`u`||!(`transferControlToOffscreen`in HTMLCanvasElement.prototype)){ze(`THIS BROWSER CAN’T DRAW IN A WORKER · USE A CURRENT CHROME`);return}B=I(e).id,z=new we({name:`scene`}),z.onmessage=({data:e})=>{if(e.type===`drawn`){if(H=!1,U){let e=U;U=null,H=!0,G({type:`signal`,signal:e})}}else e.type===`ready`?(r.dataset.ready=``,Le()):e.type===`error`?ze(`THE SCENE COULDN’T DRAW · ${e.message.slice(0,120)}`):(Ae.get(e.id)?.(e.result),Ae.delete(e.id))},z.onerror=e=>{e.preventDefault(),ze(`THE SCENE STOPPED`)},V=Pe();let i=r.transferControlToOffscreen();G({type:`init`,canvas:i,size:V,scene:B,look:Fe(t),trails:I(B).trails},[i]),document.hidden||G({type:`start`})}function ze(e){Oe||(Oe=e,console.error(e),ke(e))}function Be(e,t){let n=I(e);n.id===B?G({type:`look`,look:Fe(t)}):(B=n.id,G({type:`scene`,scene:n.id,look:Fe(t),trails:n.trails}),K(),Le())}function Ve(e){z&&(H?(U||=new Float32Array(e.length),U.set(e)):(H=!0,G({type:`signal`,signal:e})))}function He(e){return z?Ne(t=>({type:`probe`,id:t,what:`stats`,ms:e})):Promise.resolve(null)}window.__cymaticStage={pixels:()=>z?Ne(e=>({type:`probe`,id:e,what:`pixels`})):Promise.resolve(null),stats:e=>He(e),lose:()=>G({type:`lose`}),scene:()=>B,size:()=>V};var Ue;window.addEventListener(`resize`,()=>{clearTimeout(Ue),Ue=setTimeout(K,Te)}),document.addEventListener(`fullscreenchange`,()=>{clearTimeout(Ue),requestAnimationFrame(K)}),document.addEventListener(`visibilitychange`,()=>G({type:document.hidden?`stop`:`start`}));var We=e=>{let t,n=new Set,r=(e,r)=>{let i=typeof e==`function`?e(t):e;if(!Object.is(i,t)){let e=t;t=r??(typeof i!=`object`||!i)?i:Object.assign({},t,i),n.forEach(n=>n(t,e))}},i=()=>t,a={setState:r,getState:i,getInitialState:()=>o,subscribe:e=>(n.add(e),()=>n.delete(e))},o=t=e(r,i,a);return a},Ge=(e=>e?We(e):We),Ke=6e3,qe,q=Ge()(e=>({capture:`off`,title:null,bridge:null,immersive:!1,meter:!1,notice:null,panel:null,setPanel:t=>e({panel:t}),setCapture:t=>e({capture:t}),setLabel:(t,n)=>e({title:t,bridge:n}),setImmersive:t=>e({immersive:t}),toggleMeter:()=>e(e=>({meter:!e.meter})),showNotice:t=>{clearTimeout(qe),e({notice:t}),qe=setTimeout(()=>e({notice:null}),Ke)}})),J=2048;function Je(){let e=new AudioContext({latencyHint:`interactive`});e.resume();let t=e.createAnalyser(),n=e.createAnalyser();for(let e of[t,n])e.fftSize=J,e.smoothingTimeConstant=0;let r=e.createAnalyser();r.fftSize=512,r.smoothingTimeConstant=0;let i=e.createGain();i.gain.value=0,t.connect(i),n.connect(i),r.connect(i),i.connect(e.destination);let a={binsL:new Float32Array(t.frequencyBinCount),binsR:new Float32Array(n.frequencyBinCount),waveL:new Float32Array(J),waveR:new Float32Array(J),binsFast:new Float32Array(r.frequencyBinCount)},o=null,s=null;return{binCount:t.frequencyBinCount,fastBinCount:r.frequencyBinCount,sampleRate:e.sampleRate,read(){return t.getFloatFrequencyData(a.binsL),n.getFloatFrequencyData(a.binsR),t.getFloatTimeDomainData(a.waveL),n.getFloatTimeDomainData(a.waveR),r.getFloatFrequencyData(a.binsFast),a},connect:i=>{o?.disconnect(),s?.disconnect(),o=e.createMediaStreamSource(i),s=e.createChannelSplitter(2),o.connect(s),o.connect(r),s.connect(t,0);let a=i.getAudioTracks()[0]?.getSettings().channelCount===1;s.connect(n,+!a),e.state!==`running`&&e.resume()},suspend:()=>e.suspend(),resume:()=>e.resume(),close(){o?.disconnect(),e.close()}}}var Ye={video:{frameRate:1,width:{max:320},height:{max:180}},audio:{echoCancellation:!1,noiseSuppression:!1,autoGainControl:!1,suppressLocalAudioPlayback:!1},displaySurface:`browser`,monitorTypeSurfaces:`exclude`,selfBrowserSurface:`exclude`,surfaceSwitching:`include`,systemAudio:`exclude`,preferCurrentTab:!1};async function Xe(){if(!navigator.mediaDevices?.getDisplayMedia)return{ok:!1,why:`unsupported`};let e;try{e=await navigator.mediaDevices.getDisplayMedia(Ye)}catch(e){return e instanceof DOMException&&e.name===`NotAllowedError`?{ok:!1,why:`cancelled`}:{ok:!1,why:`failed`,message:e instanceof Error?e.message:String(e)}}return e.getAudioTracks().length?{ok:!0,stream:e}:(Ze(e),{ok:!1,why:`no-audio`})}function Ze(e){for(let t of e.getTracks())t.stop()}var Qe=`NO SOUND SHARED · IN CHROME’S PICKER, TURN ON “ALSO SHARE TAB AUDIO”`,$e=`THIS BROWSER CAN’T SHARE A TAB’S SOUND · USE A CURRENT CHROME`,Y=null,X=null,Z=O(J/2,48e3,void 0,256),et=null,Q=0,$=0;function tt(e){Q=requestAnimationFrame(tt);let t=$?(e-$)/1e3:1/60;$=e;let n=performance.now(),r=Y&&X?Y.read():null,i=Z.step(r,t,e/1e3);o(i,`cost`,performance.now()-n),Ve(i)}function nt(){Q||document.hidden||($=0,Q=requestAnimationFrame(tt))}function rt(){cancelAnimationFrame(Q),Q=0}function it(){return Y||(Y=Je(),Y.sampleRate!==48e3&&(Z=O(Y.binCount,Y.sampleRate,void 0,Y.fastBinCount),et&&Z.setProfile(et)),Y)}function at(e){return e.getCaptureHandle?.()?.handle??null}function ot(t){let r=e(at(t)),i=q.getState();r?i.setLabel(r.title||null,n(r.v,`1.0.0`)?`old`:`ok`):i.setLabel(null,`none`)}function st(e){X&&Ze(X),X=e,it().connect(e);for(let t of e.getTracks())t.addEventListener(`ended`,()=>X===e&&lt());let t=e.getVideoTracks()[0];t?(ot(t),t.addEventListener(`capturehandlechange`,()=>X===e&&ot(t))):q.getState().setLabel(null,`none`),q.getState().setCapture(`live`)}async function ct(){let e=q.getState(),t=e.capture;it(),e.setCapture(`asking`);let n=await Xe();n.ok?st(n.stream):(e.setCapture(t===`live`&&X?`live`:`off`),n.why===`no-audio`?e.showNotice(Qe):n.why===`unsupported`?e.showNotice($e):n.why===`failed`&&e.showNotice(`COULDN’T SHARE THE TAB · ${(n.message??``).toUpperCase().slice(0,80)}`))}function lt(){X&&Ze(X),X=null,q.getState().setCapture(`off`),q.getState().setLabel(null,null)}function ut(e){et=e,Z.setProfile(e)}function dt(){return Z.signal}function ft(){nt()}document.addEventListener(`visibilitychange`,()=>{document.hidden?(rt(),Y?.suspend()):(Y?.resume(),nt())}),window.__cymaticSignal={latest:()=>Array.from(Z.signal),running:()=>Q!==0};function pt(){return{v:1,scene:P[0].id,hudHidden:!1,bridgeOffer:!0,scenes:{}}}function mt(e,t){return e.reduce((e,n)=>Math.abs(n-t)<Math.abs(e-t)?n:e,e[0])}function ht(e,t){let n=I(e).defaults,r=t&&typeof t==`object`?t:{},i=e=>typeof e==`number`&&Number.isFinite(e)?e:null;return{palette:typeof r.palette==`string`?A(r.palette).id:n.palette,glow:M.find(e=>e===r.glow)??n.glow,sensitivity:i(r.sensitivity)===null?n.sensitivity:mt(he,i(r.sensitivity)),trails:i(r.trails)===null?n.trails:Math.min(1,Math.max(0,i(r.trails))),zoom:i(r.zoom)===null?n.zoom:mt(N,i(r.zoom))}}function gt(e){let t=pt(),n=e&&typeof e==`object`?e:{},r={};if(n.scenes&&typeof n.scenes==`object`&&!Array.isArray(n.scenes))for(let[e,t]of Object.entries(n.scenes))e&&e.length<=64&&(r[e]=ht(e,t));return{v:1,scene:typeof n.scene==`string`&&n.scene.length<=64?n.scene:t.scene,hudHidden:typeof n.hudHidden==`boolean`?n.hudHidden:t.hudHidden,bridgeOffer:typeof n.bridgeOffer==`boolean`?n.bridgeOffer:t.bridgeOffer,scenes:r}}function _t(e,t){return e.scenes[t]??I(t).defaults}var vt=`cymatic_bridge:scene`;function yt(){try{let e=JSON.parse(localStorage.getItem(vt)??`null`),t=I(typeof e?.id==`string`?e.id:F).id;return{id:t,settings:ht(t,e?.settings)}}catch{return{id:F,settings:I(F).defaults}}}function bt(e,t){try{localStorage.setItem(vt,JSON.stringify({id:e,settings:t}))}catch{}}var xt=null;function St(e){let t=A(e);if(t.id===xt)return!1;xt=t.id;let n=document.documentElement;for(let[e,r]of Object.entries(j))n.style.setProperty(r,t.colors[e]);return n.dataset.palette=t.id,!0}export{L as C,s as D,i as E,I as S,r as T,Re as _,ht as a,he as b,dt as c,ft as d,lt as f,Be as g,He as h,pt as i,ct as l,Ge as m,bt as n,gt as o,q as p,yt as r,_t as s,St as t,ut as u,ye as v,k as w,N as x,M as y};