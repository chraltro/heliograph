(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const o of s)if(o.type==="childList")for(const a of o.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function e(s){const o={};return s.integrity&&(o.integrity=s.integrity),s.referrerPolicy&&(o.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?o.credentials="include":s.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function n(s){if(s.ep)return;s.ep=!0;const o=e(s);fetch(s.href,o)}})();class jn{constructor(t){this.world=t;const{timezones:e,timezoneMeta:n}=t,{coords:s,ringStarts:o,polyStarts:a,featureStarts:r}=e;if(r)for(let l=0;l+1<r.length;l++){const c=r[l],h=r[l+1];let u=1/0,d=1/0,m=-1/0,f=-1/0;for(let g=c;g<h;g++){const x=a[g],p=a[g+1];for(let y=x;y<p;y++){const b=o[y],v=o[y+1];for(let E=b;E<v;E++){const A=s[E*2],S=s[E*2+1];A<u&&(u=A),A>m&&(m=A),S<d&&(d=S),S>f&&(f=S)}}}this.boxes.push({minLon:u,minLat:d,maxLon:m,maxLat:f,firstPoly:c,lastPoly:h,area:n[l]?.area??0})}}boxes=[];get count(){return this.boxes.length}at(t,e){const n=[];for(let s=0;s<this.boxes.length;s++){const o=this.boxes[s];t<o.minLon||t>o.maxLon||e<o.minLat||e>o.maxLat||n.push(s)}n.sort((s,o)=>(this.boxes[s].area??0)-(this.boxes[o].area??0));for(const s of n)if(this.contains(s,t,e))return this.hit(s);return null}hit(t){const e=this.world.timezoneMeta[t];return e?{index:t,meta:e,iana:e.iana,standardOffsetMinutes:Math.round(e.offset*60)}:null}contains(t,e,n){const s=this.boxes[t];if(!s)return!1;const{coords:o,ringStarts:a,polyStarts:r}=this.world.timezones;let l=!1;for(let c=s.firstPoly;c<s.lastPoly;c++){const h=r[c],u=r[c+1];for(let d=h;d<u;d++){const m=a[d],f=a[d+1];for(let g=m,x=f-1;g<f;x=g++){const p=o[g*2+1],y=o[x*2+1];if(p>n!=y>n){const b=o[g*2],v=o[x*2];e<(v-b)*(n-p)/(y-p)+b&&(l=!l)}}}}return l}}class Jn{cells=new Map;cellSize=5;constructor(t,e){for(let n=0;n<e&&n<t.length;n++){const s=t[n],o=this.key(s.lon,s.lat),a=this.cells.get(o);a?a.push(s):this.cells.set(o,[s])}}key(t,e){const n=Math.floor((t+180)/this.cellSize);return Math.floor((e+90)/this.cellSize)*1e3+n}nearest(t,e,n=4){const s=Math.ceil(n/this.cellSize);let o=null,a=1/0;for(let r=-s;r<=s;r++)for(let l=-s;l<=s;l++){const c=this.cells.get(this.key(t+l*this.cellSize,e+r*this.cellSize));if(c)for(const h of c){let u=h.lon-t;u>180&&(u-=360),u<-180&&(u+=360);const d=Math.cos(e*Math.PI/180),m=Math.hypot(u*d,h.lat-e);if(m>n)continue;const f=m/(1+Math.log10(Math.max(1,h.population))/4);f<a&&(a=f,o=h)}}return o}}function an(i,t,e){const n=i.createShader(t);if(!n)throw new Error("could not create shader");if(i.shaderSource(n,e),i.compileShader(n),!i.getShaderParameter(n,i.COMPILE_STATUS)){const s=i.getShaderInfoLog(n)??"unknown error",o=e.split(`
`).map((a,r)=>`${String(r+1).padStart(3)} | ${a}`).join(`
`);throw i.deleteShader(n),new Error(`shader failed to compile: ${s}
${o}`)}return n}function ct(i,t,e){const n=i.createProgram();if(!n)throw new Error("could not create program");const s=an(i,i.VERTEX_SHADER,t),o=an(i,i.FRAGMENT_SHADER,e);if(i.attachShader(n,s),i.attachShader(n,o),i.linkProgram(n),i.deleteShader(s),i.deleteShader(o),!i.getProgramParameter(n,i.LINK_STATUS)){const a=i.getProgramInfoLog(n)??"unknown error";throw i.deleteProgram(n),new Error(`program failed to link: ${a}`)}return n}class ht{constructor(t,e){this.gl=t,this.program=e}locations=new Map;at(t){return this.locations.has(t)||this.locations.set(t,this.gl.getUniformLocation(this.program,t)),this.locations.get(t)??null}f1(t,e){const n=this.at(t);n&&this.gl.uniform1f(n,e)}i1(t,e){const n=this.at(t);n&&this.gl.uniform1i(n,e)}f2(t,e,n){const s=this.at(t);s&&this.gl.uniform2f(s,e,n)}f3(t,e,n,s){const o=this.at(t);o&&this.gl.uniform3f(o,e,n,s)}f4(t,e,n,s,o){const a=this.at(t);a&&this.gl.uniform4f(a,e,n,s,o)}fv(t,e){const n=this.at(t);n&&this.gl.uniform1fv(n,e)}f3v(t,e){const n=this.at(t);n&&this.gl.uniform3fv(n,e)}}function Y(i,t,e=i.ARRAY_BUFFER){const n=i.createBuffer();if(!n)throw new Error("could not create buffer");return i.bindBuffer(e,n),i.bufferData(e,t,i.STATIC_DRAW),i.bindBuffer(e,null),n}function gt(i,t,e,n){const s=i.createVertexArray();if(!s)throw new Error("could not create vertex array");i.bindVertexArray(s);for(const[o,a]of Object.entries(e)){const r=i.getAttribLocation(t,o);r<0||(i.bindBuffer(i.ARRAY_BUFFER,a.buffer),i.enableVertexAttribArray(r),i.vertexAttribPointer(r,a.size,a.type??i.FLOAT,a.normalized??!1,a.stride??0,a.offset??0),a.divisor&&i.vertexAttribDivisor(r,a.divisor))}return n&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,n),i.bindVertexArray(null),i.bindBuffer(i.ARRAY_BUFFER,null),s}const Vt=new Set;let Fe=!1;function Qn(i,t,e=2){const n=t&&t.length,s=n?t[0]*e:i.length;Vt.size&&Vt.clear();let o=Fn(i,0,s,e,!0);const a=[];if(!o||o.next===o.prev)return a;let r=0,l=0,c=0;if(n&&(o=os(i,t,o,e)),i.length>80*e){r=i[0],l=i[1];let h=r,u=l;for(let d=e;d<s;d+=e){const m=i[d],f=i[d+1];m<r&&(r=m),f<l&&(l=f),m>h&&(h=m),f>u&&(u=f)}c=Math.max(h-r,u-l),c=c!==0?32767/c:0}return ze(o,a,r,l,c),a}function Fn(i,t,e,n,s){let o=null;if(s===bs(i,t,e,n)>0)for(let a=t;a<e;a+=n)o=cn(a/n|0,i[a],i[a+1],o);else for(let a=e-n;a>=t;a-=n)o=cn(a/n|0,i[a],i[a+1],o);return o&&Yt(o,o.next)&&(Kt(o),o=o.next),o}function Et(i,t=i){const e=t===i;let n=i,s;do s=!1,n!==n.next&&(Vt.size===0||!Vt.has(n))&&(Yt(n,n.next)||k(n.prev,n,n.next)===0)?((e||n===t)&&(t=n.prev),Fe=!0,Kt(n),n=n.prev,s=!0):(e||n!==t)&&(n=n.next,s=!e);while(s||n!==t);return t}function ze(i,t,e,n,s){s&&us(i,e,n,s);let o=i,a=!1;for(;i.prev!==i.next;){const r=i.prev,l=i.next;if(k(r,i,l)<0&&(s?es(i,e,n,s):ts(i))){t.push(r.i,i.i,l.i),Kt(i),i=l,o=l;continue}if(i=l,i===o){if(Fe=!1,i=Et(i),Fe){o=i;continue}if(!a){i=ns(i,t),o=i,a=!0;continue}ss(i,t,e,n,s);break}}}function ts(i){const t=i.prev,e=i,n=i.next,s=t.x,o=e.x,a=n.x,r=t.y,l=e.y,c=n.y,h=Math.min(s,o,a),u=Math.min(r,l,c),d=Math.max(s,o,a),m=Math.max(r,l,c);let f=n.next;for(;f!==t;){if(f.x>=h&&f.x<=d&&f.y>=u&&f.y<=m&&!(s===f.x&&r===f.y)&&me(s,r,o,l,a,c,f.x,f.y)&&k(f.prev,f,f.next)>=0)return!1;f=f.next}return!0}function es(i,t,e,n){const s=i.prev,o=i,a=i.next,r=s.x,l=o.x,c=a.x,h=s.y,u=o.y,d=a.y,m=Math.min(r,l,c),f=Math.min(h,u,d),g=Math.max(r,l,c),x=Math.max(h,u,d),p=Ne(m,f,t,e,n),y=Ne(g,x,t,e,n);let b=i.prevZ;for(;b&&b.z>=p;){if(b.x>=m&&b.x<=g&&b.y>=f&&b.y<=x&&b!==a&&!(r===b.x&&h===b.y)&&me(r,h,l,u,c,d,b.x,b.y)&&k(b.prev,b,b.next)>=0)return!1;b=b.prevZ}let v=i.nextZ;for(;v&&v.z<=y;){if(v.x>=m&&v.x<=g&&v.y>=f&&v.y<=x&&v!==a&&!(r===v.x&&h===v.y)&&me(r,h,l,u,c,d,v.x,v.y)&&k(v.prev,v,v.next)>=0)return!1;v=v.nextZ}return!0}function ns(i,t){let e=i,n=!1;do{const s=e.prev,o=e.next.next;Un(s,e,e.next,o,!1)&&Ht(s,o)&&Ht(o,s)&&(t.push(s.i,e.i,o.i),Kt(e),Kt(e.next),e=i=o,n=!0),e=e.next}while(e!==i);return n?Et(e):e}function ss(i,t,e,n,s){let o=i;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&ms(o,a)){let r=Pn(o,a);o=Et(o,o.next),r=Et(r,r.next),ze(o,t,e,n,s),ze(r,t,e,n,s);return}a=a.next}o=o.next}while(o!==i)}let De=!1;function os(i,t,e,n){const s=[];for(let o=0,a=t.length;o<a;o++){const r=t[o]*n,l=o<a-1?t[o+1]*n:i.length,c=Fn(i,r,l,n,!1);c===c.next&&Vt.add(c),s.push(fs(c))}s.sort(is),rs(i.length/n,t.length),Dn(e,e),De=!0;for(let o=0;o<s.length;o++)e=as(s[o],e);return De=!1,Et(e)}function is(i,t){return i.x-t.x||i.y-t.y||(i.next.y-i.y)/(i.next.x-i.x)-(t.next.y-t.y)/(t.next.x-t.x)}function as(i,t){const e=cs(i,t);if(!e)return t;const n=Pn(e,i),s=n.next;return Dn(e,s.next),Et(n,n.next),Et(e,e.next)}const zn=16;let I=new Float64Array(0),fe=0;const Ue=[],Pe=[];function rs(i,t){const e=Math.ceil((i+2*t)/zn)+t+2;I.length<e*4&&(I=new Float64Array(e*4)),fe=0}function Dn(i,t){let e=i;do{const n=fe++;Ue[n]=e;let s=1/0,o=1/0,a=-1/0,r=-1/0,l=0;do{const h=e.next;e.z=n,e.x<s&&(s=e.x),e.x>a&&(a=e.x),e.y<o&&(o=e.y),e.y>r&&(r=e.y),h.x<s&&(s=h.x),h.x>a&&(a=h.x),h.y<o&&(o=h.y),h.y>r&&(r=h.y),e=h}while(++l<zn&&e!==t);Pe[n]=e;const c=n*4;I[c]=s,I[c+1]=o,I[c+2]=a,I[c+3]=r}while(e!==t)}function ls(i,t){const e=i.z*4;t.x<I[e]&&(I[e]=t.x),t.y<I[e+1]&&(I[e+1]=t.y),t.x>I[e+2]&&(I[e+2]=t.x),t.y>I[e+3]&&(I[e+3]=t.y)}function rn(i){let t=Pe[i];for(;t.prev.next!==t;)t=t.next;return Pe[i]=t,t}function ln(i){let t=Ue[i];for(;t.prev.next!==t;)t=t.next;return Ue[i]=t,t}function cs(i,t){let e=t;const n=i.x,s=i.y;let o=-1/0,a;if(Yt(i,e))return e;for(let d=0,m=0;d<fe;d++,m+=4){if(s<I[m+1]||s>I[m+3]||I[m]>n||I[m+2]<=o)continue;const f=rn(d);e=ln(d);do{if(e.prev.next===e){if(Yt(i,e.next))return e.next;if(s<=e.y&&s>=e.next.y&&e.next.y!==e.y){const g=e.x+(s-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(g<=n&&g>o&&(o=g,a=e.x<e.next.x?e:e.next,g===n))return a}}e=e.next}while(e!==f)}if(!a)return null;const r=a.x,l=a.y,c=Math.min(s,l),h=Math.max(s,l);let u=1/0;for(let d=0,m=0;d<fe;d++,m+=4){if(I[m+2]<r||I[m]>n||I[m+3]<c||I[m+1]>h)continue;const f=rn(d);e=ln(d);do{if(e.prev.next===e&&n>=e.x&&e.x>=r&&n!==e.x&&me(s<l?n:o,s,r,l,s<l?o:n,s,e.x,e.y)){const g=Math.abs(s-e.y)/(n-e.x);(Ht(e,i)||e.y===s&&e.next.y===s&&e.next.x>n)&&(g<u||g===u&&(e.x>a.x||e.x===a.x&&hs(a,e)))&&(a=e,u=g)}e=e.next}while(e!==f)}return a}function hs(i,t){return k(i.prev,i,t.prev)<0&&k(t.next,i,i.next)<0}const K=[];let Pt=[],bt=new Uint32Array(0),Nt=new Uint32Array(0);const Bt=new Uint32Array(256);function us(i,t,e,n){let s=i,o=0;do s.z=Ne(s.x,s.y,t,e,n),K[o++]=s,s=s.next;while(s!==i);ds(o);let a=null;for(let r=0;r<o;r++){const l=K[r];l.prevZ=a,a&&(a.nextZ=l),a=l}a.nextZ=null}function ds(i){if(i<=32){for(let t=1;t<i;t++){const e=K[t],n=e.z;let s=t-1;for(;s>=0&&K[s].z>n;)K[s+1]=K[s],s--;K[s+1]=e}return}bt.length<i&&(bt=new Uint32Array(i),Nt=new Uint32Array(i),Pt=new Array(i));for(let t=0;t<i;t++)bt[t]=K[t].z;Qt(i,K,bt,Pt,Nt,0),Qt(i,Pt,Nt,K,bt,8),Qt(i,K,bt,Pt,Nt,16),Qt(i,Pt,Nt,K,bt,24)}function Qt(i,t,e,n,s,o){Bt.fill(0);for(let r=0;r<i;r++)Bt[e[r]>>>o&255]++;let a=0;for(let r=0;r<256;r++){const l=Bt[r];Bt[r]=a,a+=l}for(let r=0;r<i;r++){const l=e[r],c=Bt[l>>>o&255]++;n[c]=t[r],s[c]=l}}function Ne(i,t,e,n,s){return i=(i-e)*s|0,t=(t-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,i|t<<1}function fs(i){let t=i,e=i;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==i);return e}function me(i,t,e,n,s,o,a,r){return(s-a)*(t-r)>=(i-a)*(o-r)&&(i-a)*(n-r)>=(e-a)*(t-r)&&(e-a)*(o-r)>=(s-a)*(n-r)}function ms(i,t){const e=Yt(i,t)&&k(i.prev,i,i.next)>0&&k(t.prev,t,t.next)>0;return i.next.i!==t.i&&(e||Ht(i,t)&&Ht(t,i)&&(k(i.prev,i,t.prev)!==0||k(i,t.prev,t)!==0))&&!ps(i,t)&&(e||gs(i,t))}function k(i,t,e){return(t.y-i.y)*(e.x-t.x)-(t.x-i.x)*(e.y-t.y)}function Yt(i,t){return i.x===t.x&&i.y===t.y}function Un(i,t,e,n,s=!0){const o=k(i,t,e),a=k(i,t,n),r=k(e,n,i),l=k(e,n,t);return(o>0&&a<0||o<0&&a>0)&&(r>0&&l<0||r<0&&l>0)?!0:s?!!(o===0&&te(i,e,t)||a===0&&te(i,n,t)||r===0&&te(e,i,n)||l===0&&te(e,t,n)):!1}function te(i,t,e){return t.x<=Math.max(i.x,e.x)&&t.x>=Math.min(i.x,e.x)&&t.y<=Math.max(i.y,e.y)&&t.y>=Math.min(i.y,e.y)}function ps(i,t){const e=Math.min(i.x,t.x),n=Math.max(i.x,t.x),s=Math.min(i.y,t.y),o=Math.max(i.y,t.y);let a=i;do{const r=a.next;if(a.x>n&&r.x>n||a.x<e&&r.x<e||a.y>o&&r.y>o||a.y<s&&r.y<s){a=r;continue}if(a.i!==i.i&&r.i!==i.i&&a.i!==t.i&&r.i!==t.i&&Un(a,r,i,t))return!0;a=r}while(a!==i);return!1}function Ht(i,t){return k(i.prev,i,i.next)<0?k(i,t,i.next)>=0&&k(i,i.prev,t)>=0:k(i,t,i.prev)<0||k(i,i.next,t)<0}function gs(i,t){let e=i,n=!1;const s=(i.x+t.x)/2,o=(i.y+t.y)/2;do{const a=e.next;e.y>o!=a.y>o&&s<(a.x-e.x)*(o-e.y)/(a.y-e.y)+e.x&&(n=!n),e=a}while(e!==i);return n}function Pn(i,t){const e=Be(i.i,i.x,i.y),n=Be(t.i,t.x,t.y),s=i.next,o=t.prev;return i.next=t,t.prev=i,e.next=s,s.prev=e,n.next=e,e.prev=n,o.next=n,n.prev=o,n}function cn(i,t,e,n){const s=Be(i,t,e);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function Kt(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ),De&&ls(i.prev,i.next)}function Be(i,t,e){return{i,x:t,y:e,prev:null,next:null,z:0,prevZ:null,nextZ:null}}function bs(i,t,e,n){let s=0;for(let o=t,a=e-n;o<e;o+=n)s+=(i[a]-i[o])*(i[o+1]+i[a+1]),a=o;return s}function we(i,t=!1){const{coords:e,ringStarts:n,polyStarts:s,featureStarts:o}=i,a=e,r=[],l=t?new Float32Array(e.length/2):null,c=new Uint32Array(Math.max(0,s.length-1));if(o&&t)for(let u=0;u+1<o.length;u++)for(let d=o[u];d<o[u+1];d++)c[d]=u;const h=s.length-1;for(let u=0;u<h;u++){const d=s[u],m=s[u+1];if(m<=d)continue;const f=n[d],g=n[m];if(g-f<3)continue;const x=a.subarray(f*2,g*2),p=[];for(let b=d+1;b<m;b++)p.push(n[b]-f);const y=Qn(x,p,2);for(let b=0;b<y.length;b++)r.push(y[b]+f);if(l){const b=c[u]??0;for(let v=f;v<g;v++)l[v]=b}}return{positions:a,indices:new Uint32Array(r),featureIds:l}}function ys(i){const{coords:t,ringStarts:e}=i,n=e.length-1,s=89.5,o=[];for(let a=0;a<n;a++){const r=e[a],l=e[a+1]-r;if(!(l<3))for(let c=0;c<l;c++){const h=(r+c)*2,u=(r+(c+1)%l)*2,d=t[h+1],m=t[u+1];Math.abs(d)>=s&&Math.abs(m)>=s||o.push(t[h],d,t[u],m)}}return new Float32Array(o)}function vs(i){const{coords:t,stripStarts:e}=i,n=e.length-1;let s=0;for(let r=0;r<n;r++){const l=e[r+1]-e[r];l>=2&&(s+=l-1)}const o=new Float32Array(s*4);let a=0;for(let r=0;r<n;r++){const l=e[r],c=e[r+1]-l;if(!(c<2))for(let h=0;h+1<c;h++){const u=(l+h)*2,d=(l+h+1)*2;o[a++]=t[u],o[a++]=t[u+1],o[a++]=t[d],o[a++]=t[d+1]}}return o}const xs=new Float32Array([0,-1,1,-1,0,1,1,1]);function Ye(i,t,e){const n=i+.3963377774*t+.2158037573*e,s=i-.1055613458*t-.0638541728*e,o=i-.0894841775*t-1.291485548*e,a=n*n*n,r=s*s*s,l=o*o*o;return[4.0767416621*a-3.3077115913*r+.2309699292*l,-1.2684380046*a+2.6097574011*r-.3413193965*l,-.0041960863*a-.7034186147*r+1.707614701*l]}function pe(i,t,e){const n=Math.cbrt(.4122214708*i+.5363325363*t+.0514459929*e),s=Math.cbrt(.2119034982*i+.6806995451*t+.1073969566*e),o=Math.cbrt(.0883024619*i+.2817188376*t+.6299787005*e);return[.2104542553*n+.793617785*s-.0040720468*o,1.9779984951*n-2.428592205*s+.4505937099*o,.0259040371*n+.7827717662*s-.808675766*o]}function Ct(i,t,e){const n=e*Math.PI/180;return Ye(i,t*Math.cos(n),t*Math.sin(n))}function Te(i){return i<=.04045?i/12.92:Math.pow((i+.055)/1.055,2.4)}function ws(i){const t=Math.max(0,Math.min(1,i));return t<=.0031308?t*12.92:1.055*Math.pow(t,1/2.4)-.055}function dt(i){const t=parseInt(i.replace("#",""),16);return[Te((t>>16&255)/255),Te((t>>8&255)/255),Te((t&255)/255)]}function Ee(i){const t=e=>Math.round(ws(e)*255).toString(16).padStart(2,"0");return`#${t(i[0])}${t(i[1])}${t(i[2])}`}const J=[90,60,30,18,12,6,2,0,-2,-4,-6,-9,-12,-15,-18,-25],Nn={ocean:["#123b61","#123a5f","#113659","#0f3052","#0f2c4c","#0f2644","#0f213c","#0f1d38","#0d1733","#0b1030","#0a0b2b","#070625","#06041c","#050414","#03040f","#02040e"],land:["#7b764f","#7a734b","#766d42","#736335","#715b28","#6e4d13","#6a3a00","#652f00","#581e06","#461315","#330d22","#180c29","#0b0921","#080717","#050612","#030711"],ice:["#f3f2eb","#efede3","#e7e2d2","#e1d5bf","#ddcab1","#d5b599","#cd9b82","#c58c78","#ac716a","#8c5863","#664663","#3a3355","#23233e","#17172a","#0f1220","#0c121e"]},Ge={min:-25,max:90};function Se(i,t){return-Math.log(Math.max(1e-5,1-Math.min(.9995,i)))/t}function le(i,t){const e=Nn[i];if(t>=J[0])return dt(e[0]);const n=J.length-1;if(t<=J[n])return dt(e[n]);for(let s=0;s+1<J.length;s++){const o=J[s],a=J[s+1];if(t<=o&&t>=a){const r=(o-t)/(o-a),l=r*r*(3-2*r),c=pe(...dt(e[s])),h=pe(...dt(e[s+1]));return Ye(c[0]+(h[0]-c[0])*l,c[1]+(h[1]-c[1])*l,c[2]+(h[2]-c[2])*l)}}return dt(e[n])}function Ts(i,t,e){const n=Nn[i].map(r=>{const[l,c,h]=dt(r);return pe(Se(l,e),Se(c,e),Se(h,e))}),s=new Float32Array(t*4),{min:o,max:a}=Ge;for(let r=0;r<t;r++){const l=o+(r+.5)/t*(a-o);let c=n[n.length-1];if(l>=J[0])c=n[0];else for(let m=0;m+1<J.length;m++){const f=J[m],g=J[m+1];if(l<=f&&l>=g){const x=(f-l)/(f-g),p=x*x*(3-2*x),y=n[m],b=n[m+1];c=[y[0]+(b[0]-y[0])*p,y[1]+(b[1]-y[1])*p,y[2]+(b[2]-y[2])*p];break}}const[h,u,d]=Ye(c[0],c[1],c[2]);s[r*4]=Math.max(0,h),s[r*4+1]=Math.max(0,u),s[r*4+2]=Math.max(0,d),s[r*4+3]=1}return s}const Mt={glint:Ct(.99,.028,88),subsolar:Ct(1,.036,84),cityLight:Ct(.87,.104,74),coastDay:Ct(.95,.052,76),coastNight:Ct(.44,.028,252),moonlight:Ct(.86,.045,254)},w={0:"#060b10",50:"#10151b",100:"#1c2127",200:"#2e3339",300:"#494e53",400:"#6c7176",500:"#8e9398",600:"#b4b8bc",700:"#d5d8db",800:"#eef0f3"},X={300:"#d9951d",400:"#f7ad30",500:"#ffc353",600:"#ffdb8d"},_=`#version 300 es
`,at=`
precision highp float;

uniform vec2 uResolution;   // drawing buffer size in pixels
uniform vec3 uView;         // centre longitude, centre latitude, world width in pixels
uniform float uLonOffset;   // which copy of the world this draw call is
uniform vec2 uSun;          // solar declination and subsolar longitude, degrees

/*
 * Local time everywhere.
 *
 * Normally the whole map is one instant. In this mode every zone is drawn at
 * the same reading of its own clock instead, so the picture answers "how light
 * is it at five in the morning" for the entire world at once, and the zone
 * boundaries become visible steps in the light.
 *
 * It costs almost nothing, because of a small piece of arithmetic. At a fixed
 * local time, a zone whose offset is o is being drawn at the instant
 * T - o, and the subsolar longitude moves fifteen degrees for every hour of
 * that shift. Both terms fall out as a single shift of longitude: the Sun's
 * hour angle at a place depends only on how far that place lies from the
 * meridian its clock is keeping. So the mode is the ordinary calculation with
 * the longitude displaced, plus a small correction to the declination, which
 * drifts by up to a quarter of a degree across the fourteen hours of offset
 * that separate the extreme zones.
 */
uniform sampler2D uOffsets; // geographic raster of UTC offsets, hours
uniform float uLocalTime;   // 0 for one instant, 1 for one local time
uniform float uRefOffset;   // the offset whose clock the rest are matched to
uniform float uDecRate;     // change in solar declination, degrees per hour

/** The UTC offset in force at a point: the zone's, or nautical time at sea. */
float zoneOffset(vec2 lonlat) {
  vec4 texel = texture(uOffsets, vec2((lonlat.x + 180.0) / 360.0, (90.0 - lonlat.y) / 180.0));
  // The high seas keep nautical time, which really is the fifteen degree band.
  if (texel.a < 0.5) return floor(lonlat.x / 15.0 + 0.5);
  return texel.r * 32.0 - 12.0;
}

/** Geometric solar elevation in degrees. Mirrors elevationAt() in solar.ts. */
float solarElevation(vec2 lonlat) {
  float shift = uLocalTime > 0.0 ? zoneOffset(lonlat) - uRefOffset : 0.0;
  float lat = radians(lonlat.y);
  float dec = radians(uSun.x - uDecRate * shift);
  float ha = radians(lonlat.x - 15.0 * shift - uSun.y);
  float s = sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(ha);
  return degrees(asin(clamp(s, -1.0, 1.0)));
}

/** Degrees to top-left origin screen pixels. */
vec2 projectDeg(vec2 lonlat) {
  float worldW = uView.z;
  float dLon = lonlat.x + uLonOffset - uView.x;
  return vec2(
    dLon / 360.0 * worldW + uResolution.x * 0.5,
    -(lonlat.y - uView.y) / 180.0 * (worldW * 0.5) + uResolution.y * 0.5
  );
}

/** Top-left origin screen pixels back to degrees. */
vec2 unprojectPx(vec2 px) {
  float worldW = uView.z;
  return vec2(
    (px.x - uResolution.x * 0.5) / worldW * 360.0 + uView.x,
    -(px.y - uResolution.y * 0.5) / (worldW * 0.5) * 180.0 + uView.y
  );
}

vec4 pxToClip(vec2 px) {
  vec2 n = px / uResolution * 2.0 - 1.0;
  return vec4(n.x, -n.y, 0.0, 1.0);
}
`,He=`
uniform vec3 uSunVec;    // geocentric equatorial, thousands of km
uniform vec3 uMoonVec;
uniform float uGmst;     // Greenwich mean sidereal time, degrees
uniform float uEclipse;  // 0 when no eclipse is anywhere near

const float EARTH_R = 6.37814;
const float SUN_R = 696.0;
const float MOON_R = 1.7374;

/** Fraction of the Sun's disc hidden at a point, by area. */
float obscuration(vec2 lonlat) {
  if (uEclipse <= 0.0) return 0.0;
  float theta = radians(uGmst + lonlat.x);
  float phi = radians(lonlat.y);
  vec3 observer = EARTH_R * vec3(cos(phi) * cos(theta), cos(phi) * sin(theta), sin(phi));
  vec3 toSun = uSunVec - observer;
  vec3 toMoon = uMoonVec - observer;
  // No Sun below the horizon to hide.
  if (dot(observer, toSun) <= 0.0) return 0.0;

  float ds = length(toSun);
  float dm = length(toMoon);
  float separation = acos(clamp(dot(toSun, toMoon) / (ds * dm), -1.0, 1.0));
  float rs = asin(SUN_R / ds);
  float rm = asin(MOON_R / dm);

  if (separation >= rs + rm) return 0.0;
  if (separation <= rm - rs) return 1.0;
  if (separation <= rs - rm) return (rm * rm) / (rs * rs);

  float a1 = acos(clamp((separation * separation + rs * rs - rm * rm) / (2.0 * separation * rs), -1.0, 1.0));
  float a2 = acos(clamp((separation * separation + rm * rm - rs * rs) / (2.0 * separation * rm), -1.0, 1.0));
  float area = rs * rs * (a1 - sin(2.0 * a1) * 0.5) + rm * rm * (a2 - sin(2.0 * a2) * 0.5);
  return clamp(area / (3.14159265 * rs * rs), 0.0, 1.0);
}

/**
 * What is left of the light. Totality is not darkness: the corona and the ring
 * of distant sunlit sky leave something like deep twilight on the ground, which
 * is about a ten thousandth of full daylight, so the floor is not zero.
 */
float eclipseShade(vec2 lonlat) {
  return 1.0 - 0.985 * obscuration(lonlat);
}
`,Es=`
vec2 fragPx() {
  return vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
}
`,Ke=`
uniform sampler2D uRampA;      // the surface ramp for this pass
uniform sampler2D uRampB;      // a second ramp to blend toward, where used
uniform vec2 uRampRange;       // elevation covered by the ramps
uniform float uSurfaceDetail;  // how much the albedo texture modulates the ramp

/**
 * What this surface looks like from overhead with the Sun at this elevation.
 * The whole twilight sequence, gold through rose through violet into the night
 * blue, lives in these tables. See palette.ts for where the numbers come from.
 */
vec3 surfaceColour(sampler2D ramp, float elevationDeg) {
  float t = (elevationDeg - uRampRange.x) / (uRampRange.y - uRampRange.x);
  return texture(ramp, vec2(clamp(t, 0.001, 0.999), 0.5)).rgb;
}

/**
 * Surface variation, applied to lightness only and faded out near the
 * terminator. Below about two degrees the atmosphere is most of what you can
 * see, so all surfaces converge on the same blue grey and texture must stop.
 */
vec3 withDetail(vec3 colour, float detail, float elevationDeg) {
  float visible = smoothstep(-4.0, 8.0, elevationDeg) * uSurfaceDetail;
  return colour * (1.0 + (detail - 0.5) * visible);
}

/** Cheap value noise in geographic space, so it does not swim when you pan. */
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/**
 * Value noise that repeats exactly every "period" cells along x. Longitude wraps,
 * so noise that does not wrap with it leaves a seam down the Pacific.
 */
float periodicNoise(vec2 p, float period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, period);
  float x1 = mod(i.x + 1.0, period);
  return mix(
    mix(hash21(vec2(x0, i.y)), hash21(vec2(x1, i.y)), u.x),
    mix(hash21(vec2(x0, i.y + 1.0)), hash21(vec2(x1, i.y + 1.0)), u.x),
    u.y
  );
}
`,qe=`
uniform vec2 uMoon;        // sublunar longitude and latitude, degrees
uniform vec3 uMoonTint;    // scotopic blue grey, in linear light
uniform float uMoonGain;   // phase and distance already folded in; 0 turns it off

vec3 moonlight(vec2 lonlat, float solarElevationDeg) {
  if (uMoonGain <= 0.0) return vec3(0.0);
  float lat = radians(lonlat.y);
  float dec = radians(uMoon.y);
  float ha = radians(lonlat.x - uMoon.x);
  float sinAltitude = sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(ha);
  if (sinAltitude <= 0.0) return vec3(0.0);
  // Only where the Sun has gone. Twilight is orders of magnitude brighter than
  // any moon, so the light fades in as the sky darkens rather than switching on.
  float night = 1.0 - smoothstep(-12.0, -1.0, solarElevationDeg);
  return uMoonTint * uMoonGain * sinAltitude * night;
}
`,Ss=_+`
precision highp float;
in vec2 aPosition;   // longitude and latitude, degrees
in float aOffset;    // the zone's current UTC offset, hours
out float vOffset;
void main() {
  vOffset = aOffset;
  gl_Position = vec4(aPosition.x / 180.0, aPosition.y / 90.0, 0.0, 1.0);
}
`,As=_+`
precision highp float;
in float vOffset;
out vec4 fragColor;
void main() {
  // Offsets run from -12 to +14 in quarter hours, so a byte holds them exactly
  // at a scale of 32 hours. Alpha marks the pixel as belonging to a zone at all.
  fragColor = vec4((vOffset + 12.0) / 32.0, 0.0, 0.0, 1.0);
}
`,ee=_+`
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`,Cs=_+at+He+Es+Ke+qe+`
uniform vec3 uGlint;
uniform float uGlintGain;
uniform vec2 uLonRange;
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec2 lonlat = unprojectPx(fragPx());
  // Outside the plate there is no world, only the surround. The longitude range
  // is whatever the wrapped copies of the world actually cover, so the ocean
  // never extends past the continents drawn on it.
  if (lonlat.y > 90.0 || lonlat.y < -90.0) discard;
  if (lonlat.x < uLonRange.x || lonlat.x > uLonRange.y) discard;

  float elevation = solarElevation(lonlat);

  // A faint mottle stops the open ocean reading as flat vector fill.
  float mottle = periodicNoise(lonlat * 0.1, 36.0) * 0.62 + periodicNoise(lonlat * 0.5, 180.0) * 0.38;
  vec3 colour = withDetail(surfaceColour(uRampA, elevation), mottle, elevation);

  // Sun glint. The viewer is directly overhead at every point of an
  // equirectangular map, so the specular lobe is a tight disc centred exactly on
  // the subsolar point, which is (90 - elevation) degrees away. This is one of
  // only two things in the scene allowed past 1.0.
  float away = 90.0 - elevation;
  colour += uGlint * (exp(-away * away / 18.0) + exp(-away * away / 340.0) * 0.03) * uGlintGain;

  colour *= eclipseShade(lonlat);
  // Water is the darkest surface on the planet and reflects almost none of it.
  colour += moonlight(lonlat, elevation) * 0.35;

  fragColor = vec4(colour, 1.0);
}
`,hn=_+at+`
in vec2 aPosition;
out vec2 vLonLat;
void main() {
  vLonLat = aPosition;
  gl_Position = pxToClip(projectDeg(aPosition));
}
`,Ms=_+at+He+Ke+qe+`
uniform float uIceAmount;
uniform sampler2D uTerrain;    // June albedo, decoded to linear by the sRGB sampler
uniform sampler2D uSeason;     // December over June, a linear gain, not a colour
uniform float uTerrainAmount;  // 0 until the textures have arrived
in vec2 vLonLat;
out vec4 fragColor;

/**
 * The median land pixel, ice excluded, in linear light, printed by
 * scripts/build-terrain.mjs. This is the "typical land" the spectral ramp was
 * built to describe, so imagery at this value comes out as exactly the ramp
 * colour and everything else is read as a departure from it.
 */
const vec3 TERRAIN_REF = vec3(0.0497, 0.0513, 0.0160);
/** The season texture holds ratio / 4, so a gain above one survives 8 bits. */
const float RATIO_SCALE = 4.0;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
/**
 * Orbit sees a far wider range than a map can print: dark boreal forest and
 * bright desert are a factor of thirty apart, and mapped straight through, one
 * would be black and the other would clip. Brightness is therefore compressed
 * about the typical land value, and the colour is carried separately so that
 * flattening the range does not also drain the hue out of the Sahara.
 */
const float TERRAIN_CONTRAST = 0.36;
const float TERRAIN_CHROMA = 0.72;

void main() {
  float elevation = solarElevation(vLonLat);
  float lat = vLonLat.y;
  vec2 uv = vec2((vLonLat.x + 180.0) / 360.0, (90.0 - lat) / 180.0);

  // Fine grain to suggest relief; quieter once the real imagery has loaded.
  float grain = periodicNoise(vLonLat * 0.5, 180.0) * 0.56
              + periodicNoise(vLonLat * 2.0, 720.0) * 0.30
              + periodicNoise(vLonLat * 7.0, 2520.0) * 0.14;
  grain = mix(grain, 0.5 + (grain - 0.5) * 0.35, uTerrainAmount);

  // The land as it actually was, photographed from orbit: Blue Marble's June
  // composite, carried into December by the measured ratio between the two
  // solstice months. The Sun's own declination says how far through that
  // journey we are, so the map needs no calendar to know the season: green
  // Siberia whitens, the Sahel dries, Patagonia's snow comes and goes, all of
  // it measured rather than invented. One texture holds every detail; the
  // other is a smooth gain, which is why the change costs almost no memory.
  float season = clamp(0.5 - uSun.x / 46.88, 0.0, 1.0);
  vec3 seasonGain = texture(uSeason, uv).rgb * RATIO_SCALE;
  vec3 texel = texture(uTerrain, uv).rgb * mix(vec3(1.0), seasonGain, season);

  // Brightness relative to typical land, compressed; colour relative to typical
  // land, kept. Their product is the albedo the ramp is then shaded through.
  float refLum = dot(TERRAIN_REF, LUMA);
  float lum = max(dot(texel, LUMA), 1e-5);
  float gain = pow(lum / refLum, TERRAIN_CONTRAST);
  vec3 chroma = (texel / lum) / (TERRAIN_REF / refLum);
  vec3 rel = clamp(gain * mix(vec3(1.0), chroma, TERRAIN_CHROMA), 0.0, 2.6);

  // Snow and ice identify themselves in the imagery: bright and colourless.
  // Because this reads the blended texel, the ice ramp follows the real snow
  // as it advances and retreats, and snow goes pink at sunset like snow.
  float peak = max(texel.r, max(texel.g, texel.b));
  float sat = (peak - min(texel.r, min(texel.g, texel.b))) / max(peak, 1e-4);
  float ice = smoothstep(0.34, 0.62, lum) * (1.0 - smoothstep(0.1, 0.26, sat)) * uTerrainAmount * uIceAmount;

  // Albedo is a daylight fact. Within a few degrees of the terminator the
  // atmosphere is most of what you can see, so the imagery lets go there and
  // every surface converges on the ramp's own twilight colour.
  float lit = smoothstep(-4.0, 8.0, elevation);
  vec3 albedo = mix(vec3(1.0), rel, lit * uTerrainAmount);

  vec3 base = mix(surfaceColour(uRampA, elevation) * albedo, surfaceColour(uRampB, elevation), ice);

  base *= eclipseShade(vLonLat);
  // Moonlight, off the ground's own albedo, so snow catches it and forest does
  // not. This is what makes a moonlit Greenland read against a black ocean.
  base += moonlight(vLonLat, elevation) * mix(rel, vec3(2.2), ice);

  fragColor = vec4(withDetail(base, grain, elevation), 1.0);
}
`,Rs=_+at+He+Ke+qe+`
in vec2 vLonLat;
out vec4 fragColor;

void main() {
  float elevation = solarElevation(vLonLat);
  // Inland water reads a shade deeper than the open ocean, which is both true
  // and useful: it keeps the Great Lakes and the Caspian legible against land.
  vec3 colour = surfaceColour(uRampA, elevation) * 0.82;
  float away = 90.0 - elevation;
  colour += vec3(0.92, 0.87, 0.74) * exp(-away * away / 40.0) * 0.45;
  colour *= eclipseShade(vLonLat);
  colour += moonlight(vLonLat, elevation) * 0.35;
  fragColor = vec4(colour, 1.0);
}
`,un=_+at+`
in vec2 aCorner;    // x runs 0..1 along the segment, y runs -1..1 across it
in vec4 aSegment;   // lon0, lat0, lon1, lat1
uniform float uWidth;
uniform float uFeather;

out vec2 vPx;
out vec2 vA;
out vec2 vB;
out vec2 vLonLat;

void main() {
  vec2 a = projectDeg(aSegment.xy);
  vec2 b = projectDeg(aSegment.zw);
  vec2 delta = b - a;
  float len = length(delta);
  vec2 dir = len > 1e-5 ? delta / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-dir.y, dir.x);

  float reach = uWidth * 0.5 + uFeather + 1.0;
  vec2 centre = mix(a, b, aCorner.x);
  vec2 p = centre + dir * (aCorner.x * 2.0 - 1.0) * reach + normal * aCorner.y * reach;

  vPx = p;
  vA = a;
  vB = b;
  vLonLat = mix(aSegment.xy, aSegment.zw, aCorner.x);
  gl_Position = pxToClip(p);
}
`,Bn=`
float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}
`,Is=_+at+Bn+`
uniform float uWidth;
uniform float uFeather;
uniform vec3 uDayTint;
uniform vec3 uNightTint;
uniform float uIntensity;
uniform float uDayFade;

in vec2 vPx;
in vec2 vA;
in vec2 vB;
in vec2 vLonLat;
out vec4 fragColor;

void main() {
  float d = segmentDistance(vPx, vA, vB);
  float alpha = 1.0 - smoothstep(uWidth * 0.5 - uFeather, uWidth * 0.5 + uFeather, d);
  if (alpha <= 0.002) discard;

  float elevation = solarElevation(vLonLat);
  float lit = smoothstep(-8.0, 6.0, elevation);
  // In daylight the land draws its own coast: the shore is where the terrain
  // stops, and an outline over it only makes the map look like a printed
  // atlas. So the stroke fades out as the light comes up, and stays on the
  // night side, where without it the outline of the world would be lost.
  vec3 tint = mix(uNightTint, uDayTint, lit);
  float a = alpha * uIntensity * mix(1.0, uDayFade, lit);
  fragColor = vec4(tint * a, a);
}
`,Ls=_+at+Bn+`
uniform float uWidth;
uniform float uFeather;
uniform vec3 uTint;
uniform float uIntensity;

in vec2 vPx;
in vec2 vA;
in vec2 vB;
in vec2 vLonLat;
out vec4 fragColor;

void main() {
  float d = segmentDistance(vPx, vA, vB);
  float alpha = 1.0 - smoothstep(uWidth * 0.5 - uFeather, uWidth * 0.5 + uFeather, d);
  if (alpha <= 0.002) discard;
  float elevation = solarElevation(vLonLat);
  // Borders are a reference, not a subject. They never compete with the coast.
  float visible = mix(0.5, 1.0, smoothstep(-12.0, 8.0, elevation));
  float a = alpha * uIntensity * visible;
  fragColor = vec4(uTint * a, a);
}
`,ks=_+at+`
in vec2 aCorner;      // -1..1 quad
in vec3 aCity;        // lon, lat, magnitude
uniform float uSizeMin;
uniform float uSizeMax;
uniform float uZoom;

out vec2 vUv;
out float vMagnitude;
out float vNight;
out float vFlux;

void main() {
  // Cull in daylight here rather than discarding per fragment. Roughly half the
  // world is lit at any moment, and a city halo is a big sprite, so throwing
  // them away before rasterisation halves the fill cost of this pass.
  float elevation = solarElevation(aCity.xy);
  vNight = 1.0 - smoothstep(-8.0, 2.0, elevation);
  if (vNight <= 0.002) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec2 centre = projectDeg(aCity.xy);
  // Bigger places get bigger halos, and the halo grows with the map so the lit
  // field keeps the same shape as you zoom. Scaling it any slower pulls the
  // glows apart and turns a continent into a field of separate dots.
  float scale = clamp(pow(uZoom, 0.8), 0.9, 3.5);
  float size = mix(uSizeMin, uSizeMax, pow(aCity.z, 1.7)) * scale;
  // A city emits a fixed amount of light. Spreading it over a larger halo has to
  // dim it, or every zoom step makes the continents brighter than the last.
  vFlux = 1.0 / pow(scale, 1.35);
  vUv = aCorner;
  vMagnitude = aCity.z;
  gl_Position = pxToClip(centre + aCorner * size);
}
`,Fs=_+`
precision highp float;
uniform vec3 uLightColour;
uniform float uIntensity;

in vec2 vUv;
in float vMagnitude;
in float vNight;
in float vFlux;
out vec4 fragColor;

void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;

  // A hot core inside a soft halo, the shape a street grid makes from orbit.
  float core = exp(-r2 * 26.0);
  float halo = exp(-r2 * 3.4) * 0.3;
  float edge = 1.0 - smoothstep(0.49, 1.0, r2);

  float brightness = (core + halo) * edge * vNight * vFlux * uIntensity * (0.3 + 0.7 * vMagnitude);
  fragColor = vec4(uLightColour * brightness, 1.0);
}
`,zs=_+at+`
in vec2 aCorner;
uniform float uSize;
out vec2 vUv;
void main() {
  vec2 centre = projectDeg(uSun.yx);
  vUv = aCorner;
  gl_Position = pxToClip(centre + aCorner * uSize);
}
`,Ds=_+`
precision highp float;
uniform vec3 uColour;
uniform float uIntensity;
in vec2 vUv;
out vec4 fragColor;

void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float core = exp(-r * r * 46.0);
  float halo = exp(-r * r * 4.5) * 0.24;
  float bleed = pow(max(0.0, 1.0 - r), 3.0) * 0.1;
  fragColor = vec4(uColour * (core + halo + bleed) * uIntensity, 1.0);
}
`,Us=_+`
precision highp float;
uniform sampler2D uScene;
uniform float uThreshold;
uniform float uSoftKnee;
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec3 c = max(texture(uScene, vUv).rgb, 0.0);
  float brightness = max(c.r, max(c.g, c.b));
  float knee = uThreshold * uSoftKnee + 1e-5;
  float soft = clamp(brightness - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee);
  float weight = max(soft, brightness - uThreshold) / max(brightness, 1e-5);
  fragColor = vec4(c * weight, 1.0);
}
`,Ps=_+`
precision highp float;
uniform sampler2D uSource;
uniform vec2 uDirection;   // texel step, already scaled by the blur radius
in vec2 vUv;
out vec4 fragColor;

const float W0 = 0.2270270270;
const float W1 = 0.1945945946;
const float W2 = 0.1216216216;
const float W3 = 0.0540540541;
const float W4 = 0.0162162162;

void main() {
  vec3 sum = texture(uSource, vUv).rgb * W0;
  sum += (texture(uSource, vUv + uDirection * 1.0).rgb + texture(uSource, vUv - uDirection * 1.0).rgb) * W1;
  sum += (texture(uSource, vUv + uDirection * 2.0).rgb + texture(uSource, vUv - uDirection * 2.0).rgb) * W2;
  sum += (texture(uSource, vUv + uDirection * 3.0).rgb + texture(uSource, vUv - uDirection * 3.0).rgb) * W3;
  sum += (texture(uSource, vUv + uDirection * 4.0).rgb + texture(uSource, vUv - uDirection * 4.0).rgb) * W4;
  fragColor = vec4(sum, 1.0);
}
`,Ns=_+`
precision highp float;

uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2 uResolution;
uniform float uExposure;
uniform float uBloomStrength;
uniform float uVignette;
uniform float uGrain;
uniform float uAberration;
uniform float uTime;
in vec2 vUv;
out vec4 fragColor;

vec3 encodeSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

/** Interleaved gradient noise: cheap, and its spectrum hides banding well. */
float igNoise(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec2 uv = vUv;
  vec2 offset = (uv - 0.5) * dot(uv - 0.5, uv - 0.5) * 4.0 * uAberration / uResolution.x;

  vec3 scene = vec3(
    texture(uScene, uv + offset).r,
    texture(uScene, uv).g,
    texture(uScene, uv - offset).b
  );
  scene += texture(uBloom, uv).rgb * uBloomStrength;

  // Exposure then an exponential roll off, which holds blacks at zero while
  // letting the glint and the brightest cities bloom out into white.
  vec3 mapped = vec3(1.0) - exp(-max(scene, 0.0) * uExposure);

  // A gentle corner falloff, centred a little above the middle. Dead centre
  // reads as a CSS effect; slightly high reads as a lens.
  vec2 centred = (uv - vec2(0.5, 0.45)) * vec2(1.0, uResolution.y / uResolution.x);
  mapped *= 1.0 - uVignette * smoothstep(0.30, 0.78, length(centred));

  vec3 srgb = encodeSrgb(mapped);
  float n = igNoise(gl_FragCoord.xy + vec2(uTime * 91.7, uTime * 43.1)) - 0.5;
  srgb += n * uGrain;
  srgb += (igNoise(gl_FragCoord.xy * 1.7) - 0.5) / 255.0;

  fragColor = vec4(srgb, 1.0);
}
`,Gn=1,_n=12;function Wn(i){return Math.min(i.width,i.height*2)}function L(i,t){return Wn(i)*t.zoom}function ve(i,t){return L(i,t)/2}function N(i,t,e,n){const s=L(i,t);let o=e-t.centerLon;return o=((o+180)%360+360)%360-180,[o/360*s+i.width/2,-(n-t.centerLat)/180*(s/2)+i.height/2]}function _t(i,t,e,n){const s=L(i,t),o=(e-i.width/2)/s*360+t.centerLon,a=-(n-i.height/2)/(s/2)*180+t.centerLat;return[Ft(o),a]}function Ft(i){const t=((i+180)%360+360)%360-180;return t===-180?180:t}function st(i,t){const e=Math.min(_n,Math.max(Gn,t.zoom)),n={centerLon:Ft(t.centerLon),centerLat:t.centerLat,zoom:e},s=ve(i,n);if(s<=i.height)n.centerLat=0;else{const o=i.height/2/s*180;n.centerLat=Math.min(90-o,Math.max(-90+o,n.centerLat))}return n}function Rt(i,t,e,n,s){const[o,a]=_t(i,t,e,n),r={...t,zoom:Math.min(_n,Math.max(Gn,t.zoom*s))},[l,c]=N(i,r,o,a),h={centerLon:r.centerLon+(l-e)/L(i,r)*360,centerLat:r.centerLat-(c-n)/ve(i,r)*180,zoom:r.zoom};return st(i,h)}function dn(i,t,e,n){return st(i,{centerLon:t.centerLon-e/L(i,t)*360,centerLat:t.centerLat+n/ve(i,t)*180,zoom:t.zoom})}function yt(i,t){const e=L(i,t),n=e/2;return{x:i.width/2-e/2-t.centerLon/360*e,y:i.height/2-n/2+t.centerLat/180*n,width:e,height:n}}const ce={exposure:1.55,glintGain:1.6,surfaceDetail:.34,iceAmount:.82,cityIntensity:.72,citySizeMin:2,citySizeMax:13,coastWidth:.9,coastIntensity:.5,coastDayFade:.16,moonlight:.008,borderWidth:.85,borderIntensity:.28,sunspotSize:14,sunspotIntensity:1.7,bloomThreshold:1.05,bloomSoftKnee:.45,bloomStrength:.34,bloomRadius:2.2,vignette:.3,grain:.022,aberration:.6},ne=4,fn=2048,mn=1024;class Bs{gl;world;ocean;land;lake;coast;border;city;sunspot;bright;blur;present;counts;ramps;groundClear;terrain;season;terrainReady=!1;zoneOffsetPass;zoneOffsetBuffer;zoneVertexFeature;zoneOffsetCount;zoneOffsetTexture;zoneOffsetFbo=null;width=1;height=1;samples=0;floatTargets=!1;sceneFbo=null;sceneRenderbuffer=null;resolveFbo=null;resolveTexture=null;bloomFbo=[null,null];bloomTexture=[null,null];constructor(t,e){const n=t.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,premultipliedAlpha:!1,powerPreference:"high-performance",preserveDrawingBuffer:!0});if(!n)throw new Error("WebGL2 is required and is not available in this browser");this.gl=n,this.world=e,this.floatTargets=n.getExtension("EXT_color_buffer_float")!==null||n.getExtension("EXT_color_buffer_half_float")!==null,this.samples=this.floatTargets?Math.min(4,n.getParameter(n.MAX_SAMPLES)):0;const s=Y(n,xs),o=Y(n,new Float32Array([-1,-1,1,-1,-1,1,1,1]));this.ocean=this.pass(ee,Cs,null);const a=we(e.land),r=ct(n,hn,Ms),l=Y(n,a.positions),c=Y(n,a.indices,n.ELEMENT_ARRAY_BUFFER);this.land={program:r,uniforms:new ht(n,r),vao:gt(n,r,{aPosition:{buffer:l,size:2}},c)};const h=we(e.lakes),u=ct(n,hn,Rs),d=Y(n,h.positions),m=Y(n,h.indices,n.ELEMENT_ARRAY_BUFFER);this.lake={program:u,uniforms:new ht(n,u),vao:gt(n,u,{aPosition:{buffer:d,size:2}},m)};const f=we(e.timezones,!0),g=ct(n,Ss,As),x=Y(n,f.positions),p=Y(n,f.indices,n.ELEMENT_ARRAY_BUFFER);this.zoneVertexFeature=f.featureIds??new Float32Array(f.positions.length/2),this.zoneOffsetBuffer=Y(n,new Float32Array(this.zoneVertexFeature.length)),this.zoneOffsetCount=f.indices.length,this.zoneOffsetPass={program:g,uniforms:new ht(n,g),vao:gt(n,g,{aPosition:{buffer:x,size:2},aOffset:{buffer:this.zoneOffsetBuffer,size:1}},p)},this.zoneOffsetTexture=this.createZoneOffsetTarget();const y=ys(e.land),b=ct(n,un,Is),v=Y(n,y);this.coast={program:b,uniforms:new ht(n,b),vao:gt(n,b,{aCorner:{buffer:s,size:2},aSegment:{buffer:v,size:4,divisor:1}})};const E=vs(e.borders),A=ct(n,un,Ls),S=Y(n,E);this.border={program:A,uniforms:new ht(n,A),vao:gt(n,A,{aCorner:{buffer:s,size:2},aSegment:{buffer:S,size:4,divisor:1}})};const z=new Float32Array(e.cities.length*3);e.cities.forEach((Ut,xe)=>{z[xe*3]=Ut.lon,z[xe*3+1]=Ut.lat,z[xe*3+2]=Ut.magnitude});const P=ct(n,ks,Fs),j=Y(n,z);this.city={program:P,uniforms:new ht(n,P),vao:gt(n,P,{aCorner:{buffer:o,size:2},aCity:{buffer:j,size:3,divisor:1}})};const C=ct(n,zs,Ds);this.sunspot={program:C,uniforms:new ht(n,C),vao:gt(n,C,{aCorner:{buffer:o,size:2}})},this.bright=this.pass(ee,Us,null),this.blur=this.pass(ee,Ps,null),this.present=this.pass(ee,Ns,null),this.counts={land:a.indices.length,lake:h.indices.length,coast:y.length/4,border:E.length/4,city:e.cities.length},this.ramps={ocean:this.createLutTexture("ocean"),land:this.createLutTexture("land"),ice:this.createLutTexture("ice")},this.terrain=this.createPixel([128,128,128,255]),this.season=this.createPixel([64,64,64,255]);const rt=dt(w[0]),lt=Ut=>-Math.log(Math.max(1e-6,1-Ut))/ce.exposure;this.groundClear=[lt(rt[0]),lt(rt[1]),lt(rt[2])]}createZoneOffsetTarget(){const t=this.gl,e=t.createTexture();if(!e)throw new Error("could not create the zone offset texture");return t.bindTexture(t.TEXTURE_2D,e),t.texStorage2D(t.TEXTURE_2D,1,t.RGBA8,fn,mn),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.NEAREST),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.NEAREST),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.REPEAT),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.bindTexture(t.TEXTURE_2D,null),this.zoneOffsetFbo=t.createFramebuffer(),t.bindFramebuffer(t.FRAMEBUFFER,this.zoneOffsetFbo),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,e,0),t.bindFramebuffer(t.FRAMEBUFFER,null),e}setZoneOffsets(t){const e=this.gl,n=new Float32Array(this.zoneVertexFeature.length);for(let s=0;s<n.length;s++)n[s]=t[this.zoneVertexFeature[s]]??0;e.bindBuffer(e.ARRAY_BUFFER,this.zoneOffsetBuffer),e.bufferData(e.ARRAY_BUFFER,n,e.STATIC_DRAW),e.bindBuffer(e.ARRAY_BUFFER,null),e.bindFramebuffer(e.FRAMEBUFFER,this.zoneOffsetFbo),e.viewport(0,0,fn,mn),e.disable(e.BLEND),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(this.zoneOffsetPass.program),e.bindVertexArray(this.zoneOffsetPass.vao),e.drawElements(e.TRIANGLES,this.zoneOffsetCount,e.UNSIGNED_INT,0),e.bindVertexArray(null),e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,this.width,this.height)}pass(t,e,n){const s=ct(this.gl,t,e);return{program:s,uniforms:new ht(this.gl,s),vao:n}}createLutTexture(t){const e=this.gl,n=1024,s=Ts(t,n,ce.exposure),o=e.createTexture();if(!o)throw new Error(`could not create the ${t} lookup texture`);if(e.bindTexture(e.TEXTURE_2D,o),this.floatTargets)e.texImage2D(e.TEXTURE_2D,0,e.RGBA16F,n,1,0,e.RGBA,e.FLOAT,s);else{const a=new Uint8Array(n*4);for(let r=0;r<a.length;r++)a[r]=Math.round(Math.min(1,s[r]??0)*255);e.texImage2D(e.TEXTURE_2D,0,e.RGBA,n,1,0,e.RGBA,e.UNSIGNED_BYTE,a)}return e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.bindTexture(e.TEXTURE_2D,null),o}createPixel(t){const e=this.gl,n=e.createTexture();if(!n)throw new Error("could not create a placeholder texture");return e.bindTexture(e.TEXTURE_2D,n),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array(t)),e.bindTexture(e.TEXTURE_2D,null),n}setTerrain(t,e){const n=this.gl,s=(r,l)=>{const c=n.createTexture();if(!c)throw new Error("could not create the terrain texture");return n.bindTexture(n.TEXTURE_2D,c),n.texImage2D(n.TEXTURE_2D,0,l?n.SRGB8_ALPHA8:n.RGBA8,n.RGBA,n.UNSIGNED_BYTE,r),n.generateMipmap(n.TEXTURE_2D),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR_MIPMAP_LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MAG_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.REPEAT),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE),n.bindTexture(n.TEXTURE_2D,null),c},o=s(t,!0),a=s(e,!1);n.deleteTexture(this.terrain),n.deleteTexture(this.season),this.terrain=o,this.season=a,this.terrainReady=!0}resize(t,e){const n=Math.max(1,Math.floor(t)),s=Math.max(1,Math.floor(e));if(n===this.width&&s===this.height&&this.sceneFbo)return;this.width=n,this.height=s;const o=this.gl;o.canvas.width=n,o.canvas.height=s,this.releaseTargets();const a=this.floatTargets?o.RGBA16F:o.RGBA8;this.samples>1&&(this.sceneRenderbuffer=o.createRenderbuffer(),o.bindRenderbuffer(o.RENDERBUFFER,this.sceneRenderbuffer),o.renderbufferStorageMultisample(o.RENDERBUFFER,this.samples,a,n,s),this.sceneFbo=o.createFramebuffer(),o.bindFramebuffer(o.FRAMEBUFFER,this.sceneFbo),o.framebufferRenderbuffer(o.FRAMEBUFFER,o.COLOR_ATTACHMENT0,o.RENDERBUFFER,this.sceneRenderbuffer),o.checkFramebufferStatus(o.FRAMEBUFFER)!==o.FRAMEBUFFER_COMPLETE&&(this.samples=0,this.releaseTargets())),this.resolveTexture=this.createTarget(n,s,a),this.resolveFbo=o.createFramebuffer(),o.bindFramebuffer(o.FRAMEBUFFER,this.resolveFbo),o.framebufferTexture2D(o.FRAMEBUFFER,o.COLOR_ATTACHMENT0,o.TEXTURE_2D,this.resolveTexture,0),this.samples<=1&&(this.sceneFbo=this.resolveFbo);const r=Math.max(1,Math.floor(n/ne)),l=Math.max(1,Math.floor(s/ne));for(const c of[0,1]){const h=this.createTarget(r,l,a),u=o.createFramebuffer();o.bindFramebuffer(o.FRAMEBUFFER,u),o.framebufferTexture2D(o.FRAMEBUFFER,o.COLOR_ATTACHMENT0,o.TEXTURE_2D,h,0),this.bloomTexture[c]=h,this.bloomFbo[c]=u}o.bindFramebuffer(o.FRAMEBUFFER,null)}createTarget(t,e,n){const s=this.gl,o=s.createTexture();if(!o)throw new Error("could not create a render target");return s.bindTexture(s.TEXTURE_2D,o),s.texStorage2D(s.TEXTURE_2D,1,n,t,e),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MIN_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MAG_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE),s.bindTexture(s.TEXTURE_2D,null),o}releaseTargets(){const t=this.gl;this.sceneFbo&&this.sceneFbo!==this.resolveFbo&&t.deleteFramebuffer(this.sceneFbo),this.sceneRenderbuffer&&t.deleteRenderbuffer(this.sceneRenderbuffer),this.resolveFbo&&t.deleteFramebuffer(this.resolveFbo),this.resolveTexture&&t.deleteTexture(this.resolveTexture);for(const e of[0,1])this.bloomFbo[e]&&t.deleteFramebuffer(this.bloomFbo[e]),this.bloomTexture[e]&&t.deleteTexture(this.bloomTexture[e]),this.bloomFbo[e]=null,this.bloomTexture[e]=null;this.sceneFbo=null,this.sceneRenderbuffer=null,this.resolveFbo=null,this.resolveTexture=null}visibleCopies(t){const e=L(t.size,t.view);if(e<=t.size.width)return[0];const n=t.size.width/2/e*360,s=t.view.centerLon-n,o=t.view.centerLon+n,a=.5,r=[];for(let l=-2;l<=2;l++){const c=-180+l*360;180+l*360>s+a&&c<o-a&&r.push(l*360)}return r.length>0?r:[0]}setView(t,e,n,s){const o=this.gl;t.f2("uResolution",this.width,this.height),t.f3("uView",e.view.centerLon,e.view.centerLat,L(e.size,e.view)*n),t.f1("uLonOffset",s),t.f2("uSun",e.sun.declination,e.sun.subsolarLon),o.activeTexture(o.TEXTURE4),o.bindTexture(o.TEXTURE_2D,this.zoneOffsetTexture),o.activeTexture(o.TEXTURE0),t.i1("uOffsets",4),t.f1("uLocalTime",e.localTime?1:0),t.f1("uRefOffset",e.localTime?.referenceOffsetHours??0),t.f1("uDecRate",e.localTime?.declinationRatePerHour??0);const a=e.eclipse;t.f3("uSunVec",a?.sun[0]??0,a?.sun[1]??0,a?.sun[2]??1),t.f3("uMoonVec",a?.moon[0]??0,a?.moon[1]??0,a?.moon[2]??1),t.f1("uGmst",a?.gmst??0),t.f1("uEclipse",a?1:0),t.f2("uMoon",e.moon?.lon??0,e.moon?.lat??0),t.f3("uMoonTint",...Mt.moonlight),t.f1("uMoonGain",(e.moon?.gain??0)*this.moonlightGain)}moonlightGain=ce.moonlight;setRamps(t,e,n,s){const o=this.gl;o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,this.ramps[n]),t.i1("uRampA",0),s&&(o.activeTexture(o.TEXTURE1),o.bindTexture(o.TEXTURE_2D,this.ramps[s]),t.i1("uRampB",1),o.activeTexture(o.TEXTURE0)),t.f2("uRampRange",Ge.min,Ge.max),t.f1("uSurfaceDetail",e.surfaceDetail)}render(t){const e=this.gl;this.moonlightGain=t.tuning.moonlight;const n=this.width/t.size.width,s=t.tuning,o=this.visibleCopies(t);e.bindFramebuffer(e.FRAMEBUFFER,this.sceneFbo),e.viewport(0,0,this.width,this.height),e.disable(e.DEPTH_TEST),e.disable(e.BLEND),e.clearColor(this.groundClear[0],this.groundClear[1],this.groundClear[2],1),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(this.ocean.program),this.setView(this.ocean.uniforms,t,n,0),this.setRamps(this.ocean.uniforms,s,"ocean"),this.ocean.uniforms.f3("uGlint",...Mt.glint),this.ocean.uniforms.f1("uGlintGain",s.glintGain),this.ocean.uniforms.f2("uLonRange",-180+Math.min(...o),180+Math.max(...o)),e.drawArrays(e.TRIANGLES,0,3),e.useProgram(this.land.program),e.bindVertexArray(this.land.vao),this.setRamps(this.land.uniforms,s,"land","ice"),this.land.uniforms.f1("uIceAmount",s.iceAmount),e.activeTexture(e.TEXTURE2),e.bindTexture(e.TEXTURE_2D,this.terrain),e.activeTexture(e.TEXTURE3),e.bindTexture(e.TEXTURE_2D,this.season),e.activeTexture(e.TEXTURE0),this.land.uniforms.i1("uTerrain",2),this.land.uniforms.i1("uSeason",3),this.land.uniforms.f1("uTerrainAmount",this.terrainReady?1:0);for(const r of o)this.setView(this.land.uniforms,t,n,r),e.drawElements(e.TRIANGLES,this.counts.land,e.UNSIGNED_INT,0);if(t.layers.lakes){e.useProgram(this.lake.program),e.bindVertexArray(this.lake.vao),this.setRamps(this.lake.uniforms,s,"ocean");for(const r of o)this.setView(this.lake.uniforms,t,n,r),e.drawElements(e.TRIANGLES,this.counts.lake,e.UNSIGNED_INT,0)}if(e.enable(e.BLEND),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA),t.layers.borders){e.useProgram(this.border.program),e.bindVertexArray(this.border.vao);const r=this.border.uniforms;r.f1("uWidth",s.borderWidth*n),r.f1("uFeather",.75*n);const l=dt(w[300]);r.f3("uTint",l[0],l[1],l[2]),r.f1("uIntensity",s.borderIntensity);for(const c of o)this.setView(r,t,n,c),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,this.counts.border)}if(t.layers.coast){e.useProgram(this.coast.program),e.bindVertexArray(this.coast.vao);const r=this.coast.uniforms;r.f1("uWidth",s.coastWidth*n),r.f1("uFeather",.7*n),r.f3("uDayTint",...Mt.coastDay),r.f3("uNightTint",...Mt.coastNight),r.f1("uIntensity",s.coastIntensity),r.f1("uDayFade",s.coastDayFade);for(const l of o)this.setView(r,t,n,l),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,this.counts.coast)}if(e.blendFunc(e.ONE,e.ONE),t.layers.cities){e.useProgram(this.city.program),e.bindVertexArray(this.city.vao);const r=this.city.uniforms;r.f3("uLightColour",...Mt.cityLight),r.f1("uIntensity",s.cityIntensity),r.f1("uSizeMin",s.citySizeMin*n),r.f1("uSizeMax",s.citySizeMax*n),r.f1("uZoom",t.view.zoom);for(const l of o)this.setView(r,t,n,l),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,this.counts.city)}e.useProgram(this.sunspot.program),e.bindVertexArray(this.sunspot.vao);{const r=this.sunspot.uniforms;r.f3("uColour",...Mt.subsolar),r.f1("uIntensity",s.sunspotIntensity),r.f1("uSize",s.sunspotSize*n);for(const l of o)this.setView(r,t,n,l),e.drawArrays(e.TRIANGLE_STRIP,0,4)}e.bindVertexArray(null),e.disable(e.BLEND),this.samples>1&&this.sceneFbo!==this.resolveFbo&&(e.bindFramebuffer(e.READ_FRAMEBUFFER,this.sceneFbo),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,this.resolveFbo),e.blitFramebuffer(0,0,this.width,this.height,0,0,this.width,this.height,e.COLOR_BUFFER_BIT,e.NEAREST),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null)),this.renderBloom(s),e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,this.width,this.height),e.useProgram(this.present.program);const a=this.present.uniforms;e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.resolveTexture),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,this.bloomTexture[0]),a.i1("uScene",0),a.i1("uBloom",1),a.f2("uResolution",this.width,this.height),a.f1("uExposure",s.exposure),a.f1("uBloomStrength",s.bloomStrength),a.f1("uVignette",s.vignette),a.f1("uGrain",s.grain),a.f1("uAberration",s.aberration*n),a.f1("uTime",t.time),e.drawArrays(e.TRIANGLES,0,3),e.activeTexture(e.TEXTURE0)}renderBloom(t){const e=this.gl,n=Math.max(1,Math.floor(this.width/ne)),s=Math.max(1,Math.floor(this.height/ne));e.viewport(0,0,n,s),e.bindFramebuffer(e.FRAMEBUFFER,this.bloomFbo[1]),e.useProgram(this.bright.program),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.resolveTexture),this.bright.uniforms.i1("uScene",0),this.bright.uniforms.f1("uThreshold",t.bloomThreshold),this.bright.uniforms.f1("uSoftKnee",t.bloomSoftKnee),e.drawArrays(e.TRIANGLES,0,3),e.useProgram(this.blur.program),this.blur.uniforms.i1("uSource",0),e.bindFramebuffer(e.FRAMEBUFFER,this.bloomFbo[0]),e.bindTexture(e.TEXTURE_2D,this.bloomTexture[1]),this.blur.uniforms.f2("uDirection",t.bloomRadius/n,0),e.drawArrays(e.TRIANGLES,0,3),e.bindFramebuffer(e.FRAMEBUFFER,this.bloomFbo[1]),e.bindTexture(e.TEXTURE_2D,this.bloomTexture[0]),this.blur.uniforms.f2("uDirection",0,t.bloomRadius/s),e.drawArrays(e.TRIANGLES,0,3);const[o,a]=this.bloomTexture;this.bloomTexture=[a,o];const[r,l]=this.bloomFbo;this.bloomFbo=[l,r],e.viewport(0,0,this.width,this.height)}get cityCount(){return this.world.cities.length}dispose(){this.releaseTargets();for(const t of Object.values(this.ramps))this.gl.deleteTexture(t);this.gl.deleteTexture(this.terrain),this.gl.deleteTexture(this.season),this.gl.deleteTexture(this.zoneOffsetTexture),this.zoneOffsetFbo&&this.gl.deleteFramebuffer(this.zoneOffsetFbo)}}const Wt=23.4366,se=90-Wt,Gs=[{altitude:-.833,label:"SUNRISE / SUNSET",weight:1.2,alpha:.7,warm:!0},{altitude:-6,label:"CIVIL",weight:1,alpha:.46,warm:!1},{altitude:-12,label:"NAUTICAL",weight:1,alpha:.38,warm:!1},{altitude:-18,label:"ASTRONOMICAL",weight:1,alpha:.3,warm:!1}],V=Math.PI/180,pn=36e5,_s="#b4532c";class ge{constructor(t){this.canvas=t;const e=t.getContext("2d",{alpha:!0});if(!e)throw new Error("could not get a 2D context for the overlay");this.ctx=e}ctx;dpr=1;occupied=[];resize(t,e,n){this.dpr=n,this.canvas.width=Math.max(1,Math.round(t*n)),this.canvas.height=Math.max(1,Math.round(e*n))}get hairline(){return 1/this.dpr}draw(t){const{ctx:e}=this,{size:n}=t;e.setTransform(this.dpr,0,0,this.dpr,0,0),e.clearRect(0,0,n.width,n.height),this.occupied=[],e.save(),e.globalAlpha=t.reveal,e.save(),this.clipToPlate(t),t.layers.timezones&&(this.drawZoneFills(t),this.drawZoneOutlines(t)),t.layers.graticule&&this.drawGraticule(t),t.layers.analemma&&t.analemma&&this.drawAnalemma(t),t.layers.boundaries&&!t.localTime&&this.drawTwilightBoundaries(t),t.eclipsePath&&!t.localTime&&this.drawEclipsePath(t,t.eclipsePath),t.lunarEclipse&&!t.localTime&&this.drawLunarVisibility(t,t.lunarEclipse),t.localTime||this.drawSubsolar(t),t.moon&&this.drawSublunar(t,t.moon),t.layers.timezones&&this.drawZoneLabels(t),t.layers.places&&this.drawPlaceLabels(t),t.pinned&&this.drawPin(t,t.pinned),t.hover&&this.drawHover(t,t.hover),e.restore(),this.drawPlateFrame(t),e.restore()}strokeGeoPath(t,e,n){const{ctx:s}=this,o=L(t.size,t.view),a=e.map(([r,l])=>N(t.size,t.view,r,l));for(const r of[-o,0,o]){if(r!==0&&o>=t.size.width*3)continue;s.beginPath();let l=!1;for(let c=0;c<a.length;c++){const h=a[c],u=a[c-1];u&&Math.abs(h[0]-u[0])>o/2&&(l=!1),l?s.lineTo(h[0]+r,h[1]):(s.moveTo(h[0]+r,h[1]),l=!0)}n&&l&&s.closePath(),s.stroke()}}static smallCircle(t,e,n,s=512){const o=t*V,a=e*V,r=n*V,l=Math.sin(o),c=Math.cos(o),h=Math.sin(r),u=Math.cos(r),d=[];for(let m=0;m<=s;m++){const f=m/s*2*Math.PI,g=Math.asin(l*u+c*h*Math.cos(f)),x=a+Math.atan2(Math.sin(f)*h*c,u-l*Math.sin(g));d.push([(x/V+540)%360-180,g/V])}return d}clipToPlate(t){const e=yt(t.size,t.view);this.ctx.beginPath(),this.ctx.rect(Math.max(0,e.x),e.y,Math.min(t.size.width,e.width),e.height),this.ctx.clip()}drawGraticule(t){const{ctx:e}=this,n=yt(t.size,t.view),s=t.view.zoom>=4?10:30,o=this.hairline;e.save(),e.beginPath(),e.rect(n.x-n.width,n.y,n.width*3,n.height),e.clip(),e.lineWidth=o,e.strokeStyle=w[100],e.globalAlpha*=1;for(let a=-180+s;a<180;a+=s)a!==0&&this.line(t,[[a,-90],[a,90]],w[100],o,.5);for(let a=-90+s;a<90;a+=s)a!==0&&this.line(t,[[-180,a],[180,a]],w[100],o,.5);this.line(t,[[0,-90],[0,90]],w[200],o,.75),this.line(t,[[-180,0],[180,0]],w[300],o*1.5,.85);for(const a of[Wt,-Wt])this.line(t,[[-180,a],[180,a]],w[200],o*1.5,.7);for(const a of[se,-se])this.line(t,[[-180,a],[180,a]],w[200],o*1.5,.55);e.restore(),this.drawGraticuleLabels(t,s)}line(t,e,n,s,o){const{ctx:a}=this;a.save(),a.strokeStyle=n,a.lineWidth=s,a.globalAlpha*=o,this.strokeGeoPath(t,e,!1),a.restore()}drawGraticuleLabels(t,e){const{ctx:n}=this,s=yt(t.size,t.view);n.save(),n.font=`500 9px ${Ae}`,n.fillStyle=w[300],n.globalAlpha*=.85,n.textBaseline="middle";const o=[[Wt,"TROPIC OF CANCER"],[0,"EQUATOR"],[-Wt,"TROPIC OF CAPRICORN"],[se,"ARCTIC CIRCLE"],[-se,"ANTARCTIC CIRCLE"]];n.textAlign="left";for(const[a,r]of o){const[,l]=N(t.size,t.view,0,a);l<s.y+6||l>s.y+s.height-6||(n.save(),n.globalAlpha*=a===0?.8:.5,this.tracked(r,Math.max(s.x,0)+12,l-7,.14,9),n.restore())}n.fillStyle=w[400],n.globalAlpha*=.75,n.textAlign="right";for(let a=-90+e;a<90;a+=e){const[,r]=N(t.size,t.view,0,a);if(r<s.y+8||r>s.y+s.height-8)continue;const l=`${Math.abs(a)}°${a>0?"N":"S"}`;n.fillText(l,Math.min(t.size.width-8,s.x+s.width-8),r)}n.textAlign="center",n.textBaseline="top";for(let a=-180+e;a<180;a+=e){const[r]=N(t.size,t.view,a,0);if(r<24||r>t.size.width-24)continue;const l=a===0?"0°":`${Math.abs(a)}°${a>0?"E":"W"}`;n.fillText(l,r,s.y+7)}n.restore()}drawTwilightBoundaries(t){const{declination:e,subsolarLon:n}=t.sun;for(const s of Gs){const o=ge.smallCircle(e,n,90-s.altitude);this.line(t,o,s.warm?X[300]:w[500],this.hairline*s.weight*this.dpr,s.alpha)}}drawAnalemma(t){if(!t.analemma)return;const e=t.analemma.map(n=>[n.lon,n.lat]);this.line(t,e,X[300],this.hairline*1.2*this.dpr,.35)}drawZoneFills(t){if(t.highlightZones.size===0)return;const{ctx:e}=this,n=t.world.timezones;if(!n.featureStarts)return;e.save(),this.clipToPlate(t),e.fillStyle=X[400],e.globalAlpha*=.1;const s=L(t.size,t.view);for(const o of t.highlightZones){const a=n.featureStarts[o],r=n.featureStarts[o+1];if(!(a===void 0||r===void 0))for(const l of[-s,0,s])e.beginPath(),this.tracePolygons(t,n,a,r,l),e.fill("evenodd")}e.restore()}drawZoneOutlines(t){const{ctx:e}=this,n=t.world.timezones;e.save(),this.clipToPlate(t),e.strokeStyle=w[300],e.lineWidth=this.hairline,e.globalAlpha*=.55;const s=L(t.size,t.view);for(const o of[-s,0,s])e.beginPath(),this.tracePolygons(t,n,0,n.polyStarts.length-1,o),e.stroke();e.restore()}tracePolygons(t,e,n,s,o){const{ctx:a}=this,{coords:r,ringStarts:l,polyStarts:c}=e,h=L(t.size,t.view);for(let u=n;u<s;u++){const d=c[u],m=c[u+1];if(!(d===void 0||m===void 0))for(let f=d;f<m;f++){const g=l[f],x=l[f+1];if(g===void 0||x===void 0||x-g<3)continue;let p=0;for(let y=g;y<x;y++){const[b,v]=N(t.size,t.view,r[y*2],r[y*2+1]);y===g||Math.abs(b-p)>h/2?a.moveTo(b+o,v):a.lineTo(b+o,v),p=b}a.closePath()}}}drawPlateFrame(t){const{ctx:e}=this,n=yt(t.size,t.view);e.save(),e.strokeStyle=w[200],e.globalAlpha*=.9,e.lineWidth=this.hairline,e.beginPath(),e.moveTo(0,Math.round(n.y)+.5/this.dpr),e.lineTo(t.size.width,Math.round(n.y)+.5/this.dpr),e.moveTo(0,Math.round(n.y+n.height)-.5/this.dpr),e.lineTo(t.size.width,Math.round(n.y+n.height)-.5/this.dpr),e.stroke(),e.restore()}drawSubsolar(t){const{ctx:e}=this,{subsolarLon:n,subsolarLat:s}=t.sun,o=L(t.size,t.view),[a,r]=N(t.size,t.view,n,s);for(const h of[-o,0,o]){const u=a+h;if(!(u<-40||u>t.size.width+40)){e.save(),e.translate(u,r),e.strokeStyle=X[500],e.lineWidth=this.hairline*1.4*this.dpr,e.globalAlpha*=.9,e.beginPath(),e.arc(0,0,9,0,Math.PI*2),e.stroke(),e.globalAlpha*=.75,e.beginPath();for(const[d,m]of[[1,0],[-1,0],[0,1],[0,-1]])e.moveTo(d*13,m*13),e.lineTo(d*20,m*20);e.stroke(),e.restore()}}const[l,c]=N(t.size,t.view,n+180,-s);for(const h of[-o,0,o]){const u=l+h;u<-20||u>t.size.width+20||(e.save(),e.strokeStyle=w[400],e.globalAlpha*=.55,e.lineWidth=this.hairline*this.dpr,e.beginPath(),e.arc(u,c,4.5,0,Math.PI*2),e.stroke(),e.restore())}}drawEclipsePath(t,e){const{ctx:n}=this,s=L(t.size,t.view),o=e.type==="annular"?X[600]:X[500];if(n.save(),e.central.length>1){const a=e.central.map(({lon:r,lat:l})=>[r,l]);n.lineCap="round",n.lineJoin="round",this.fillUmbraBand(t,e,o),n.globalAlpha*=.85,n.strokeStyle=w[0],n.lineWidth=4,this.strokeGeoPath(t,a,!1),n.strokeStyle=o,n.lineWidth=1.5,this.strokeGeoPath(t,a,!1),n.lineWidth=this.hairline*this.dpr;for(let r=1;r<e.central.length;r++){const l=e.central[r-1],c=e.central[r];if(Math.floor(l.time/pn)===Math.floor(c.time/pn))continue;const[h,u]=N(t.size,t.view,c.lon,c.lat);for(const d of[-s,0,s]){const m=h+d;m<-20||m>t.size.width+20||(n.beginPath(),n.arc(m,u,2.6,0,Math.PI*2),n.fillStyle=w[0],n.fill(),n.strokeStyle=o,n.stroke())}}}if(e.greatest){const[a,r]=N(t.size,t.view,e.greatest.lon,e.greatest.lat);for(const l of[-s,0,s]){const c=a+l;c<-30||c>t.size.width+30||(n.beginPath(),n.arc(c,r,4,0,Math.PI*2),n.fillStyle=o,n.fill(),n.globalAlpha*=.8,n.lineWidth=this.hairline*1.4*this.dpr,n.strokeStyle=o,n.beginPath(),n.arc(c,r,9.5,0,Math.PI*2),n.stroke())}}n.restore()}fillUmbraBand(t,e,n){const{ctx:s}=this,o=L(t.size,t.view),a=111.32,r=[];for(let l=0;l<e.central.length;l++){const c=e.central[l],h=e.central[Math.min(l+1,e.central.length-1)],u=e.central[Math.max(l-1,0)],d=Math.cos(c.lat*V);let m=((h.lon-u.lon+540)%360-180)*a*d,f=(h.lat-u.lat)*a;const g=Math.hypot(m,f);if(g===0||c.elevation<=.5){r.push(null);continue}m/=g,f/=g;const x=-f,p=m,y=Math.sin(c.azimuth*V),b=Math.cos(c.azimuth*V),v=c.radiusKm/Math.max(.12,Math.sin(c.elevation*V)),E=c.radiusKm,A=x*y+p*b,S=x*-b+p*y,z=Math.sqrt(v*v*A*A+E*E*S*S),P=z*x/(a*d),j=z*p/a;r.push([N(t.size,t.view,c.lon+P,c.lat+j),N(t.size,t.view,c.lon-P,c.lat-j)])}s.save(),s.fillStyle=n,s.globalAlpha*=.28;for(const l of[-o,0,o])if(!(l!==0&&o>=t.size.width*3)){s.beginPath();for(let c=1;c<r.length;c++){const h=r[c-1],u=r[c];!h||!u||Math.abs(u[0][0]-h[0][0])>o/2||(s.moveTo(h[0][0]+l,h[0][1]),s.lineTo(u[0][0]+l,u[0][1]),s.lineTo(u[1][0]+l,u[1][1]),s.lineTo(h[1][0]+l,h[1][1]),s.closePath())}s.fill()}s.restore()}drawLunarVisibility(t,e){const{ctx:n}=this;n.save(),n.strokeStyle=e.inUmbra?w[700]:w[500],n.lineWidth=this.hairline*1.4*this.dpr,n.globalAlpha*=e.inUmbra?.75:.45,n.setLineDash([6,5]),this.strokeGeoPath(t,ge.smallCircle(e.lat,e.lon,90),!0),n.restore()}drawSublunar(t,e){const{ctx:n}=this,s=L(t.size,t.view),[o,a]=N(t.size,t.view,e.lon,e.lat),r=6.5;for(const l of[-s,0,s]){const c=o+l;if(c<-30||c>t.size.width+30)continue;n.save(),n.translate(c,a),n.fillStyle=w[200],n.globalAlpha*=.85,n.beginPath(),n.arc(0,0,r,0,Math.PI*2),n.fill();const h=Math.min(1,Math.max(0,e.illumination)),u=e.waxing;n.fillStyle=e.eclipsed?_s:w[800],n.beginPath();const d=u?-Math.PI/2:Math.PI/2;n.arc(0,0,r,d,d+Math.PI,!1),n.ellipse(0,0,r*Math.abs(2*h-1),r,0,d+Math.PI,d,h<.5),n.fill(),n.strokeStyle=w[400],n.globalAlpha*=.7,n.lineWidth=this.hairline*this.dpr,n.beginPath(),n.arc(0,0,r,0,Math.PI*2),n.stroke(),n.restore()}}tracked(t,e,n,s,o){const{ctx:a}=this,r=o*s,l=a;if(typeof l.letterSpacing=="string"){const h=l.letterSpacing;l.letterSpacing=`${r}px`,a.fillText(t,e,n),l.letterSpacing=h;return}let c=e;for(const h of t)a.fillText(h,c,n),c+=a.measureText(h).width+r}groundLightness(t,e,n,s){const o=t.sun.declination*V,a=(e-t.sun.subsolarLon)*V,r=n*V,l=Math.sin(r)*Math.sin(o)+Math.cos(r)*Math.cos(o)*Math.cos(a),c=Math.asin(Math.max(-1,Math.min(1,l)))/V,h=le(s?"land":"ocean",c);return pe(h[0],h[1],h[2])[0]}reserve(t){for(const e of this.occupied)if(t.x<e.x+e.w&&t.x+t.w>e.x&&t.y<e.y+e.h&&t.y+t.h>e.y)return!1;return this.occupied.push(t),!0}haloedText(t,e,n,s,o,a="left"){const{ctx:r}=this;r.textAlign=a;const l=Math.max(0,Math.min(1,(.5-o)/.38))*.62;l>.02&&(r.save(),r.globalAlpha*=l,r.lineWidth=2.5,r.lineJoin="round",r.strokeStyle=w[50],r.strokeText(t,e,n),r.restore()),r.fillStyle=s,r.fillText(t,e,n)}drawZoneLabels(t){const{ctx:e}=this,n=yt(t.size,t.view),s=L(t.size,t.view),o=[...t.zoneLabels].sort((a,r)=>r.area-a.area);e.save(),e.textBaseline="middle";for(const a of o){const[r,l]=N(t.size,t.view,a.lon,a.lat);for(const c of[-s,0,s]){const h=r+c;if(h<Math.max(30,n.x+26)||h>Math.min(t.size.width-30,n.x+n.width-26)||l<n.y+14||l>n.y+n.height-14)continue;const u={x:h-26,y:l-13,w:52,h:26};if(!this.reserve(u))continue;const d=this.groundLightness(t,a.lon,a.lat,!0);e.font=`500 12px ${Ws}`,this.haloedText(a.text,h,l-4,a.highlighted?X[400]:w[600],d,"center"),e.font=`500 8px ${Ae}`,e.globalAlpha*=.8,this.haloedText(a.sub,h,l+7,w[400],d,"center"),e.globalAlpha/=.8}}e.restore()}drawPlaceLabels(t){const{ctx:e}=this,n=yt(t.size,t.view),s=L(t.size,t.view);e.save(),e.textBaseline="middle",e.font=`400 11px ${Ae}`;for(const o of t.placeLabels){const[a,r]=N(t.size,t.view,o.lon,o.lat);for(const l of[-s,0,s]){const c=a+l;if(c<Math.max(4,n.x)||c>Math.min(t.size.width-4,n.x+n.width)||r<n.y+8||r>n.y+n.height-8)continue;const h=e.measureText(o.text).width;if(!this.reserve({x:c+4,y:r-8,w:h+10,h:16}))continue;const u=this.groundLightness(t,o.lon,o.lat,!0);e.save(),e.globalAlpha*=.9,e.fillStyle=w[600],e.beginPath(),e.arc(c,r,o.capital?1.9:1.4,0,Math.PI*2),e.fill(),this.haloedText(o.text,c+6,r,o.capital?w[700]:w[500],u),e.restore()}}e.restore()}drawPin(t,e){const{ctx:n}=this,s=L(t.size,t.view),[o,a]=N(t.size,t.view,e.lon,e.lat);for(const r of[-s,0,s]){const l=o+r;l<-20||l>t.size.width+20||(n.save(),n.strokeStyle=X[400],n.lineWidth=this.hairline*1.4*this.dpr,n.beginPath(),n.arc(l,a,5.5,0,Math.PI*2),n.moveTo(l-11,a),n.lineTo(l-7,a),n.moveTo(l+7,a),n.lineTo(l+11,a),n.moveTo(l,a-11),n.lineTo(l,a-7),n.moveTo(l,a+7),n.lineTo(l,a+11),n.stroke(),n.restore())}}drawHover(t,e){const{ctx:n}=this,s=yt(t.size,t.view),[o,a]=N(t.size,t.view,e.lon,e.lat);n.save(),n.strokeStyle=w[500],n.globalAlpha*=.45,n.lineWidth=this.hairline,n.setLineDash([2/this.dpr,3/this.dpr]),n.beginPath(),n.moveTo(0,a),n.lineTo(t.size.width,a),n.moveTo(o,s.y),n.lineTo(o,s.y+s.height),n.stroke(),n.setLineDash([]),n.globalAlpha=1,n.strokeStyle=w[700],n.lineWidth=this.hairline*1.5*this.dpr,n.beginPath(),n.arc(o,a,3.5,0,Math.PI*2),n.stroke(),n.restore()}}const Ae='"Archivo", system-ui, sans-serif',Ws='"Martian Mono", ui-monospace, monospace',U=6e4,G=36e5,T=864e5,je=Math.PI/180,be=180/Math.PI,B=i=>Math.sin(i*je),Z=i=>Math.cos(i*je),Je=i=>Math.tan(i*je),Qe=i=>Math.asin(tn(i,-1,1))*be;function tn(i,t,e){return i<t?t:i>e?e:i}function D(i){const t=i%360;return t<0?t+360:t}function pt(i){const t=D(i);return t>180?t-360:t}function en(i){return i/T+24405875e-1}function Zs(i){return(i-24405875e-1)*T}function nn(i){return(i-2451545)/36525}function O(i){const t=typeof i=="number"?i:i.getTime(),e=en(t),n=nn(e),s=D(280.46646+n*(36000.76983+n*3032e-7)),o=357.52911+n*(35999.05029-1537e-7*n),a=.016708634-n*(42037e-9+1267e-10*n),r=B(o)*(1.914602-n*(.004817+14e-6*n))+B(2*o)*(.019993-101e-6*n)+B(3*o)*289e-6,l=s+r,c=o+r,h=1.000001018*(1-a*a)/(1+a*Z(c)),u=125.04-1934.136*n,d=l-.00569-.00478*B(u),f=23+(26+(21.448-n*(46.815+n*(59e-5-n*.001813)))/60)/60+.00256*Z(u),g=Qe(B(f)*B(d)),x=D(Math.atan2(Z(f)*B(d),Z(d))*be),p=Je(f/2)**2,y=4*be*(p*B(2*s)-2*a*B(o)+4*a*p*B(o)*Z(2*s)-.5*p*p*B(4*s)-1.25*a*a*B(2*o)),b=(t%T+T)%T/U,v=pt(180-b/4-y/4);return{time:t,century:n,declination:g,equationOfTime:y,subsolarLon:v,subsolarLat:g,rightAscension:x,apparentLongitude:D(d),distanceAu:h,angularRadius:.266563888/h}}function he(i,t,e){const n=pt(t-e.subsolarLon),s=B(i)*B(e.declination)+Z(i)*Z(e.declination)*Z(n);return Qe(s)}function Os(i){if(i>85)return 0;const t=Je(i);let e;return i>5?e=58.1/t-.07/t**3+86e-6/t**5:i>-.575?e=1735+i*(-518.2+i*(103.4+i*(-12.79+i*.711))):e=-20.772/t,e/3600}function zt(i,t,e){const n=pt(t-e.subsolarLon),s=e.declination,o=B(i)*B(s)+Z(i)*Z(s)*Z(n),a=Qe(o),r=D(Math.atan2(B(n),Z(n)*B(i)-Je(s)*Z(i))*be+180);return{elevation:a,apparentElevation:a+Os(a),azimuth:r,hourAngle:n,trueSolarTime:D(n+180)/15}}const H={golden:6,sunrise:-.833,civil:-6,nautical:-12,astronomical:-18},$s=10;function gn(i,t){let e=720-4*i;for(let n=0;n<2;n++){const s=O(t+e*U).equationOfTime;e=720-4*i-s}return e}function vt(i,t,e){const n=typeof e=="number"?e:e.getTime();let s=Math.floor(n/T)*T,o=gn(t,s);const a=Math.round((n-(s+o*U))/T);a!==0&&(s+=a*T,o=gn(t,s));const r=s+o*U,l=r-T/2,c=$s*U,h=Math.round(T/c)+1,u=new Float64Array(h);for(let E=0;E<h;E++)u[E]=he(i,t,O(l+E*c));const d=E=>he(i,t,O(E)),m=(E,A,S)=>{let z=d(E)<S;for(let P=0;P<18;P++){const j=(E+A)/2;d(j)<S===z?E=j:A=j}return Math.round((E+A)/2)},f=(E,A)=>{for(let S=0;S+1<h;S++){const z=u[S]-E,P=u[S+1]-E;if(z<0!=P<0&&P>z===A)return m(l+S*c,l+(S+1)*c,E)}return null};let g=-1/0,x=1/0;for(let E=0;E<h;E++){const A=u[E];A>g&&(g=A),A<x&&(x=A)}g=Math.max(g,he(i,t,O(r)));const p=f(H.sunrise,!0),y=f(H.sunrise,!1),b=p===null&&y===null?g>H.sunrise?"day":"night":null;let v;return p!==null&&y!==null?v=y-p:p!==null?v=l+T-p:y!==null?v=y-l:v=b==="day"?T:0,{dayStart:s,solarNoon:r,goldenMorning:f(H.golden,!0),goldenEvening:f(H.golden,!1),sunrise:p,sunset:y,civilDawn:f(H.civil,!0),civilDusk:f(H.civil,!1),nauticalDawn:f(H.nautical,!0),nauticalDusk:f(H.nautical,!1),astronomicalDawn:f(H.astronomical,!0),astronomicalDusk:f(H.astronomical,!1),dayLength:v,polar:b,maxElevation:g,minElevation:x}}function Xs(i,t=12,e=365){const n=Date.UTC(i,0,1,0,0,0),o=Date.UTC(i+1,0,1,0,0,0)-n,a=[];for(let r=0;r<e;r++){const c=n+Math.round(r/e*(o/T))*T+t*G,h=O(c);a.push({lon:h.subsolarLon,lat:h.subsolarLat,time:c})}return a}const Zn=69.1,Vs={0:[245162380984e-5,365242.37404,.05169,-.00411,-57e-5],90:[245171656767e-5,365241.62603,.00325,.00888,-3e-4],180:[245181021715e-5,365242.01767,-.11575,.00337,78e-5],270:[245190005952e-5,365242.74049,-.06223,-.00823,32e-5]},oe=[485,324.96,1934.136,203,337.23,32964.467,199,342.08,20.186,182,27.85,445267.112,156,73.14,45036.886,136,171.52,22518.443,77,222.54,65928.934,74,296.72,3034.906,70,243.58,9037.513,58,119.81,33718.147,52,297.17,150.678,50,21.02,2281.226,45,247.54,29929.562,44,325.15,31555.956,29,60.93,4443.417,18,155.12,67555.328,17,288.79,4562.452,16,198.04,62894.029,14,199.76,31436.921,12,95.39,14577.848,12,287.11,31931.756,12,320.81,34777.259,9,227.73,1222.114,8,15.45,16859.074];function $t(i,t){const e=(i-2e3)/1e3,n=Vs[t];let s=0;for(let h=0;h<n.length;h++)s+=n[h]*Math.pow(e,h);const o=(s-2451545)/36525,a=35999.373*o-2.47,r=1+.0334*Z(a)+7e-4*Z(2*a);let l=0;for(let h=0;h<oe.length;h+=3)l+=oe[h]*Z(oe[h+1]+oe[h+2]*o);const c=s+1e-5*l/r;return Math.round(Zs(c)-Zn*1e3)}const qt=Math.PI/180,jt=180/Math.PI,R=i=>Math.sin(i*qt),W=i=>Math.cos(i*qt),ue=i=>Math.asin(tn(i,-1,1))*jt,Ys=i=>Math.acos(tn(i,-1,1))*jt,nt=[0,0,1,0,6288774,-20905355,2,0,-1,0,1274027,-3699111,2,0,0,0,658314,-2955968,0,0,2,0,213618,-569925,0,1,0,0,-185116,48888,0,0,0,2,-114332,-3149,2,0,-2,0,58793,246158,2,-1,-1,0,57066,-152138,2,0,1,0,53322,-170733,2,-1,0,0,45758,-204586,0,1,-1,0,-40923,-129620,1,0,0,0,-34720,108743,0,1,1,0,-30383,104755,2,0,0,-2,15327,10321,0,0,1,2,-12528,0,0,0,1,-2,10980,79661,4,0,-1,0,10675,-34782,0,0,3,0,10034,-23210,4,0,-2,0,8548,-21636,2,1,-1,0,-7888,24208,2,1,0,0,-6766,30824,1,0,-1,0,-5163,-8379,1,1,0,0,4987,-16675,2,-1,1,0,4036,-12831,2,0,2,0,3994,-10445,4,0,0,0,3861,-11650,2,0,-3,0,3665,14403,0,1,-2,0,-2689,-7003,2,0,-1,2,-2602,0,2,-1,-2,0,2390,10056,1,0,1,0,-2348,6322,2,-2,0,0,2236,-9884,0,1,2,0,-2120,5751,0,2,0,0,-2069,0,2,-2,-1,0,2048,-4950,2,0,1,-2,-1773,4130,2,0,0,2,-1595,0,4,-1,-1,0,1215,-3958,0,0,2,2,-1110,0,3,0,-1,0,-892,3258,2,1,1,0,-810,2616,4,-1,-2,0,759,-1897,0,2,-1,0,-713,-2117,2,2,-1,0,-700,2354,2,1,-2,0,691,0,2,-1,0,-2,596,0,4,0,1,0,549,-1423,0,0,4,0,537,-1117,4,-1,0,0,520,-1571,1,0,-2,0,-487,-1739,2,1,0,-2,-399,0,0,0,2,-2,-381,-4421,1,1,1,0,351,0,3,0,-2,0,-340,0,4,0,-3,0,330,0,2,-1,2,0,327,0,0,2,1,0,-323,1165,1,1,-1,0,299,0,2,0,3,0,294,0,2,0,-1,-2,0,8752],ut=[0,0,0,1,5128122,0,0,1,1,280602,0,0,1,-1,277693,2,0,0,-1,173237,2,0,-1,1,55413,2,0,-1,-1,46271,2,0,0,1,32573,0,0,2,1,17198,2,0,1,-1,9266,0,0,2,-1,8822,2,-1,0,-1,8216,2,0,-2,-1,4324,2,0,1,1,4200,2,1,0,-1,-3359,2,-1,-1,1,2463,2,-1,0,1,2211,2,-1,-1,-1,2065,0,1,-1,-1,-1870,4,0,-1,-1,1828,0,1,0,1,-1794,0,0,0,3,-1749,0,1,-1,1,-1565,1,0,0,1,-1491,0,1,1,1,-1475,0,1,1,-1,-1410,0,1,0,-1,-1344,1,0,0,-1,-1335,0,0,3,1,1107,4,0,0,-1,1021,4,0,-1,1,833,0,0,1,-3,777,4,0,-2,1,671,2,0,0,-3,607,2,0,2,-1,596,2,-1,1,-1,491,2,0,-2,1,-451,0,0,3,-1,439,2,0,2,1,422,2,0,-3,-1,421,2,1,-1,1,-366,2,1,0,1,-351,4,0,0,1,331,2,-1,1,1,315,2,-2,0,-1,302,0,0,1,3,-283,2,1,1,-1,-229,1,1,0,-1,223,1,1,0,1,223,0,1,-2,-1,-220,2,1,-1,-1,-220,1,0,1,1,-185,2,-1,-2,-1,181,0,1,2,1,-177,4,0,-2,-1,176,4,-1,-1,-1,166,1,0,1,-1,-164,4,0,1,-1,132,1,0,-1,-1,-119,4,-1,0,-1,115,2,-2,0,1,107],bn=6378.14;function Jt(i){const t=en(i),e=nn(t);return D(280.46061837+360.98564736629*(t-2451545)+e*e*(387933e-9-e/3871e4))}function ft(i){const t=typeof i=="number"?i:i.getTime(),e=nn(en(t+Zn*1e3)),n=D(218.3164477+e*(481267.88123421-e*(.0015786-e*(1/538841-e/65194e3)))),s=D(297.8501921+e*(445267.1114034-e*(.0018819-e*(1/545868-e/113065e3)))),o=D(357.5291092+e*(35999.0502909-e*(1536e-7-e/2449e4))),a=D(134.9633964+e*(477198.8675055+e*(.0087414+e*(1/69699-e/14712e3)))),r=D(93.272095+e*(483202.0175233-e*(.0036539+e*(1/3526e3-e/86331e4)))),l=D(119.75+131.849*e),c=D(53.09+479264.29*e),h=D(313.45+481266.484*e),u=1-e*(.002516+74e-7*e),d=u*u;let m=0,f=0;for(let C=0;C<nt.length;C+=6){const rt=nt[C]*s+nt[C+1]*o+nt[C+2]*a+nt[C+3]*r,lt=nt[C+1]===0?1:Math.abs(nt[C+1])===1?u:d;m+=nt[C+4]*R(rt)*lt,f+=nt[C+5]*W(rt)*lt}let g=0;for(let C=0;C<ut.length;C+=5){const rt=ut[C]*s+ut[C+1]*o+ut[C+2]*a+ut[C+3]*r,lt=ut[C+1]===0?1:Math.abs(ut[C+1])===1?u:d;g+=ut[C+4]*R(rt)*lt}m+=3958*R(l)+1962*R(n-r)+318*R(c),g+=-2235*R(n)+382*R(h)+175*R(l-r)+175*R(l+r)+127*R(n-a)-115*R(n+a);const x=n+m/1e6,p=g/1e6,y=385000.56+f/1e3,b=125.04452-1934.136261*e,v=-17.2*R(b)/3600,E=x+v,S=23+(26+(21.448-e*(46.815+e*(59e-5-e*.001813)))/60)/60+9.2*W(b)/3600,z=D(Math.atan2(R(E)*W(S)-Math.tan(p*qt)*R(S),W(E))*jt),P=ue(R(p)*W(S)+W(p)*R(S)*R(E)),j=ue(bn/y);return{time:t,apparentLongitude:E,eclipticLatitude:p,rightAscension:z,declination:P,distanceKm:y,parallax:j,angularRadius:ue(.2725*bn/y),sublunarLon:pt(z-Jt(t)),sublunarLat:P}}function sn(i,t,e){const n=pt(t-e.sublunarLon);return ue(R(i)*R(e.declination)+W(i)*W(e.declination)*W(n))}function Ce(i,t,e){const n=pt(t-e.sublunarLon),s=e.declination;return{elevation:sn(i,t,e),azimuth:D(Math.atan2(R(n),W(n)*R(i)-Math.tan(s*qt)*W(i))*jt+180)}}const Hs=29.530588853;function On(i,t){const e=Ys(R(i.declination)*R(t.declination)+W(i.declination)*W(t.declination)*W(i.rightAscension-t.rightAscension)),n=i.distanceAu*1495978707e-1,s=D(Math.atan2(n*R(e),t.distanceKm-n*W(e))*jt),o=(1+W(s))/2,a=D(t.apparentLongitude-i.apparentLongitude),r=a<180;let l="New moon";return a>=348.75||a<11.25?l="New moon":a<78.75?l="Waxing crescent":a<101.25?l="First quarter":a<168.75?l="Waxing gibbous":a<191.25?l="Full moon":a<258.75?l="Waning gibbous":a<281.25?l="Last quarter":l="Waning crescent",{age:a,illumination:o,phaseAngle:s,waxing:r,name:l,ageDays:a/360*Hs}}const Ks=10;function qs(i,t,e){const n=typeof e=="number"?e:e.getTime(),s=Math.floor(n/T)*T,o=Ks*U,a=Math.round(T/o)+1,r=f=>.7275*f.parallax-.5667,l=f=>{const g=ft(f);return sn(i,t,g)-r(g)},c=new Float64Array(a);for(let f=0;f<a;f++)c[f]=l(s+f*o);const h=(f,g)=>{let x=f,p=g;for(let y=0;y<40;y++){const b=(x+p)/2;l(x)*l(b)<=0?p=b:x=b}return(x+p)/2};let u=null,d=null;for(let f=0;f+1<a;f++){const g=c[f],x=c[f+1];if(g===0||g*x>0)continue;const p=h(s+f*o,s+(f+1)*o);g<0&&u===null&&(u=p),g>0&&d===null&&(d=p)}const m=u===null&&d===null?c[0]>0?"up":"down":null;return{moonrise:u,moonset:d,circumstance:m}}function js(i,t,e){const n=Math.exp(-3.05*(1-t.illumination)**.9),s=Math.sin(i*qt),o=(385000.56/e)**2;return n*s*o}const Dt=Math.PI/180,_e=180/Math.PI,F=6378.14,q=1737.4,St=696e3,Js=1495978707e-1,ot=(i,t)=>i[0]*t[0]+i[1]*t[1]+i[2]*t[2],$=i=>Math.sqrt(ot(i,i)),it=(i,t)=>[i[0]-t[0],i[1]-t[1],i[2]-t[2]],wt=(i,t)=>[i[0]*t,i[1]*t,i[2]*t],At=i=>wt(i,1/$(i));function yn(i,t,e){const n=i*Dt,s=t*Dt;return[e*Math.cos(s)*Math.cos(n),e*Math.cos(s)*Math.sin(n),e*Math.sin(s)]}function mt(i){const t=O(i),e=ft(i);return{time:i,sun:yn(t.rightAscension,t.declination,t.distanceAu*Js),moon:yn(e.rightAscension,e.declination,e.distanceKm),sunState:t,moonState:e}}function Qs(i,t,e){const n=(Jt(i.time)+t)*Dt,s=e*Dt,o=[F*Math.cos(s)*Math.cos(n),F*Math.cos(s)*Math.sin(n),F*Math.sin(s)],a=it(i.sun,o),r=it(i.moon,o),l=$(a),c=$(r);if(ot(o,a)<=0)return 0;const h=Math.acos(Math.min(1,Math.max(-1,ot(a,r)/(l*c)))),u=Math.asin(St/l),d=Math.asin(q/c);if(h>=u+d)return 0;if(h<=d-u)return 1;if(h<=u-d)return d*d/(u*u);const m=h,f=u,g=d,x=Math.acos((m*m+f*f-g*g)/(2*m*f)),p=Math.acos((m*m+g*g-f*f)/(2*m*g));return(f*f*(x-Math.sin(2*x)/2)+g*g*(p-Math.sin(2*p)/2))/(Math.PI*f*f)}function We(i){const t=At(it(i.moon,i.sun)),e=-ot(i.moon,t),n=[i.moon[0]+t[0]*e,i.moon[1]+t[1]*e,i.moon[2]+t[2]*e],s=$(n),o=s/F;let a=null;if(s<F){const r=Math.sqrt(F*F-s*s);a=[n[0]-t[0]*r,n[1]-t[1]*r,n[2]-t[2]*r]}return{gamma:o,hit:a,nearest:n}}function $n(i,t){const e=Math.asin(t[2]/$(t))*_e,n=Math.atan2(t[1],t[0])*_e;return{lon:pt(n-Jt(i)),lat:e}}function Xn(i,t,e,n=34){let o=t,a=1/0;for(let l=0;l<=12;l++){const c=t+(e-t)*l/12,h=i(c);h<a&&(a=h,o=c)}const r=(e-t)/12;return Vn(i,o-r,o+r,n)}function Vn(i,t,e,n){const s=(Math.sqrt(5)-1)/2;let o=t,a=e,r=a-(a-o)*s,l=o+(a-o)*s;for(let c=0;c<n;c++)i(r)<i(l)?a=l:o=r,r=a-(a-o)*s,l=o+(a-o)*s;return(o+a)/2}function Yn(i){const e=Xn(b=>We(mt(b)).gamma,i-18*G,i+18*G),n=mt(e),{gamma:s,hit:o,nearest:a}=We(n),r=o??wt(At(a),F),l=$n(e,r),c=(Jt(e)+l.lon)*Dt,h=l.lat*Dt,u=[F*Math.cos(h)*Math.cos(c),F*Math.cos(h)*Math.sin(c),F*Math.sin(h)],d=it(n.sun,u),m=it(n.moon,u),f=Math.asin(St/$(d)),g=Math.asin(q/$(m)),x=Math.acos(Math.min(1,Math.max(-1,ot(d,m)/($(d)*$(m)))));let p,y;return o?(y=g>=f?"total":"annular",p=g/f):(y="partial",p=(f+g-x)/(2*f)),{kind:"solar",time:e,gamma:s,magnitude:p,type:y,greatest:l}}function to(i){const t=d=>{const m=mt(d),f=At(wt(m.sun,-1)),g=ot(m.moon,f),x=it(m.moon,wt(f,g));return $(x)},e=Xn(t,i-18*G,i+18*G),n=mt(e),s=At(wt(n.sun,-1)),o=ot(n.moon,s),a=t(e),r=$(n.sun),l=1.02*(F-o*(St-F)/r),c=1.02*(F+o*(St+F)/r),h=(l+q-a)/(2*q);let u="penumbral";return a+q<=l?u="total":a-q<l?u="partial":a-q>=c&&(u="penumbral"),{kind:"lunar",time:e,gamma:a/F,magnitude:h,type:u}}function eo(i,t,e=100,n=()=>!0){const s=730.5*T,o=i+e*365.25*T,a=[];for(let r=i;r<o&&a.length<t;r+=s)a.push(...so(r,Math.min(r+s,o)).filter(n));return a.slice(0,t)}function no(i){return i.kind==="solar"?i.type!=="partial":i.type==="total"}function so(i,t){const e=T/2,n=[],s=a=>{const r=O(a),l=ft(a);return pt(l.apparentLongitude-r.apparentLongitude)};let o=s(i);for(let a=i+e;a<=t;a+=e){const r=s(a);if(o<0&&r>=0){const l=Yn(a);l.gamma<1.55&&l.magnitude>0&&n.push(l)}if(o>90&&r<-90){const l=to(a);(l.type!=="penumbral"||l.magnitude>-.5)&&n.push(l)}o=r}return n}function oo(i,t=3){const e=Yn(i),n=[],s=t*U;for(let o=e.time-4*G;o<=e.time+4*G;o+=s){const a=mt(o),{hit:r}=We(a);if(!r)continue;const l=$n(o,r),c=$(it(r,a.moon)),h=q-c*(St-q)/$(it(a.sun,a.moon)),u=zt(l.lat,l.lon,a.sunState);n.push({...l,time:o,radiusKm:Math.abs(h),elevation:u.elevation,azimuth:u.azimuth})}return{central:n,greatest:e.greatest,type:e.type,time:e.time}}function io(i,t,e){const n=l=>Qs(mt(l),t,e);let s=i.time,o=0;const a=6*U;for(let l=i.time-4*G;l<=i.time+4*G;l+=a){const c=n(l);c>o&&(o=c,s=l)}if(o===0)return{obscuration:0,peak:s};const r=Vn(l=>-n(l),s-a,s+a,24);return{obscuration:n(r),peak:r}}function ao(i,t,e){const n=r=>sn(e,t,ft(r)),s=n(i.time),o=s>-.5,a=!o&&(n(i.time-1.5*G)>-.5||n(i.time+1.5*G)>-.5);return{elevation:s,visible:o,partly:a}}function vn(i){const t=mt(i),e=At(wt(t.sun,-1)),n=ot(t.moon,e);if(n<=0)return null;const s=$(it(t.moon,wt(e,n))),o=$(t.sun),a=1.02*(F-n*(St-F)/o),r=1.02*(F+n*(St+F)/o);return s-q>=r?null:{lon:t.moonState.sublunarLon,lat:t.moonState.sublunarLat,inUmbra:s-q<a}}function ro(i){const t=mt(i),e=Math.acos(Math.min(1,Math.max(-1,ot(At(t.sun),At(t.moon)))))*_e;return{sun:t.sun,moon:t.moon,siderealDegrees:Jt(i),possible:e<2}}function lo(i){return i.kind==="solar"?`${i.type[0].toUpperCase()+i.type.slice(1)} solar`:`${i.type[0].toUpperCase()+i.type.slice(1)} lunar`}const Zt=6e4,xn=new Map;function co(i){let t=xn.get(i);return t||(t=new Intl.DateTimeFormat("en-US",{timeZone:i,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}),xn.set(i,t)),t}function Ot(i){try{return new Intl.DateTimeFormat("en-US",{timeZone:i}),!0}catch{return!1}}function Hn(i,t){const e=co(i).formatToParts(new Date(t)),n=s=>{for(const o of e)if(o.type===s)return Number(o.value);return 0};return{year:n("year"),month:n("month"),day:n("day"),hour:n("hour")%24,minute:n("minute"),second:n("second")}}function tt(i,t){const e=Hn(i,t),n=Date.UTC(e.year,e.month-1,e.day,e.hour,e.minute,e.second);return Math.round((n-Math.floor(t/1e3)*1e3)/Zt)}function It(i,t){const e=Date.UTC(t.year,t.month-1,t.day,t.hour,t.minute,t.second),n=tt(i,e-720*Zt),s=tt(i,e+720*Zt),o=e-n*Zt,a=e-s*Zt,r=tt(i,o)===n,l=tt(i,a)===s;return r&&l?Math.min(o,a):r?o:l?a:Math.max(o,a)}function ho(i,t){try{const e=new Intl.DateTimeFormat("en-US",{timeZone:i,timeZoneName:"short"}).formatToParts(new Date(t));for(const n of e)if(n.type==="timeZoneName")return n.value}catch{}return uo(tt(i,t))}function uo(i){const t=i<0?"-":"+",e=Math.abs(i),n=Math.floor(e/60),s=e%60;return`${t}${String(n).padStart(2,"0")}:${String(s).padStart(2,"0")}`}let ie=null;function fo(){if(ie)return ie;const i=Intl.supportedValuesOf;let t;if(typeof i=="function")try{t=i.call(Intl,"timeZone")}catch{t=Tn.slice()}else t=Tn.slice();return t.includes("UTC")||(t=["UTC",...t]),ie=t.sort((e,n)=>e.localeCompare(n)),ie}function wn(){try{const i=Intl.DateTimeFormat().resolvedOptions().timeZone;if(i&&Ot(i))return i}catch{}return"UTC"}const Tn=["UTC","Europe/London","Europe/Oslo","Europe/Moscow","Africa/Lagos","Asia/Dubai","Asia/Kolkata","Asia/Shanghai","Asia/Tokyo","Australia/Sydney","Pacific/Auckland","America/Sao_Paulo","America/New_York","America/Chicago","America/Denver","America/Los_Angeles","Pacific/Honolulu"],mo=""+new URL("terrain-C589T1J4.webp",import.meta.url).href,po=""+new URL("terrain-season-CDPpnhPg.webp",import.meta.url).href,go=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"],bo=["SUN","MON","TUE","WED","THU","FRI","SAT"],Tt=(i,t=2)=>String(Math.floor(Math.abs(i))).padStart(t,"0"),on="−";function yo(i,t=1){const e=i.toFixed(t);return e.startsWith("-")?on+e.slice(1):e}function M(i,t){const e=Hn(i,t),n=t+tt(i,t)*U;return{...e,weekday:new Date(n).getUTCDay()}}function kt(i,t=!0){const e=`${Tt(i.hour)}:${Tt(i.minute)}`;return t?`${e}:${Tt(i.second)}`:e}function de(i){return`${Tt(i.day)} ${go[i.month-1]} ${i.year}`}function En(i){return bo[i.weekday]??""}function Ze(i){return`${Math.abs(i).toFixed(2)}° ${i>=0?"N":"S"}`}function Oe(i){return`${Math.abs(i).toFixed(2)}° ${i>=0?"E":"W"}`}function xt(i){return`${yo(i,1)}°`}function $e(i){const t=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"],e=Math.round(i%360/360*16)%16;return`${i.toFixed(1)}° ${t[e]}`}function Xe(i){const t=Math.floor(i/G),e=Math.round((i-t*G)/U);return e===60?`${t+1}h 00m`:`${t}h ${Tt(e)}m`}function et(i,t){if(t===null)return"——:——".slice(0,5);const e=M(i,t);return kt(e,!1)}function Me(i,t){const e=tt(i,t),n=e<0?on:"+",s=Math.abs(e),o=`UTC${n}${Tt(s/60)}:${Tt(s%60)}`;return{abbreviation:ho(i,t),offset:o}}function Ve(i){if(i==="UTC")return"Coordinated Universal Time";const t=i.split("/"),e=(t[t.length-1]??i).replace(/_/g," "),n=t.length>1?(t[0]??"").replace(/_/g," "):"";return n?`${e}, ${n}`:e}const vo="#8e9398";class Sn{constructor(t){this.options=t,this.value=t.min,this.element=document.createElement("div"),this.element.className="scrubber",this.track=document.createElement("canvas"),this.track.className="scrubber-track",this.track.style.height=`${t.height}px`;const e=this.track.getContext("2d");if(!e)throw new Error("could not get a 2D context for the scrubber track");this.ctx=e,this.handle=document.createElement("div"),this.handle.className="scrubber-handle";const n=document.createElement("div");n.className="scrubber-surface",n.tabIndex=0,n.setAttribute("role","slider"),n.setAttribute("aria-label",t.label),n.setAttribute("aria-valuemin",String(t.min)),n.setAttribute("aria-valuemax",String(t.max)),n.append(this.track,this.handle),this.element.append(n),this.surface=n,n.addEventListener("pointerdown",this.onPointerDown),n.addEventListener("pointermove",this.onPointerMove),n.addEventListener("pointerup",this.onPointerUp),n.addEventListener("pointercancel",this.onPointerUp),n.addEventListener("keydown",this.onKeyDown)}element;track;ctx;handle;value;dpr=1;width=0;dragging=!1;surface;valueAt(t){const e=this.surface.getBoundingClientRect(),n=e.width>0?(t-e.left)/e.width:0,{min:s,max:o}=this.options;return s+Math.min(1,Math.max(0,n))*(o-s)}onPointerDown=t=>{t.button===0&&(this.dragging=!0,this.surface.setPointerCapture(t.pointerId),this.surface.focus({preventScroll:!0}),this.set(this.valueAt(t.clientX),!1),t.preventDefault())};onPointerMove=t=>{this.dragging&&this.set(this.valueAt(t.clientX),!1)};onPointerUp=t=>{this.dragging&&(this.dragging=!1,this.surface.hasPointerCapture(t.pointerId)&&this.surface.releasePointerCapture(t.pointerId),this.set(this.value,!0))};onKeyDown=t=>{const{step:e,pageStep:n,min:s,max:o}=this.options;let a=null;switch(t.key){case"ArrowLeft":case"ArrowDown":a=this.value-(t.shiftKey?n:e);break;case"ArrowRight":case"ArrowUp":a=this.value+(t.shiftKey?n:e);break;case"PageDown":a=this.value-n;break;case"PageUp":a=this.value+n;break;case"Home":a=s;break;case"End":a=o;break;default:return}t.preventDefault(),this.set(Math.min(o,Math.max(s,a)),!0)};set(t,e){this.value=t,this.layout(),this.options.onChange(t,e)}setValue(t){this.value=t,this.layout()}layout(){const{min:t,max:e}=this.options,n=e>t?(this.value-t)/(e-t):0;this.handle.style.left=`${(n*100).toFixed(4)}%`,this.surface.setAttribute("aria-valuenow",String(Math.round(this.value))),this.surface.setAttribute("aria-valuetext",this.options.describe(this.value))}resize(t){const e=this.surface.getBoundingClientRect();e.width<1||(this.dpr=t,this.width=e.width,this.track.width=Math.round(e.width*t),this.track.height=Math.round(this.options.height*t),this.track.style.width="100%",this.repaint())}repaint(){if(this.width<1)return;const{ctx:t}=this,e=this.options.height;t.setTransform(this.dpr,0,0,this.dpr,0,0),t.clearRect(0,0,this.width,e),this.options.paint(t,this.width,e);const n=this.options.ticks?.()??[],{min:s,max:o}=this.options;t.save();for(const a of n){const r=(a.at-s)/(o-s);if(r<0||r>1)continue;const l=Math.round(r*this.width)+.5/this.dpr;t.strokeStyle=vo,t.globalAlpha=.2+.55*a.weight,t.lineWidth=1/this.dpr,t.beginPath(),t.moveTo(l,e*(1-a.weight)),t.lineTo(l,e),t.stroke()}t.restore(),this.layout()}}const xo=100,An=8,Cn=40,wo=132,To=128,Gt=-24,ae=3;class Eo{element;sunList;moonList;title;chart;sky;skyCache=null;chartCaption;eclipseList;eclipses=null;eclipseSpan={from:0,count:0,exhausted:!1};eclipseWanted=An;growing=!1;onlyVisible=!1;circumstances=new Map;onRefresh=null;onJump=null;describePoint=null;ctx;dpr=1;lastKey="";chartCache=null;constructor(){this.element=document.createElement("div"),this.element.className="panel almanac",this.element.innerHTML=`
      <button type="button" class="panel-close" data-almanac-close aria-label="Close the almanac">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11"/></svg>
      </button>
      <p class="micro panel-title">Almanac</p>
      <p class="almanac-place" data-almanac-title>—</p>
      <div class="almanac-columns">
        <div>
          <p class="micro almanac-heading">Sun</p>
          <dl class="almanac-rows" data-almanac-sun></dl>
        </div>
        <div>
          <p class="micro almanac-heading">Moon</p>
          <dl class="almanac-rows" data-almanac-moon></dl>
        </div>
      </div>
      <p class="micro almanac-heading almanac-heading-spaced">The sky today</p>
      <canvas class="almanac-chart almanac-sky" data-almanac-sky></canvas>
      <p class="almanac-caption micro">Where the Sun and Moon stand through the day, by compass bearing and height. Grey: the two solstices.</p>
      <p class="micro almanac-heading almanac-heading-spaced">Daylight through the year</p>
      <canvas class="almanac-chart" data-almanac-chart></canvas>
      <p class="almanac-caption micro" data-almanac-caption>—</p>
      <div class="almanac-heading-row">
        <p class="micro almanac-heading almanac-heading-spaced">Eclipses to come</p>
        <label class="almanac-filter">
          <input type="checkbox" data-almanac-visible />
          <span>Visible from here</span>
        </label>
      </div>
      <ul class="almanac-eclipses" data-almanac-eclipses></ul>
    `,this.title=this.q("[data-almanac-title]"),this.sunList=this.q("[data-almanac-sun]"),this.moonList=this.q("[data-almanac-moon]"),this.chart=this.q("[data-almanac-chart]"),this.sky=this.q("[data-almanac-sky]"),this.chartCaption=this.q("[data-almanac-caption]"),this.eclipseList=this.q("[data-almanac-eclipses]"),this.q("[data-almanac-visible]").addEventListener("change",e=>{this.onlyVisible=e.target.checked,this.lastKey="",this.onRefresh?.()});const t=this.chart.getContext("2d");if(!t)throw new Error("could not get a 2D context for the almanac chart");this.ctx=t}q(t){const e=this.element.querySelector(t);if(!e)throw new Error(`missing element ${t}`);return e}get hidden(){return this.element.hasAttribute("hidden")}setHidden(t){this.element.toggleAttribute("hidden",t),t||(this.lastKey="")}update(t,e,n){if(this.hidden)return;const s=`${Math.floor(e/U)}|${t.lat.toFixed(3)},${t.lon.toFixed(3)}|${t.zone}|${n}`;if(s===this.lastKey)return;this.lastKey=s,this.dpr=n,this.title.textContent=t.country?`${t.name}, ${t.country}`:t.name||"Open water";const o=vt(t.lat,t.lon,e),a=O(e),r=ft(e),l=On(a,r);this.fill(this.sunList,this.sunRows(t,e,o)),this.fill(this.moonList,this.moonRows(t,e,r,l)),this.drawSky(t,e,a,r),this.drawChart(t,e),this.fillEclipses(t,e)}fill(t,e){t.textContent="";for(const n of e){const s=document.createElement("div");n.quiet&&(s.className="is-quiet");const o=document.createElement("dt");o.className="micro",o.textContent=n.label;const a=document.createElement("dd");a.className="numeric",a.textContent=n.value,s.append(o,a),t.append(s)}}sunRows(t,e,n){const s=u=>et(t.zone,u),o=zt(t.lat,t.lon,O(e)),a=vt(t.lat,t.lon,e-T),r=n.dayLength-a.dayLength,l=Math.abs(r)/U,c=n.polar||a.polar?"—":`${r>=0?"+":on}${Math.floor(l)}m ${String(Math.round(l%1*60)).padStart(2,"0")}s`;return[{label:"Now",value:`${xt(o.elevation)} · ${$e(o.azimuth)}`},{label:"First light",value:s(n.astronomicalDawn),quiet:!0},{label:"Dawn",value:s(n.civilDawn),quiet:!0},{label:"Sunrise",value:n.polar==="night"?"no sunrise":s(n.sunrise)},{label:"Golden hour",value:Rn(t.zone,n.sunrise,n.goldenMorning)},{label:"Solar noon",value:s(n.solarNoon)},{label:"Golden hour",value:Rn(t.zone,n.goldenEvening,n.sunset)},{label:"Sunset",value:n.polar==="day"?"no sunset":s(n.sunset)},{label:"Dusk",value:s(n.civilDusk),quiet:!0},{label:"Last light",value:s(n.astronomicalDusk),quiet:!0},{label:"Daylight",value:Xe(n.dayLength)},{label:"Change",value:c},{label:"Highest",value:xt(n.maxElevation),quiet:!0}]}fillEclipses(t,e){const n=this.eclipses?.filter(r=>r.time>=e)??[];if(!(this.eclipses!==null&&e>=this.eclipseSpan.from&&this.eclipseSpan.count>=this.eclipseWanted&&(n.length>=An||this.eclipseSpan.exhausted))){const r=eo(e,this.eclipseWanted,xo,no);this.eclipses=r,this.eclipseSpan={from:e,count:this.eclipseWanted,exhausted:r.length<this.eclipseWanted}}const o=(this.eclipses??[]).filter(r=>r.time>=e).slice(0,this.eclipseWanted);this.eclipseWanted<Cn&&!this.growing&&(this.growing=!0,setTimeout(()=>{this.eclipseWanted=Cn,this.growing=!1,this.lastKey="",this.onRefresh?.()},300)),this.eclipseList.textContent="";let a=0;for(const r of o){const l=this.viewFrom(t,r);if(this.onlyVisible&&!l.visible)continue;a++;const c=document.createElement("li");c.className="almanac-eclipse",l.visible||c.classList.add("is-unseen");const h=document.createElement("button");h.type="button";const u=M(t.zone,r.time),d=document.createElement("span");d.className="numeric",d.textContent=`${de(u)}`;const m=document.createElement("span");m.className="almanac-eclipse-kind",m.textContent=lo(r);const f=document.createElement("span");f.className="numeric almanac-eclipse-detail";const g=r.kind==="solar"?r.greatest:null,x=g?this.describePoint?.(g.lon,g.lat):null;x&&f.classList.remove("numeric"),f.textContent=g?x??`${Ze(g.lat)} ${Oe(g.lon)}`:`mag ${Math.max(0,r.magnitude).toFixed(2)}`;const p=document.createElement("span");p.className="almanac-eclipse-local",l.strong&&p.classList.add("is-strong"),p.textContent=l.text,h.append(d,m,f,p),h.addEventListener("click",()=>{this.onJump?.(r.time,l.jumpTo)}),c.append(h),this.eclipseList.append(c)}if(a===0){const r=document.createElement("li");r.className="almanac-eclipse almanac-eclipse-empty",r.textContent=this.onlyVisible?`None of the next ${o.length} can be seen from ${t.name||"here"}.`:"Nothing within the horizon.",this.eclipseList.append(r)}}viewFrom(t,e){const n=`${e.kind}|${Math.round(e.time/U)}|${t.lat.toFixed(2)},${t.lon.toFixed(2)}|${t.zone}`,s=this.circumstances.get(n);if(s)return s;const o=t.name||"here";let a;if(e.kind==="solar"){const r=io(e,t.lon,t.lat),l=Math.round(r.obscuration*100);if(l===0)a={visible:!1,strong:!1,text:`Not visible from ${o}`,jumpTo:e.greatest};else{const c=r.obscuration>=.999?"total":`${l}% covered`;a={visible:!0,strong:r.obscuration>=.5,text:`From ${o}: ${c} at ${et(t.zone,r.peak)}`,jumpTo:{lon:t.lon,lat:t.lat,time:r.peak}}}}else{const r=ao(e,t.lon,t.lat),l=ft(e.time),c={lon:l.sublunarLon,lat:l.sublunarLat};r.visible?a={visible:!0,strong:r.elevation>10,text:`From ${o}: Moon ${xt(r.elevation)} up at ${et(t.zone,e.time)}`,jumpTo:c}:r.partly?a={visible:!0,strong:!1,text:`From ${o}: Moon rising or setting mid-eclipse`,jumpTo:c}:a={visible:!1,strong:!1,text:`Not visible from ${o}: Moon below the horizon`,jumpTo:c}}return this.circumstances.size>600&&this.circumstances.clear(),this.circumstances.set(n,a),a}moonRows(t,e,n,s){const o=qs(t.lat,t.lon,e),a=Ce(t.lat,t.lon,n),r=l=>et(t.zone,l);return[{label:"Phase",value:s.name},{label:"Lit",value:`${(s.illumination*100).toFixed(0)}%`},{label:"Age",value:`${s.ageDays.toFixed(1)} d`},{label:"Now",value:a.elevation>0?`${xt(a.elevation)} · ${$e(a.azimuth)}`:`${xt(a.elevation)} · below`},{label:"Moonrise",value:o.circumstance==="up"?"up all day":o.circumstance==="down"?"never up":r(o.moonrise)},{label:"Moonset",value:o.circumstance?"—":r(o.moonset)},{label:"Distance",value:`${Math.round(n.distanceKm).toLocaleString("en-GB")} km`,quiet:!0},{label:"Apparent size",value:`${(n.angularRadius*120).toFixed(2)}′`,quiet:!0}]}drawSky(t,e,n,s){const o=Math.max(1,this.sky.clientWidth),a=To;this.sky.width=Math.round(o*this.dpr),this.sky.height=Math.round(a*this.dpr);const r=this.sky.getContext("2d");if(!r)return;r.setTransform(this.dpr,0,0,this.dpr,0,0),r.clearRect(0,0,o,a);const l=p=>p/360*o,c=p=>a-(p-Gt)/(90-Gt)*a,h=M(t.zone,e),u=`${h.year}-${h.month}-${h.day}|${t.lat.toFixed(3)},${t.lon.toFixed(3)}|${t.zone}`;if(this.skyCache?.key!==u){const p=vt(t.lat,t.lon,e).solarNoon??e,y=[],b=(v,E)=>{const A=[];for(let S=-720;S<=720;S+=5){const z=v+S*U,P=E==="sun"?zt(t.lat,t.lon,O(z)):Ce(t.lat,t.lon,ft(z));A.push({time:z,azimuth:P.azimuth,altitude:P.elevation})}return A};y.push({name:"june",points:b($t(h.year,90)+(p-Date.UTC(h.year,h.month-1,h.day,12)),"sun")}),y.push({name:"december",points:b($t(h.year,270)+(p-Date.UTC(h.year,h.month-1,h.day,12)),"sun")}),y.push({name:"moon",points:b(p,"moon")}),y.push({name:"today",points:b(p,"sun")}),this.skyCache={key:u,curves:y}}r.fillStyle=w[50],r.fillRect(0,0,o,a);const d=[[0,-6,"rgba(247, 173, 48, 0.10)"],[-6,-12,"rgba(120, 140, 190, 0.10)"],[-12,-18,"rgba(90, 100, 150, 0.08)"]];for(const[p,y,b]of d)r.fillStyle=b,r.fillRect(0,c(p),o,c(y)-c(p));r.strokeStyle=w[200],r.lineWidth=1,r.beginPath();for(const p of[90,180,270])r.moveTo(l(p),0),r.lineTo(l(p),a);for(const p of[30,60])r.moveTo(0,c(p)),r.lineTo(o,c(p));r.stroke(),r.strokeStyle=w[400],r.beginPath(),r.moveTo(0,c(0)),r.lineTo(o,c(0)),r.stroke(),r.font='500 8.5px "Inter", system-ui, sans-serif',r.fillStyle=w[400],r.textBaseline="top",r.textAlign="center";for(const[p,y]of[[90,"E"],[180,"S"],[270,"W"]])r.fillText(y,l(p),3);r.textAlign="left",r.fillText("N",3,3),r.textAlign="right",r.fillText("N",o-3,3),r.textAlign="left",r.textBaseline="bottom",r.fillText("60°",3,c(60)-1),r.fillText("30°",3,c(30)-1);const m=p=>{r.beginPath();let y=!1;for(let b=0;b<p.length;b++){const v=p[b],E=p[b-1];E&&Math.abs(v.azimuth-E.azimuth)>180&&(y=!1),y?r.lineTo(l(v.azimuth),c(v.altitude)):r.moveTo(l(v.azimuth),c(v.altitude)),y=!0}r.stroke()};for(const p of this.skyCache.curves)r.save(),p.name==="today"?(r.strokeStyle=X[400],r.lineWidth=1.6):p.name==="moon"?(r.strokeStyle=w[500],r.lineWidth=1,r.setLineDash([3,3])):(r.strokeStyle=w[300],r.lineWidth=1),m(p.points),r.restore();const f=this.skyCache.curves.find(p=>p.name==="today");r.fillStyle=X[500],r.font='500 8px "Inter", system-ui, sans-serif',r.textAlign="center",r.textBaseline="bottom";for(const p of f.points){const y=M(t.zone,p.time);if(y.minute>=5||p.altitude<Gt)continue;const b=l(p.azimuth),v=c(p.altitude);r.beginPath(),r.arc(b,v,y.hour%3===0?2:1.2,0,Math.PI*2),r.fill(),y.hour%3===0&&p.altitude>-12&&(r.fillStyle=w[600],r.fillText(String(y.hour),b,v-4),r.fillStyle=X[500])}const g=zt(t.lat,t.lon,n),x=Ce(t.lat,t.lon,s);x.elevation>Gt&&(r.strokeStyle=w[700],r.lineWidth=1.2,r.beginPath(),r.arc(l(x.azimuth),c(x.elevation),3.5,0,Math.PI*2),r.stroke()),g.elevation>Gt&&(r.fillStyle=X[600],r.beginPath(),r.arc(l(g.azimuth),c(g.elevation),4.5,0,Math.PI*2),r.fill(),r.strokeStyle=w[0],r.lineWidth=1,r.stroke())}drawChart(t,e){const n=Math.max(1,this.chart.clientWidth),s=wo;this.chart.width=Math.round(n*this.dpr),this.chart.height=Math.round(s*this.dpr);const{ctx:o}=this;o.setTransform(this.dpr,0,0,this.dpr,0,0),o.clearRect(0,0,n,s);const a=M(t.zone,e),r=a.year,l=`${r}|${t.lat.toFixed(3)},${t.lon.toFixed(3)}|${t.zone}`;if(this.chartCache?.key!==l){const p=[],y=Date.UTC(r,0,1,12);for(let b=0;b<366;b+=ae){const v=vt(t.lat,t.lon,y+b*T);p.push({rise:v.sunrise===null?null:Mn(t.zone,v.sunrise),set:v.sunset===null?null:Mn(t.zone,v.sunset),polar:v.polar})}this.chartCache={key:l,days:p}}const c=this.chartCache.days,h=p=>p/(c.length-1)*n,u=p=>s-p/24*s,d=n/(c.length-1);o.fillStyle=w[50],o.fillRect(0,0,n,s),o.fillStyle="rgba(247, 173, 48, 0.22)",o.strokeStyle=X[400],o.lineWidth=1;for(let p=0;p<c.length;p++){const y=c[p],b=h(p)-d/2,v=d+.6;if(y.polar==="day"){o.fillRect(b,0,v,s);continue}y.polar==="night"||y.rise===null||y.set===null||(y.rise<=y.set?o.fillRect(b,u(y.set),v,u(y.rise)-u(y.set)):(o.fillRect(b,u(24),v,u(y.rise)-u(24)),o.fillRect(b,u(y.set),v,u(0)-u(y.set))))}for(const p of["rise","set"]){o.beginPath();let y=!1;for(let b=0;b<c.length;b++){const v=c[b][p];if(v===null){y=!1;continue}y?o.lineTo(h(b),u(v)):o.moveTo(h(b),u(v)),y=!0}o.stroke()}o.strokeStyle=w[300],o.globalAlpha=.5,o.beginPath();for(const p of[6,12,18])o.moveTo(0,u(p)),o.lineTo(n,u(p));o.stroke(),o.globalAlpha=1,o.strokeStyle=w[500],o.globalAlpha=.65,o.beginPath();for(const p of[0,90,180,270]){const b=($t(r,p)-Date.UTC(r,0,1))/T/ae;o.moveTo(h(b),0),o.lineTo(h(b),s)}o.stroke(),o.globalAlpha=1;const m=(Date.UTC(a.year,a.month-1,a.day)-Date.UTC(r,0,1))/T,f=h(m/ae);o.strokeStyle=w[800],o.lineWidth=1.5,o.beginPath(),o.moveTo(f,0),o.lineTo(f,s),o.stroke();const g=c[Math.round(m/ae)],x=vt(t.lat,t.lon,e);this.chartCaption.textContent=g&&x?`${Xe(x.dayLength)} of daylight today · the vertical rules are the solstices and equinoxes`:""}}function Mn(i,t){const e=M(i,t);return e.hour+e.minute/60+e.second/3600}function Rn(i,t,e){return t===null||e===null?"—":`${et(i,t)}–${et(i,e)}`}const So=8;function re(i){return i.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}function In(i,t){if(i===t)return 1e3;if(i.startsWith(t))return 700-(i.length-t.length);const e=i.indexOf(` ${t}`);if(e>=0)return 500-e;const n=i.indexOf(t);return n>=0?250-n:-1}class Ao{places;zones;constructor(t,e,n){this.places=[];for(let s=0;s<e;s++){const o=t[s];this.places.push({folded:re(o.name),country:re(o.country),city:o})}this.zones=[];for(const s of n)s.iana&&this.zones.push({folded:re(s.iana.replace(/_/g," ")),zone:s.iana,anchor:s.anchor})}search(t){const e=re(t.trim());if(e.length<2)return[];const n=[];for(const s of this.places){let o=In(s.folded,e);if(o<0&&s.country.startsWith(e)&&(o=120),o<0)continue;const a=Math.log10(Math.max(10,s.city.population))*12;n.push({label:s.city.name,detail:s.city.country,lon:s.city.lon,lat:s.city.lat,kind:"place",score:o+a})}for(const s of this.zones){const o=In(s.folded,e);o<0||n.push({label:Ve(s.zone),detail:"Time zone",lon:s.anchor[0],lat:s.anchor[1],zone:s.zone,kind:"zone",score:o-60})}return n.sort((s,o)=>o.score-s.score),n.slice(0,So)}}const ye="heliograph.v1",Re={layers:null,basis:null,rate:null,saved:[]};function Kn(){try{const i=window.localStorage;return i.setItem(`${ye}.probe`,"1"),i.removeItem(`${ye}.probe`),i}catch{return null}}function Co(){const i=Kn();if(!i)return{...Re};try{const t=i.getItem(ye);if(!t)return{...Re};const e=JSON.parse(t);return{layers:Array.isArray(e.layers)?e.layers.filter(n=>typeof n=="string"):null,basis:typeof e.basis=="string"?e.basis:null,rate:typeof e.rate=="number"?e.rate:null,saved:Array.isArray(e.saved)?e.saved.filter(n=>n!==null&&typeof n=="object"&&Number.isFinite(n.lon)&&Number.isFinite(n.lat)).slice(0,24):[]}}catch{return{...Re}}}function Mo(i){const t=Kn();if(t)try{t.setItem(ye,JSON.stringify(i))}catch{}}function Ln(i,t){return Math.abs(i.lon-t.lon)<.002&&Math.abs(i.lat-t.lat)<.002}const kn=54;async function Ro(i,t,e){const n=i.width,s=i.height,o=n/Math.max(1,i.clientWidth),a=document.createElement("canvas");a.width=n,a.height=s+Math.round(kn*o);const r=a.getContext("2d");if(!r)throw new Error("could not get a 2D context to export into");r.fillStyle=w[0],r.fillRect(0,0,a.width,a.height),r.drawImage(i,0,0,n,s),r.drawImage(t,0,0,n,s);const l=18*o,c=s+kn*o*.5;return r.textBaseline="middle",r.fillStyle=w[800],r.font=`500 ${13*o}px Archivo, system-ui, sans-serif`,r.textAlign="left",r.fillText(e.place,l,c),r.fillStyle=w[500],r.font=`${11*o}px 'Martian Mono', ui-monospace, monospace`,r.textAlign="right",r.fillText(`${e.date}  ${e.time}  ${e.zone}`,a.width-l,c),r.textAlign="center",r.fillStyle=X[400],r.font=`500 ${12*o}px Archivo, system-ui, sans-serif`,r.fillText("Heliograph",a.width/2,c),new Promise((h,u)=>{a.toBlob(d=>{d?h(d):u(new Error("the browser would not encode the image"))},"image/png")})}async function Io(i,t){const e=new File([i],t,{type:"image/png"}),n=navigator;if(n.share&&n.canShare?.({files:[e]}))try{return await n.share({files:[e],title:"Heliograph"}),"shared"}catch(a){if(a instanceof Error&&a.name==="AbortError")return"shared"}const s=URL.createObjectURL(i),o=document.createElement("a");return o.href=s,o.download=t,o.click(),setTimeout(()=>URL.revokeObjectURL(s),1e4),"downloaded"}const Lo=2e4,ko=6e4,Fo=`
<header class="rail">
  <div class="mark">
    <svg class="mark-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" class="mark-disc" />
      <path d="M1.5 12a10.5 10.5 0 0 1 21 0z" class="mark-lit" />
      <circle cx="12" cy="12" r="10.5" class="mark-ring" />
    </svg>
    <span class="mark-name">Heliograph</span>
  </div>

  <div class="rail-readout">
    <span class="micro">Subsolar point</span>
    <span class="numeric" data-subsolar>—</span>
  </div>

  <div class="rail-readout rail-readout-wide">
    <span class="micro">People in daylight</span>
    <span class="numeric" data-daylit>—</span>
  </div>

  <div class="rail-readout rail-readout-wide">
    <span class="micro" data-season-label>Next solstice</span>
    <span class="numeric" data-season>—</span>
  </div>

  <div class="rail-controls">
    <button type="button" class="button button-icon" data-search-toggle aria-label="Find a place" title="Find a place (press /)">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <path d="M10.4 10.4 14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </button>
    <label class="micro" for="basis">Clock</label>
    <select id="basis" data-basis></select>
    <input class="field" type="date" data-date-field aria-label="Date" />
    <input class="field" type="time" data-time-field aria-label="Time of day" step="60" />
    <button type="button" class="button" data-now>Now</button>
    <button type="button" class="button" data-almanac-toggle aria-expanded="false" aria-controls="almanac" title="Almanac (press A)">Almanac</button>
    <button type="button" class="button" data-layers-toggle aria-expanded="false" aria-controls="layers">Layers</button>
  </div>
</header>

<main class="stage" data-stage>
  <canvas class="map" data-map></canvas>
  <canvas class="overlay" data-overlay></canvas>

  <button type="button" class="fab" data-recenter aria-label="Reset the view to your place">
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="10" cy="10" r="1.6"/>
      <path d="M10 1v3.2M10 15.8V19M1 10h3.2M15.8 10H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </button>

  <div class="search" data-search hidden>
    <input class="search-field" type="search" data-search-field placeholder="Find a place or a time zone" aria-label="Find a place or a time zone" autocomplete="off" spellcheck="false" />
    <ul class="search-results" data-search-results role="listbox"></ul>
  </div>

  <div class="panel layers" id="layers" data-layers hidden>
    <p class="micro panel-title">Layers</p>
    <div data-layer-list></div>
    <p class="micro panel-title panel-title-spaced">Twilight</p>
    <ul class="legend" data-legend></ul>
    <p class="micro panel-title panel-title-spaced keys-title">Keys</p>
    <dl class="keys">
      <div><dt><kbd>Space</kbd></dt><dd>Play or pause</dd></div>
      <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>An hour back or forward, a day with <kbd>Shift</kbd></dd></div>
      <div><dt><kbd>+</kbd> <kbd>−</kbd> <kbd>0</kbd></dt><dd>Zoom in, out, and back to the world</dd></div>
      <div><dt><kbd>/</kbd></dt><dd>Find a place or a zone</dd></div>
      <div><dt><kbd>A</kbd> <kbd>L</kbd></dt><dd>Almanac, layers</dd></div>
      <div><dt><kbd>?</kbd></dt><dd>This list</dd></div>
    </dl>
  </div>
</main>

<footer class="console" data-console>
  <button type="button" class="sheet-grip" data-sheet-toggle aria-expanded="false" aria-label="Show more detail">
    <span class="sheet-grip-bar" aria-hidden="true"></span>
  </button>

  <div class="console-grid">
    <section class="clock">
      <p class="clock-date numeric" data-date>—</p>
      <p class="clock-time numeric" data-time>—</p>
      <p class="clock-zone micro" data-zone>—</p>
    </section>
    <p class="peek" data-peek>—</p>

    <section class="transport">
      <div class="transport-row">
        <button type="button" class="button button-step" data-step="-1" aria-label="Step back one hour">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3v10L4 8z"/><rect x="2.5" y="3" width="1.4" height="10"/></svg>
        </button>
        <button type="button" class="button button-play" data-play aria-label="Play">
          <svg viewBox="0 0 16 16" aria-hidden="true" data-play-icon><path d="M4 2.5v11l9-5.5z"/></svg>
        </button>
        <button type="button" class="button button-step" data-step="1" aria-label="Step forward one hour">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3v10L12 8z"/><rect x="12.1" y="3" width="1.4" height="10"/></svg>
        </button>
      </div>
      <div class="segmented" role="group" aria-label="What to animate" data-modes></div>
      <div class="segmented segmented-quiet" role="group" aria-label="Speed" data-rates></div>
    </section>

    <section class="place" aria-live="polite">
      <p class="micro" data-place-label>Under the pointer</p>
      <p class="place-head">
        <span class="place-name" data-place-name>—</span>
        <button type="button" class="icon-button" data-star aria-pressed="false" aria-label="Save this place">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6 9.9 5.7l4.5.5-3.3 3 .9 4.4L8 11.4l-4 2.2.9-4.4-3.3-3 4.5-.5z"/></svg>
        </button>
        <button type="button" class="icon-button" data-share aria-label="Save a picture of this view">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 11 5H9v5H7V5H5zM2.5 9.5h2v3h7v-3h2v5h-11z"/></svg>
        </button>
      </p>
      <p class="place-coords numeric" data-place-coords>—</p>
      <dl class="facts">
        <div><dt class="micro">Local</dt><dd class="numeric" data-place-clock>—</dd></div>
        <div><dt class="micro">Sun</dt><dd class="numeric" data-place-sun>—</dd></div>
        <div><dt class="micro">Rise</dt><dd class="numeric" data-place-rise>—</dd></div>
        <div><dt class="micro">Set</dt><dd class="numeric" data-place-set>—</dd></div>
        <div><dt class="micro">Daylight</dt><dd class="numeric" data-place-daylight>—</dd></div>
      </dl>
    </section>
  </div>

  <div class="scrubbers" data-scrubbers></div>
</footer>
`,zo="(max-width: 720px), (pointer: coarse) and (max-height: 520px)",Lt=[{key:"cities",label:"City lights",group:"map"},{key:"places",label:"Place names",group:"overlay"},{key:"timezones",label:"Time zones",group:"overlay"},{key:"matchClock",label:"Same clock time",group:"special"},{key:"graticule",label:"Graticule",group:"overlay"},{key:"boundaries",label:"Twilight lines",group:"overlay"},{key:"analemma",label:"Analemma",group:"overlay"},{key:"moon",label:"Moonlight",group:"map"},{key:"localTime",label:"Local time everywhere",group:"special"},{key:"borders",label:"Borders",group:"map"}],Do=[{label:"Day",hint:"Sun above the horizon",elevation:20},{label:"Golden hour",hint:"+6° to 0°",elevation:3},{label:"Civil twilight",hint:"0° to −6°",elevation:-3},{label:"Nautical twilight",hint:"−6° to −12°",elevation:-9},{label:"Astronomical twilight",hint:"−12° to −18°",elevation:-15},{label:"Night",hint:"Below −18°",elevation:-22}];class Uo{root;world;zones;places;mapCanvas;overlayCanvas;stage;renderer;overlay;dayScrubber;yearScrubber;time=Date.now();basis="UTC";mode="live";lastMotion="live";rate=1;view={centerLon:0,centerLat:0,zoom:1};size={width:1,height:1};dpr=1;hover=null;focus=null;reveal=0;startedAt=0;lastFrame=0;dirty=!0;tuning={...ce};analemmaCache=null;moonCache=null;daylitCache=null;zoneOffsetDay=Number.NaN;track=null;almanac;search;closeSearch=null;prefs=Co();zoneClockCache=new Map;layers={cities:!0,places:!0,timezones:!1,matchClock:!1,graticule:!0,boundaries:!0,analemma:!1,moon:!0,localTime:!1,borders:!1,coast:!0,lakes:!0};reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;constructor(t,e){this.root=t,this.world=e,this.zones=new jn(e),this.places=new Jn(e.cities,e.namedCount)}async start(){if(this.root.innerHTML=Fo,this.mapCanvas=this.q("[data-map]"),this.overlayCanvas=this.q("[data-overlay]"),this.stage=this.q("[data-stage]"),this.renderer=new Bs(this.mapCanvas,this.world),this.overlay=new ge(this.overlayCanvas),this.loadTerrain(),this.basis=wn(),this.focus=this.defaultSite(),this.reducedMotion&&(this.mode="paused"),this.prefs.basis&&Ot(this.prefs.basis)&&(this.basis=this.prefs.basis),this.prefs.rate!==null&&[.5,1,2,4].includes(this.prefs.rate)&&(this.rate=this.prefs.rate),this.prefs.layers){const e=new Set(this.prefs.layers);for(const n of Lt)this.layers[n.key]=e.has(n.key)}this.readUrl(new URLSearchParams(location.search)),this.buildBasisOptions(),this.buildTimeFields(),this.buildLayerControls(),this.buildLegend(),this.buildTransport(),this.buildScrubbers(),this.buildSearch(),this.buildAlmanac(),this.buildSavedPlaces(),this.buildShare(),this.buildSheet(),this.bindPointer(),this.bindKeyboard(),this.lockPageGestures(),new ResizeObserver(()=>this.resize()).observe(this.stage),window.addEventListener("resize",()=>this.resize()),this.resize(),await document.fonts.ready.catch(()=>{}),this.dayScrubber.resize(this.dpr),this.yearScrubber.resize(this.dpr),this.syncSheet(),this.startedAt=performance.now(),this.lastFrame=this.startedAt,this.mode==="live"&&this.startLiveTimer(),this.schedule()}readUrl(t){const e=t.get("t");if(e){const l=Date.parse(e);Number.isFinite(l)&&(this.time=l)}const n=t.get("tz");if(n&&Ot(n)&&(this.basis=n),this.urlSetTheView=t.has("z")||t.has("lon")||t.has("lat"),this.urlSetTheView){const l=Number(t.get("z")),c=Number(t.get("lon")),h=Number(t.get("lat"));this.view={centerLon:Number.isFinite(c)&&t.has("lon")?c:this.view.centerLon,centerLat:Number.isFinite(h)&&t.has("lat")?h:this.view.centerLat,zoom:Number.isFinite(l)&&l>0?l:this.view.zoom}}const s=t.get("play");s==="off"?this.mode="paused":(s==="live"||s==="day"||s==="year")&&(this.mode=s,this.lastMotion=s);const o=Number(t.get("rate"));[.5,1,2,4].includes(o)&&(this.rate=o);const a=t.get("pin");if(a){const[l,c]=a.split(",").map(Number);Number.isFinite(l)&&Number.isFinite(c)&&this.pin(c,l)}const r=t.get("layers");if(r!==null){const l=new Set(r.split(",").filter(Boolean));for(const c of Lt)this.layers[c.key]=l.has(c.key)}}writeUrl(){const t=new URLSearchParams;t.set("t",new Date(Math.round(this.time/1e3)*1e3).toISOString().replace(/\.000Z$/,"Z")),this.basis!=="UTC"&&t.set("tz",this.basis),this.view.zoom!==1&&(t.set("z",this.view.zoom.toFixed(2)),t.set("lon",this.view.centerLon.toFixed(2)),t.set("lat",this.view.centerLat.toFixed(2))),t.set("play",this.mode==="paused"?"off":this.mode),this.rate!==1&&t.set("rate",String(this.rate)),this.focus&&t.set("pin",`${this.focus.lat.toFixed(3)},${this.focus.lon.toFixed(3)}`);const e=Lt.filter(n=>this.layers[n.key]).map(n=>n.key);t.set("layers",e.join(",")),history.replaceState(null,"",`${location.pathname}?${t.toString()}`)}redraw(){this.draw()}samplePixel(t,e){const n=this.mapCanvas.getContext("webgl2");if(!n)return[0,0,0];const s=new Uint8Array(4);return n.readPixels(Math.round(t*this.dpr),Math.round(n.drawingBufferHeight-e*this.dpr),1,1,n.RGBA,n.UNSIGNED_BYTE,s),[s[0],s[1],s[2]]}sublunar(){const{state:t}=this.moonNow();return{lon:t.sublunarLon,lat:t.sublunarLat}}locate(t,e){return N(this.size,this.view,t,e)}applyState(t){this.readUrl(new URLSearchParams(t.replace(/^\?/,""))),this.view=st(this.size,this.view),this.q("[data-basis]").value=this.basis;for(const e of Lt){const n=this.root.querySelector(`#layer-${e.key}`);n&&(n.checked=this.layers[e.key]??!1)}this.syncTransport(),this.repaintTracks(),this.draw()}q(t){const e=this.root.querySelector(t);if(!e)throw new Error(`missing element ${t}`);return e}defaultSite(){const t=wn(),e=(t.split("/").pop()??"").replace(/_/g," ").toLowerCase();if(e)for(let n=0;n<this.world.namedCount;n++){const s=this.world.cities[n];if(s.name.toLowerCase()===e)return{lon:s.lon,lat:s.lat,name:s.name,country:s.country}}for(let n=0;n<this.world.timezoneMeta.length;n++){const s=this.world.timezoneMeta[n];if(s.iana===t)return{lon:s.anchor[0],lat:s.anchor[1],name:Ve(t),country:""}}return{lon:0,lat:51.5,name:"Greenwich",country:"United Kingdom"}}buildBasisOptions(){const t=this.q("[data-basis]"),e=fo(),n=document.createElement("option");n.value="UTC",n.textContent="UTC",t.append(n);const s=document.createElement("optgroup");s.label="Local time";for(const o of e){if(o==="UTC")continue;const a=document.createElement("option");a.value=o,a.textContent=o.replace(/_/g," "),s.append(a)}t.append(s),t.value=Ot(this.basis)?this.basis:"UTC",t.addEventListener("change",()=>{this.basis=t.value,this.repaintTracks(),this.markDirty()})}buildTimeFields(){const t=this.q("[data-date-field]"),e=this.q("[data-time-field]"),n=()=>{const[s,o,a]=t.value.split("-").map(Number),[r,l]=e.value.split(":").map(Number);[s,o,a,r,l].every(c=>Number.isFinite(c))&&(this.mode="paused",this.syncTransport(),this.setTime(It(this.basis,{year:s,month:o,day:a,hour:r,minute:l,second:0})))};t.addEventListener("change",n),e.addEventListener("change",n)}syncTimeFields(t){const e=this.q("[data-date-field]"),n=this.q("[data-time-field]"),s=o=>String(o).padStart(2,"0");document.activeElement!==e&&(e.value=`${t.year}-${s(t.month)}-${s(t.day)}`),document.activeElement!==n&&(n.value=`${s(t.hour)}:${s(t.minute)}`)}buildLayerControls(){const t=this.q("[data-layer-list]");for(const s of Lt){const o=`layer-${s.key}`,a=document.createElement("label");a.className="toggle",a.htmlFor=o;const r=document.createElement("input");r.type="checkbox",r.id=o,r.checked=this.layers[s.key]??!1,r.addEventListener("change",()=>{this.layers[s.key]=r.checked,this.markDirty()});const l=document.createElement("span");l.textContent=s.label,a.append(r,l),t.append(a)}const e=this.q("[data-layers-toggle]"),n=this.q("[data-layers]");e.addEventListener("click",()=>{const s=n.hasAttribute("hidden");n.toggleAttribute("hidden",!s),e.setAttribute("aria-expanded",String(s))}),document.addEventListener("pointerdown",s=>{if(n.hasAttribute("hidden"))return;const o=s.target;n.contains(o)||e.contains(o)||(n.setAttribute("hidden",""),e.setAttribute("aria-expanded","false"))})}buildLegend(){const t=this.q("[data-legend]");for(const e of Do){const n=document.createElement("li"),s=document.createElement("span");s.className="legend-swatch";const o=Ee(le("land",e.elevation)),a=Ee(le("ocean",e.elevation));s.style.background=`linear-gradient(90deg, ${o} 0 50%, ${a} 50% 100%)`;const r=document.createElement("span");r.className="legend-label",r.textContent=e.label;const l=document.createElement("span");l.className="legend-hint numeric",l.textContent=e.hint,n.append(s,r,l),t.append(n)}}buildTransport(){this.q("[data-play]").addEventListener("click",()=>this.togglePlay());for(const s of this.root.querySelectorAll("[data-step]")){const o=Number(s.dataset.step);s.addEventListener("click",()=>{this.mode="paused",this.setTime(this.time+o*36e5),this.syncTransport()})}const e=this.q("[data-modes]");for(const[s,o,a]of[["live","Live","Follow the clock"],["day","Day","Sweep 24 hours"],["year","Year","Sweep 365 days"]]){const r=document.createElement("button");r.type="button",r.dataset.mode=s,r.textContent=o,r.title=a,r.addEventListener("click",()=>{this.mode=this.mode===s?"paused":s,this.lastMotion=s,this.mode==="live"&&this.setTime(Date.now()),this.syncTransport(),this.markDirty()}),e.append(r)}const n=this.q("[data-rates]");for(const s of[.5,1,2,4]){const o=document.createElement("button");o.type="button",o.dataset.rate=String(s),o.textContent=`${s}×`,o.addEventListener("click",()=>{this.rate=s,this.syncTransport()}),n.append(o)}this.q("[data-now]").addEventListener("click",()=>{this.mode="live",this.setTime(Date.now()),this.syncTransport()}),this.syncTransport()}syncTransport(){const t=this.mode!=="paused",e=this.q("[data-play]");e.setAttribute("aria-label",t?"Pause":"Play"),e.classList.toggle("is-playing",t),this.q("[data-play-icon]").innerHTML=t?'<rect x="3.5" y="2.5" width="3.2" height="11"/><rect x="9.3" y="2.5" width="3.2" height="11"/>':'<path d="M4 2.5v11l9-5.5z"/>';for(const n of this.root.querySelectorAll("[data-mode]"))n.setAttribute("aria-pressed",String(n.dataset.mode===this.mode));for(const n of this.root.querySelectorAll("[data-rate]"))n.setAttribute("aria-pressed",String(Number(n.dataset.rate)===this.rate))}togglePlay(){this.mode=this.mode==="paused"?this.lastMotion:"paused",this.mode==="live"&&this.setTime(Date.now()),this.syncTransport(),this.mode==="live"&&this.startLiveTimer(),this.markDirty()}buildScrubbers(){const t=this.q("[data-scrubbers]");this.dayScrubber=new Sn({label:"Time of day",min:0,max:1440,step:1,pageStep:60,height:26,describe:n=>`${String(Math.floor(n/60)).padStart(2,"0")}:${String(Math.floor(n%60)).padStart(2,"0")}`,onChange:n=>{this.mode="paused",this.syncTransport();const s=M(this.basis,this.time);this.setTime(It(this.basis,{year:s.year,month:s.month,day:s.day,hour:Math.floor(n/60),minute:Math.floor(n%60),second:0}))},paint:(n,s,o)=>this.paintDayTrack(n,s,o),ticks:()=>this.dayTicks()}),this.yearScrubber=new Sn({label:"Day of year",min:0,max:365,step:1,pageStep:30,height:22,describe:n=>de(M(this.basis,this.timeForDayOfYear(n))),onChange:n=>{this.mode="paused",this.syncTransport(),this.setTime(this.timeForDayOfYear(n))},paint:(n,s,o)=>this.paintYearTrack(n,s,o),ticks:()=>this.yearTicks()}),this.dayScrubber.element.classList.add("scrubber-day"),this.yearScrubber.element.classList.add("scrubber-year");const e=document.createElement("div");e.className="month-scale";for(const n of["J","F","M","A","M","J","J","A","S","O","N","D"]){const s=document.createElement("span");s.textContent=n,e.append(s)}t.append(this.dayScrubber.element,this.yearScrubber.element,e)}timeForDayOfYear(t){const e=M(this.basis,this.time),n=Date.UTC(e.year,0,1),s=new Date(n+Math.round(t)*T);return It(this.basis,{year:s.getUTCFullYear(),month:s.getUTCMonth()+1,day:s.getUTCDate(),hour:e.hour,minute:e.minute,second:e.second})}referenceSite(){return this.focus??{lon:0,lat:0,name:"Null Island",country:""}}paintStrip(t,e,n,s){const o=this.referenceSite();for(let a=0;a<e;a++){const r=s((a+.5)/e),l=O(r),c=zt(o.lat,o.lon,l).elevation;t.fillStyle=Ee(le("land",c)),t.fillRect(a,0,1,n)}}paintDayTrack(t,e,n){const s=M(this.basis,this.time),o=It(this.basis,{...s,hour:0,minute:0,second:0});this.paintStrip(t,e,n,a=>o+a*T)}yearOffsets(t){const e=`${t}|${this.basis}`;if(this.offsetCache?.key===e)return this.offsetCache.minutes;const n=new Float64Array(366),s=Date.UTC(t,0,1);for(let o=0;o<366;o++)n[o]=tt(this.basis,s+o*T+12*36e5);return this.offsetCache={key:e,minutes:n},n}paintYearTrack(t,e,n){const s=M(this.basis,this.time),o=Date.UTC(s.year,0,1),a=this.yearOffsets(s.year),r=s.hour*60+s.minute;this.paintStrip(t,e,n,l=>{const c=Math.min(365,Math.floor(l*365));return o+c*T+(r-(a[c]??0))*U})}dayTicks(){const t=this.referenceSite(),e=vt(t.lat,t.lon,this.time),n=M(this.basis,this.time),s=It(this.basis,{...n,hour:0,minute:0,second:0}),o=[];for(let a=0;a<=24;a+=3)o.push({at:a*60,weight:.3});for(const a of[e.sunrise,e.sunset])a!==null&&o.push({at:(a-s)/U,weight:1});return o}yearTicks(){const t=M(this.basis,this.time),e=Date.UTC(t.year,0,1),n=[];for(let s=1;s<12;s++)n.push({at:(Date.UTC(t.year,s,1)-e)/T,weight:.3});for(const[s,o]of[[2,20],[5,21],[8,22],[11,21]])n.push({at:(Date.UTC(t.year,s,o)-e)/T,weight:1});return n}repaintTracks(){this.dayScrubber.repaint(),this.yearScrubber.repaint()}buildSheet(){const t=this.q("[data-console]");this.sheetEl=t,this.sheetMedia=window.matchMedia(zo),this.sheetMedia.addEventListener("change",()=>this.syncSheet()),new ResizeObserver(()=>this.syncSheet()).observe(t);let e=0,n=0,s=0,o=0,a=0,r=0,l=!1,c=null;const h=d=>d instanceof Element&&d.closest("button:not([data-sheet-toggle]), select, input, a, .scrubber-surface")!==null;t.addEventListener("pointerdown",d=>{!this.sheetMedia.matches||h(d.target)||t.scrollTop>1||(l=!0,s=0,e=o=d.clientY,a=performance.now(),r=0,n=this.sheetOpen?0:this.sheetClosedShift,c=d.target instanceof Element?d.target:null,t.setPointerCapture(d.pointerId))}),t.addEventListener("pointermove",d=>{if(!l)return;const m=performance.now(),f=d.clientY-o;m>a&&(r=f/(m-a)),o=d.clientY,a=m,s=Math.max(s,Math.abs(d.clientY-e)),s>4&&t.classList.add("is-dragging");const g=Math.min(this.sheetClosedShift,Math.max(0,n+d.clientY-e));t.style.setProperty("--sheet-shift",`${g}px`)});const u=d=>{if(!l)return;if(l=!1,t.classList.remove("is-dragging"),t.hasPointerCapture(d.pointerId)&&t.releasePointerCapture(d.pointerId),s<6){c!==null&&(c.closest("[data-sheet-toggle]")!==null||c.closest(".clock")!==null)?this.setSheet(!this.sheetOpen):this.syncSheet();return}const m=n+o-e,f=Math.abs(r)>.4?r<0:m<this.sheetClosedShift/2;this.setSheet(f)};t.addEventListener("pointerup",u),t.addEventListener("pointercancel",u),t.addEventListener("touchmove",d=>{l&&d.preventDefault()},{passive:!1}),this.overlayCanvas.addEventListener("pointerdown",()=>{this.sheetOpen&&this.sheetMedia.matches&&this.setSheet(!1)}),this.q("[data-recenter]").addEventListener("click",()=>this.recenter())}setSheet(t){this.sheetOpen=t,this.q("[data-sheet-toggle]").setAttribute("aria-expanded",String(t)),this.q("[data-sheet-toggle]").setAttribute("aria-label",t?"Show less detail":"Show more detail"),document.body.classList.toggle("sheet-open",t),this.syncSheet()}syncSheet(){const t=this.sheetEl;if(!t)return;if(!this.sheetMedia.matches){t.style.removeProperty("--sheet-shift"),document.documentElement.style.removeProperty("--sheet-peek");return}const e=t.getBoundingClientRect().top,n=this.dayScrubber.element.getBoundingClientRect().bottom,s=Number.parseFloat(getComputedStyle(t).paddingBottom)||0;this.sheetClosedShift=Math.max(0,t.offsetHeight-(n-e)-s),t.style.setProperty("--sheet-shift",`${this.sheetOpen?0:this.sheetClosedShift}px`);const o=t.offsetHeight-this.sheetClosedShift;document.documentElement.style.setProperty("--sheet-peek",`${Math.round(o)}px`),t.classList.contains("sheet-ready")||requestAnimationFrame(()=>t.classList.add("sheet-ready"))}recenter(){const t=this.referenceSite();this.view=st(this.size,{centerLon:t.lon,centerLat:t.lat,zoom:this.fillZoom()}),this.markDirty()}loadTerrain(){const t=e=>{const n=new Image;return n.decoding="async",n.src=e,n.decode().then(()=>n)};Promise.all([t(mo),t(po)]).then(([e,n])=>{this.renderer.setTerrain(e,n),this.markDirty()}).catch(()=>{})}lockPageGestures(){for(const t of["gesturestart","gesturechange","gestureend"])document.addEventListener(t,e=>e.preventDefault())}bindPointer(){const t=this.overlayCanvas,e=new Map;let n=0,s={x:0,y:0},o=0;const a=h=>{const u=t.getBoundingClientRect();return{x:h.clientX-u.left,y:h.clientY-u.top}},r=()=>{const[h,u]=[...e.values()];return!h||!u?null:{centre:{x:(h.x+u.x)/2,y:(h.y+u.y)/2},distance:Math.hypot(h.x-u.x,h.y-u.y)}};let l=null;t.addEventListener("pointerdown",h=>{t.setPointerCapture(h.pointerId);const u=a(h);e.set(h.pointerId,u),s=u,n=0,l=e.size===2?r():null,h.pointerType==="touch"&&(this.hover=null)}),t.addEventListener("pointermove",h=>{const u=a(h),d=e.get(h.pointerId);if(d&&e.size===2){e.set(h.pointerId,u);const m=r();l&&m&&l.distance>8&&(this.view=dn(this.size,this.view,m.centre.x-l.centre.x,m.centre.y-l.centre.y),this.view=Rt(this.size,this.view,m.centre.x,m.centre.y,m.distance/l.distance),this.markDirty()),l=m;return}if(d){const m=u.x-d.x,f=u.y-d.y;n+=Math.abs(m)+Math.abs(f),e.set(h.pointerId,u),this.view=dn(this.size,this.view,m,f),t.style.cursor="grabbing"}if(h.pointerType!=="touch"){const[m,f]=_t(this.size,this.view,u.x,u.y);this.hover=Math.abs(f)<=90?{lon:Ft(m),lat:f}:null}this.markDirty()});const c=h=>{const u=a(h),d=e.has(h.pointerId);if(e.delete(h.pointerId),l=e.size===2?r():null,t.hasPointerCapture(h.pointerId)&&t.releasePointerCapture(h.pointerId),t.style.cursor="",!d||e.size>0)return;const m=Math.hypot(u.x-s.x,u.y-s.y),f=h.pointerType==="touch"?12:4;if(m<=f&&n<90){const[g,x]=_t(this.size,this.view,u.x,u.y);if(Math.abs(x)<=90){const p=performance.now();h.pointerType==="touch"&&p-o<320?(this.view=Rt(this.size,this.view,u.x,u.y,1.8),o=0):(o=p,this.pin(Ft(g),x)),this.markDirty()}}};t.addEventListener("pointerup",c),t.addEventListener("pointercancel",c),t.addEventListener("pointerleave",h=>{h.pointerType!=="touch"&&(this.hover=null,this.markDirty())}),t.addEventListener("wheel",h=>{h.preventDefault();const u=a(h);this.view=Rt(this.size,this.view,u.x,u.y,Math.exp(-h.deltaY*.0016)),this.markDirty()},{passive:!1}),t.addEventListener("dblclick",h=>{const u=a(h);this.view=Rt(this.size,this.view,u.x,u.y,1.8),this.markDirty()})}pin(t,e){const n=this.places.nearest(t,e,3);this.focus=n?{lon:n.lon,lat:n.lat,name:n.name,country:n.country}:{lon:t,lat:e,name:"",country:""},this.dayScrubber&&this.repaintTracks(),this.markDirty()}bindKeyboard(){window.addEventListener("keydown",t=>{const e=t.target?.tagName;if(!(e==="INPUT"||e==="SELECT"||e==="TEXTAREA"))switch(t.key){case" ":t.preventDefault(),this.togglePlay();break;case"ArrowLeft":case"ArrowRight":{if(t.target?.closest(".scrubber"))return;t.preventDefault();const n=t.key==="ArrowRight"?1:-1,s=t.shiftKey?T:36e5;this.mode="paused",this.syncTransport(),this.setTime(this.time+n*s);break}case"+":case"=":this.view=Rt(this.size,this.view,this.size.width/2,this.size.height/2,1.3),this.markDirty();break;case"-":case"_":this.view=Rt(this.size,this.view,this.size.width/2,this.size.height/2,1/1.3),this.markDirty();break;case"0":this.view=st(this.size,{centerLon:0,centerLat:0,zoom:1}),this.markDirty();break;case"l":case"L":case"?":this.q("[data-layers-toggle]").click();break;case"a":case"A":this.q("[data-almanac-toggle]").click();break;case"Escape":this.almanac.hidden||this.setAlmanac(!1),this.q("[data-layers]").setAttribute("hidden",""),this.q("[data-layers-toggle]").setAttribute("aria-expanded","false");break;case"/":t.preventDefault(),this.q("[data-search-toggle]").click();break}})}markDirty(){this.dirty=!0,this.schedule(),this.queueUrl()}queueUrl(){this.urlTimer===0&&(this.urlTimer=window.setTimeout(()=>{this.urlTimer=0,this.writeUrl()},400))}setTime(t){this.time=t,this.markDirty()}resize(){const t=this.stage.getBoundingClientRect();this.size={width:Math.max(1,t.width),height:Math.max(1,t.height)},this.dpr=this.pixelRatio(),this.mapCanvas.style.width=`${this.size.width}px`,this.mapCanvas.style.height=`${this.size.height}px`,this.overlayCanvas.style.width=`${this.size.width}px`,this.overlayCanvas.style.height=`${this.size.height}px`,this.renderer.resize(this.size.width*this.dpr,this.size.height*this.dpr),this.overlay.resize(this.size.width,this.size.height,this.dpr),this.fitToShape(),this.view=st(this.size,this.view),this.dayScrubber&&(this.dayScrubber.resize(this.dpr),this.yearScrubber.resize(this.dpr)),this.syncSheet(),this.markDirty()}pixelRatio(){const t=window.devicePixelRatio||1,e=Math.max(1,this.size.width*this.size.height);return Math.max(1,Math.min(t,3,Math.sqrt(65e5/e)))}fitToShape(){if(this.fittedToShape||this.urlSetTheView||this.size.width<2||(this.fittedToShape=!0,ve(this.size,this.view)>=this.size.height*.62))return;const e=this.referenceSite();this.view=st(this.size,{centerLon:e.lon,centerLat:e.lat,zoom:this.fillZoom()})}fillZoom(){return Math.max(1,Math.min(6,this.size.height*1.002/(Wn(this.size)/2)))}sheetEl=null;sheetMedia;sheetOpen=!1;sheetClosedShift=0;yearAccumulator=0;urlTimer=0;urlSetTheView=!1;fittedToShape=!1;offsetCache=null;trackKeys={day:"",year:""};lastYearRepaint=0;frameHandle=0;fallbackTimer=0;liveTimer=0;advance(t){switch(this.mode){case"day":this.setTime(this.time+t*(T/Lo)*this.rate);break;case"year":{this.yearAccumulator+=t*(365/ko)*this.rate;const e=Math.trunc(this.yearAccumulator);if(e!==0){this.yearAccumulator-=e;const n=M(this.basis,this.time),s=new Date(Date.UTC(n.year,n.month-1,n.day)+e*T);this.setTime(It(this.basis,{year:s.getUTCFullYear(),month:s.getUTCMonth()+1,day:s.getUTCDate(),hour:n.hour,minute:n.minute,second:n.second}))}break}}}schedule(){this.frameHandle!==0||this.fallbackTimer!==0||(this.frameHandle=requestAnimationFrame(this.tick),this.fallbackTimer=window.setTimeout(()=>this.tick(performance.now()),250))}startLiveTimer(){this.liveTimer===0&&(this.liveTimer=window.setInterval(()=>{if(this.mode!=="live"){window.clearInterval(this.liveTimer),this.liveTimer=0;return}this.setTime(Date.now())},250))}tick=t=>{this.frameHandle!==0&&(cancelAnimationFrame(this.frameHandle),this.frameHandle=0),this.fallbackTimer!==0&&(window.clearTimeout(this.fallbackTimer),this.fallbackTimer=0);const e=Math.min(250,t-this.lastFrame);this.lastFrame=t,(this.mode==="day"||this.mode==="year")&&this.advance(e),this.mode==="live"&&this.startLiveTimer();const n=this.reducedMotion?1:Math.min(1,(t-this.startedAt)/700);n!==this.reveal&&(this.reveal=n,this.dirty=!0),this.dirty&&(this.draw(),this.dirty=!1),(this.reveal<1||this.mode==="day"||this.mode==="year")&&this.schedule()};draw(){const t=O(this.time),e={coast:this.layers.coast??!0,borders:this.layers.borders??!1,cities:this.layers.cities??!0,lakes:this.layers.lakes??!0},n=this.moonNow(),s=this.lunarFrame(),o={view:this.view,size:this.size,sun:t,moon:this.layers.moon&&n.gain>0?{lon:n.state.sublunarLon,lat:n.state.sublunarLat,gain:n.gain}:null,localTime:this.layers.localTime?this.localTimeFrame():null,eclipse:this.eclipseFrame(),layers:e,time:0,tuning:this.tuning};this.renderer.render(o);const a={graticule:this.layers.graticule??!0,boundaries:this.layers.boundaries??!0,timezones:(this.layers.timezones||this.layers.matchClock)??!1,places:this.layers.places??!0,analemma:this.layers.analemma??!1};this.overlay.draw({view:this.view,size:this.size,sun:t,world:this.world,layers:a,zoneLabels:a.timezones?this.buildZoneLabels():[],placeLabels:a.places?this.buildPlaceLabels():[],highlightZones:this.layers.matchClock?this.matchingZones():new Set,analemma:a.analemma?this.buildAnalemma():null,moon:this.layers.moon?{lon:n.state.sublunarLon,lat:n.state.sublunarLat,illumination:n.phase.illumination,waxing:n.phase.waxing,eclipsed:s?.inUmbra??!1}:null,eclipsePath:this.track,lunarEclipse:s,localTime:this.layers.localTime??!1,hover:this.hover,pinned:this.focus?{lon:this.focus.lon,lat:this.focus.lat,label:this.focus.name}:null,reveal:this.reveal}),this.updateReadouts(t),this.syncScrubbers()}syncScrubbers(){const t=M(this.basis,this.time);this.dayScrubber.setValue(t.hour*60+t.minute+t.second/60);const e=Date.UTC(t.year,0,1),n=(Date.UTC(t.year,t.month-1,t.day)-e)/T;this.yearScrubber.setValue(n);const s=this.referenceSite(),o=`${s.lat.toFixed(3)},${s.lon.toFixed(3)},${this.basis}`,a=`${t.year}-${t.month}-${t.day}|${o}`;a!==this.trackKeys.day&&(this.trackKeys.day=a,this.dayScrubber.repaint());const r=`${t.year}|${t.hour}:${t.minute}|${o}`,l=performance.now();r!==this.trackKeys.year&&l-this.lastYearRepaint>200&&(this.trackKeys.year=r,this.lastYearRepaint=l,this.yearScrubber.repaint())}updateReadouts(t){const e=M(this.basis,this.time);this.q("[data-date]").textContent=`${En(e)} ${de(e)}`,this.q("[data-time]").textContent=kt(e),this.syncTimeFields(e);const n=Me(this.basis,this.time);this.q("[data-zone]").textContent=this.basis==="UTC"?"Coordinated Universal Time":`${Ve(this.basis)} · ${n.abbreviation} · ${n.offset}`,this.q("[data-subsolar]").textContent=`${Ze(t.subsolarLat)}  ${Oe(t.subsolarLon)}`,this.q("[data-daylit]").textContent=`${(this.daylitFraction(t)*100).toFixed(1)}%`;const s=this.nextSeason();this.q("[data-season-label]").textContent=s.label;const o=s.instant-this.time,a=Math.floor(o/T),r=Math.floor((o-a*T)/G);this.q("[data-season]").textContent=a>0?`${a}d ${r}h`:`${r}h`;const l=this.hover===null?this.focus:null,c=this.hover??this.focus;if(!c)return;const h=zt(c.lat,c.lon,t),u=vt(c.lat,c.lon,this.time),d=this.zones.at(c.lon,c.lat),m=d?.iana??"UTC",f=this.places.nearest(c.lon,c.lat,3),g=l?.name||f?.name||"",x=l?.country||f?.country||"";this.q("[data-place-name]").textContent=g?x?`${g}, ${x}`:g:"Open water",this.q("[data-place-coords]").textContent=`${Ze(c.lat)}   ${Oe(c.lon)}`,this.q("[data-place-label]").textContent=this.hover?"Under the pointer":"Pinned";const p=M(m,this.time),y=Me(m,this.time);this.q("[data-place-clock]").textContent=d?.iana?`${kt(p,!1)} ${y.abbreviation}`:`${kt(M("UTC",this.time+(d?.standardOffsetMinutes??0)*U),!1)} (nominal)`,this.q("[data-place-sun]").textContent=`${xt(h.elevation)} · ${$e(h.azimuth)}`,this.q("[data-place-rise]").textContent=u.polar==="day"?"no sunset":u.polar==="night"?"no sunrise":et(m,u.sunrise),this.q("[data-place-set]").textContent=u.polar?"—":et(m,u.sunset),this.q("[data-place-daylight]").textContent=Xe(u.dayLength);const b=u.polar==="day"?"sun up all day":u.polar==="night"?"sun down all day":`rise ${et(m,u.sunrise)} · set ${et(m,u.sunset)}`;this.q("[data-peek]").textContent=`${g||"Open water"} · ${b} · ${xt(h.elevation)}`,this.focus&&this.almanac.update({...this.focus,zone:this.zones.at(this.focus.lon,this.focus.lat)?.iana??"UTC"},this.time,this.dpr),this.syncSavedPlaces()}zoneClock(t){const e=this.world.timezoneMeta[t];if(!e)return null;const n=Math.floor(this.time/U),s=e.iana??`offset:${e.offset}`,o=this.zoneClockCache.get(s);let a;if(o&&o.minute===n)a=o.text;else{const u=e.iana?M(e.iana,this.time):M("UTC",this.time+e.offset*36e5);a=kt(u,!1),this.zoneClockCache.set(s,{minute:n,text:a})}const r=Math.trunc(e.offset),l=Math.abs(Math.round((e.offset-r)*60)),c=e.offset<0?"−":"+",h=l===0?`${c}${Math.abs(r)}`:`${c}${Math.abs(r)}:${String(l).padStart(2,"0")}`;return{text:a,sub:h}}buildZoneLabels(){const t=this.layers.matchClock?this.matchingZones():new Set,e=L(this.size,this.view)/360,n=[];for(let s=0;s<this.world.timezoneMeta.length;s++){const o=this.world.timezoneMeta[s];if((o.bbox[2]-o.bbox[0])*e<52||o.area<4)continue;const a=this.zoneClock(s);a&&n.push({lon:o.anchor[0],lat:o.anchor[1],text:a.text,sub:a.sub,area:o.area,highlighted:t.has(s)})}return n}matchingZones(){const t=M(this.basis,this.time),e=new Set;for(let n=0;n<this.world.timezoneMeta.length;n++){const s=this.world.timezoneMeta[n],o=s.iana?M(s.iana,this.time):M("UTC",this.time+s.offset*36e5);o.hour===t.hour&&o.minute===t.minute&&e.add(n)}return e}buildPlaceLabels(){const[t,e]=_t(this.size,this.view,0,0),[,n]=_t(this.size,this.view,0,this.size.height),s=this.size.width/L(this.size,this.view)*360,o=s>=359,a=Ft(t),r=Ft(t+s),l=Math.round(Math.min(64,22+this.size.width/26)),c=(u,d)=>d>e||d<n?!1:o?!0:a<=r?u>=a&&u<=r:u>=a||u<=r,h=[];for(let u=0;u<this.world.namedCount&&h.length<l;u++){const d=this.world.cities[u];c(d.lon,d.lat)&&h.push({lon:d.lon,lat:d.lat,text:d.name,rank:d.population,capital:d.capital})}return h}eclipseFrame(){const t=ro(this.time);if(!t.possible)return this.track=null,null;(!this.track||Math.abs(this.time-this.track.time)>4*G)&&(this.track=oo(this.time));const e=n=>[n[0]/1e3,n[1]/1e3,n[2]/1e3];return{sun:e(t.sun),moon:e(t.moon),gmst:t.siderealDegrees}}lunarFrame(){return vn(this.time)}localTimeFrame(){const t=Math.floor(this.time/T);if(this.zoneOffsetDay!==t){this.zoneOffsetDay=t;const n=new Float64Array(this.world.timezoneMeta.length);for(let s=0;s<n.length;s++){const o=this.world.timezoneMeta[s];n[s]=o.iana?tt(o.iana,this.time)/60:o.offset}this.renderer.setZoneOffsets(n)}const e=(O(this.time+G).declination-O(this.time).declination)/1;return{referenceOffsetHours:tt(this.basis,this.time)/60,declinationRatePerHour:e}}buildSearch(){this.search=new Ao(this.world.cities,this.world.namedCount,this.world.timezoneMeta);const t=this.q("[data-search]"),e=this.q("[data-search-field]"),n=this.q("[data-search-results]");let s=0,o=[];const a=()=>{n.textContent="",o.forEach((c,h)=>{const u=document.createElement("li");u.className="search-result",u.setAttribute("role","option"),u.setAttribute("aria-selected",String(h===s)),h===s&&u.classList.add("is-active");const d=document.createElement("span");d.className="search-label",d.textContent=c.label;const m=document.createElement("span");m.className="search-detail micro",m.textContent=c.detail,u.append(d,m),u.addEventListener("pointerdown",f=>{f.preventDefault(),this.choose(c)}),n.append(u)})},r=()=>{t.setAttribute("hidden",""),this.q("[data-search-toggle]").setAttribute("aria-expanded","false"),e.value="",o=[],a()};this.closeSearch=r,e.addEventListener("input",()=>{o=this.search.search(e.value),s=0,a()}),e.addEventListener("keydown",c=>{if(c.key==="Escape"){r();return}if(c.key==="ArrowDown"||c.key==="ArrowUp"){if(c.preventDefault(),o.length===0)return;s=(s+(c.key==="ArrowDown"?1:o.length-1))%o.length,a();return}if(c.key==="Enter"){c.preventDefault();const h=o[s];h&&this.choose(h)}});const l=this.q("[data-search-toggle]");l.addEventListener("click",()=>{const c=t.hasAttribute("hidden");t.toggleAttribute("hidden",!c),l.setAttribute("aria-expanded",String(c)),c&&e.focus()}),document.addEventListener("pointerdown",c=>{if(t.hasAttribute("hidden"))return;const h=c.target;t.contains(h)||l.contains(h)||r()})}choose(t){this.pin(t.lon,t.lat),t.zone&&Ot(t.zone)&&(this.basis=t.zone,this.q("[data-basis]").value=t.zone,this.repaintTracks());const e=Math.max(this.view.zoom,t.kind==="zone"?2:4);this.view=st(this.size,{centerLon:t.lon,centerLat:t.lat,zoom:e}),this.closeSearch?.(),this.markDirty()}buildAlmanac(){this.almanac=new Eo,this.almanac.element.id="almanac",this.almanac.setHidden(!0),this.stage.append(this.almanac.element),this.almanac.element.querySelector("[data-almanac-close]")?.addEventListener("click",()=>this.setAlmanac(!1)),this.almanac.describePoint=(e,n)=>this.nearestPlace(e,n),this.almanac.onRefresh=()=>this.draw(),this.almanac.onJump=(e,n)=>{this.mode="paused",this.syncTransport(),n&&(this.view=st(this.size,{centerLon:n.lon,centerLat:n.lat,zoom:Math.max(this.view.zoom,2.5)})),this.setTime(n?.time??e),this.draw()};const t=this.q("[data-almanac-toggle]");t.setAttribute("aria-expanded","false"),t.addEventListener("click",()=>this.setAlmanac(this.almanac.hidden))}nearestPlace(t,e){const n=Math.min(this.world.namedCount,this.world.cities.length);let s=null,o=1/0;for(let d=0;d<n;d++){const m=this.world.cities[d],f=m.lat-e,x=(((m.lon-t)%360+540)%360-180)*Math.cos((m.lat+e)/2*(Math.PI/180)),p=Math.sqrt(f*f+x*x)*111.32;if(p>1500)continue;const y=Math.min(1,Math.log10(Math.max(1,m.population))/7)+(m.capital?.2:0),b=p*(1-.33*Math.min(1,y));b<o&&(o=b,s=m)}if(!s)return null;const a=e-s.lat,l=(((t-s.lon)%360+540)%360-180)*Math.cos((s.lat+e)/2*(Math.PI/180)),c=Math.round(Math.sqrt(a*a+l*l)*111.32);if(c<60)return`${s.name}, ${s.country}`;const h=["N","NE","E","SE","S","SW","W","NW"],u=(Math.atan2(l,a)*(180/Math.PI)+360)%360;return`${c} km ${h[Math.round(u/45)%8]} of ${s.name}`}setAlmanac(t){this.almanac.setHidden(!t),this.q("[data-almanac-toggle]").setAttribute("aria-expanded",String(t)),this.draw(),this.markDirty()}buildSavedPlaces(){this.q("[data-star]").addEventListener("click",()=>{const e=this.focus;if(!e)return;const n=this.prefs.saved.findIndex(s=>Ln(s,e));n>=0?this.prefs.saved.splice(n,1):this.prefs.saved.unshift({name:e.name,country:e.country,lon:e.lon,lat:e.lat}),this.prefs.saved=this.prefs.saved.slice(0,24),this.storePreferences(),this.syncSavedPlaces(),this.markDirty()}),this.syncSavedPlaces()}syncSavedPlaces(){const t=this.q("[data-star]"),e=this.focus!==null&&this.prefs.saved.some(n=>Ln(n,this.focus));t.setAttribute("aria-pressed",String(e)),t.classList.toggle("is-on",e),t.setAttribute("aria-label",e?"Forget this place":"Save this place")}storePreferences(){this.prefs.layers=Lt.filter(t=>this.layers[t.key]).map(t=>t.key),this.prefs.basis=this.basis,this.prefs.rate=this.rate,Mo(this.prefs)}buildShare(){this.q("[data-share]").addEventListener("click",async()=>{this.draw();const t=M(this.basis,this.time),e=this.focus,n=await Ro(this.mapCanvas,this.overlayCanvas,{date:`${En(t)} ${de(t)}`,time:kt(t),zone:this.basis==="UTC"?"UTC":Me(this.basis,this.time).offset,place:e?e.country?`${e.name}, ${e.country}`:e.name:"Heliograph"}),s=new Date(this.time).toISOString().slice(0,16).replace(/[:T]/g,"-");await Io(n,`heliograph-${s}.png`)})}daylitFraction(t){const e=Math.floor(this.time/U);if(this.daylitCache?.minute===e)return this.daylitCache.value;let n=0,s=0;for(let a=0;a<this.world.namedCount;a++){const r=this.world.cities[a],l=r.population;l<=0||(s+=l,he(r.lat,r.lon,t)>H.sunrise&&(n+=l))}const o=s>0?n/s:0;return this.daylitCache={minute:e,value:o},o}nextSeason(){const t=new Date(this.time).getUTCFullYear(),e=[[0,"Next equinox"],[90,"Next solstice"],[180,"Next equinox"],[270,"Next solstice"]];for(const n of[0,1])for(const[s,o]of e){const a=$t(t+n,s);if(a>this.time)return{label:o,instant:a}}return{label:"Next solstice",instant:$t(t+1,90)}}moonNow(){if(this.moonCache&&this.moonCache.time===this.time)return this.moonCache;const t=ft(this.time),e=On(O(this.time),t);let n=js(90,e,t.distanceKm);const s=vn(this.time);return s&&(n*=s.inUmbra?.005:.5),this.moonCache={time:this.time,state:t,phase:e,gain:n},this.moonCache}buildAnalemma(){const t=new Date(this.time).getUTCFullYear(),e=(this.time%T+T)%T,n=Math.round(e/G*3600)/3600;if(this.analemmaCache&&this.analemmaCache.year===t&&this.analemmaCache.hour===n)return this.analemmaCache.points;const s=Xs(t,n,183).map(o=>({lon:o.lon,lat:o.lat}));return this.analemmaCache={year:t,hour:n,points:s},s}}const Ie=""+new URL("world-0LL8EloU.bin",import.meta.url).href,Po={i8:Int8Array,u8:Uint8Array,i16:Int16Array,u16:Uint16Array,i32:Int32Array,u32:Uint32Array,f32:Float32Array};function Q(i,t,e){const n=Po[e.kind];return new n(i,t+e.offset,e.length)}function qn(i){const t=new Float32Array(i.length);for(let e=0;e<i.length;e+=2)t[e]=i[e]/65535*360-180,t[e+1]=i[e+1]/65535*180-90;return t}function Le(i,t,e){return{coords:qn(Q(i,t,e.coords)),ringStarts:Q(i,t,e.ringStarts),polyStarts:Q(i,t,e.polyStarts),featureStarts:e.featureStarts?Q(i,t,e.featureStarts):null}}function No(i){const t=i.indexOf(","),e=i.slice(t+1),n=atob(e),s=new Uint8Array(n.length);for(let o=0;o<n.length;o++)s[o]=n.charCodeAt(o);return s.buffer}function Bo(i){const t=new DataView(i),e=String.fromCharCode(t.getUint8(0),t.getUint8(1),t.getUint8(2),t.getUint8(3));if(e!=="HGD1")throw new Error(`world.bin has magic ${e}, expected HGD1`);const n=t.getUint32(4,!0),s=new TextDecoder().decode(new Uint8Array(i,8,n)),o=JSON.parse(s.replace(/\0+$/,"")),a=8+n,r=Q(i,a,o.cities.lon),l=Q(i,a,o.cities.lat),c=Q(i,a,o.cities.magnitude),h=Q(i,a,o.cities.flags),u=o.cities.names,d=new Array(r.length);for(let m=0;m<r.length;m++){const f=u[m];d[m]={lon:r[m]/65535*360-180,lat:l[m]/65535*180-90,magnitude:c[m]/255,capital:h[m]===1,name:f?f[0]:"",country:f?f[1]:"",population:f?f[2]:0}}return{land:Le(i,a,o.land),lakes:Le(i,a,o.lakes),borders:{coords:qn(Q(i,a,o.borders.coords)),stripStarts:Q(i,a,o.borders.stripStarts)},cities:d,namedCount:u.length,timezones:Le(i,a,o.timezones),timezoneMeta:o.timezones.meta}}let ke=null;function Go(){return ke||(ke=(async()=>{const i=Ie.startsWith("data:")?No(Ie):await(await fetch(Ie)).arrayBuffer();return Bo(i)})()),ke}const Xt=document.querySelector("#app");function _o(i,t){if(console.error(t),!Xt)return;Xt.innerHTML="";const e=document.createElement("div");e.className="fatal";const n=document.createElement("p");n.className="fatal-title",n.textContent=i;const s=document.createElement("p");s.className="fatal-body",s.textContent=String(t),e.append(n,s),Xt.append(e)}async function Wo(){if(!Xt)throw new Error("the page is missing its #app element");const i=await Go(),t=new Uo(Xt,i);await t.start(),window.__heliograph=t,window.__ready=!0}"serviceWorker"in navigator&&window.addEventListener("load",()=>{navigator.serviceWorker.register(new URL("data:video/mp2t;base64,Ly8vIDxyZWZlcmVuY2UgbGliPSJ3ZWJ3b3JrZXIiIC8+CgovKioKICogVGhlIG9mZmxpbmUgY2FjaGUuCiAqCiAqIEV2ZXJ5dGhpbmcgdGhpcyBhcHAgbmVlZHMgaXMgY29tcGlsZWQgaW4gYWxyZWFkeSwgc28gYmVpbmcgdXNhYmxlIHdpdGhvdXQgYQogKiBuZXR3b3JrIGlzIGEgbWF0dGVyIG9mIGhvbGRpbmcgb24gdG8gdGhlIGJ1aWxkIHJhdGhlciB0aGFuIG9mIGFueSBydW50aW1lCiAqIGZhbGxiYWNrOiBwcmVjYWNoZSB0aGUgc2hlbGwgYW5kIHRoZSBhc3NldHMgb24gaW5zdGFsbCwgc2VydmUgdGhlbSBmcm9tIHRoZQogKiBjYWNoZSBmaXJzdCwgYW5kIHRyZWF0IHRoZSBuZXR3b3JrIGFzIHRoZSB0aGluZyB0aGF0IHJlZnJlc2hlcyB0aGVtIGxhdGVyLgogKgogKiBUaGUgY2FjaGUgbmFtZSBjYXJyaWVzIHRoZSBidWlsZCdzIG93biBhc3NldCBoYXNoZXMsIHNvIGEgbmV3IGRlcGxveW1lbnQKICogbGFuZHMgaW4gYSBuZXcgY2FjaGUgYW5kIHRoZSBvbGQgb25lIGlzIGRlbGV0ZWQgd2hvbGUuIFRoYXQgYXZvaWRzIHRoZQogKiBmYWlsdXJlIG1vZGUgd2hlcmUgYSBzdGFsZSBpbmRleC5odG1sIGlzIHNlcnZlZCBhbG9uZ3NpZGUgZnJlc2ggYXNzZXRzIGl0CiAqIGRvZXMgbm90IGtub3cgdGhlIG5hbWVzIG9mLgogKi8KCi8vIE1ha2luZyB0aGlzIGEgbW9kdWxlIHNjb3BlcyB0aGUgcmVkZWNsYXJhdGlvbiBiZWxvdywgd2hpY2ggaXMgdGhlIHN0YW5kYXJkCi8vIHdheSB0byB0ZWxsIFR5cGVTY3JpcHQgdGhhdCBgc2VsZmAgaGVyZSBpcyBhIHNlcnZpY2Ugd29ya2VyIGFuZCBub3QgYSB3aW5kb3cuCmV4cG9ydCB7fQoKZGVjbGFyZSBjb25zdCBzZWxmOiBTZXJ2aWNlV29ya2VyR2xvYmFsU2NvcGUKCi8vIEluamVjdGVkIGF0IGJ1aWxkIHRpbWU6IGV2ZXJ5IGZpbGUgdGhlIGJ1aWxkIHByb2R1Y2VkLgpkZWNsYXJlIGNvbnN0IF9fUFJFQ0FDSEVfXzogc3RyaW5nW10KZGVjbGFyZSBjb25zdCBfX0JVSUxEX186IHN0cmluZwoKY29uc3QgQ0FDSEUgPSBgaGVsaW9ncmFwaC0ke19fQlVJTERfX31gCgpzZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ2luc3RhbGwnLCAoZXZlbnQpID0+IHsKICBldmVudC53YWl0VW50aWwoCiAgICAoYXN5bmMgKCkgPT4gewogICAgICBjb25zdCBjYWNoZSA9IGF3YWl0IGNhY2hlcy5vcGVuKENBQ0hFKQogICAgICAvLyBPbmUgZmFpbGVkIGFzc2V0IG11c3Qgbm90IGZhaWwgdGhlIHdob2xlIGluc3RhbGwsIHNvIHRoZXkgYXJlIGFkZGVkCiAgICAgIC8vIGluZGl2aWR1YWxseSBhbmQgdGhlIHNoZWxsIGlzIHRoZSBvbmx5IG9uZSB0aGF0IGhhcyB0byBzdWNjZWVkLgogICAgICBhd2FpdCBQcm9taXNlLmFsbCgKICAgICAgICBfX1BSRUNBQ0hFX18ubWFwKGFzeW5jICh1cmwpID0+IHsKICAgICAgICAgIHRyeSB7CiAgICAgICAgICAgIGF3YWl0IGNhY2hlLmFkZChuZXcgUmVxdWVzdCh1cmwsIHsgY2FjaGU6ICdyZWxvYWQnIH0pKQogICAgICAgICAgfSBjYXRjaCB7CiAgICAgICAgICAgIC8vIEEgbWlzc2luZyBvcHRpb25hbCBhc3NldCBpcyBub3Qgd29ydGggcmVmdXNpbmcgdG8gaW5zdGFsbCBvdmVyLgogICAgICAgICAgfQogICAgICAgIH0pLAogICAgICApCiAgICAgIGF3YWl0IHNlbGYuc2tpcFdhaXRpbmcoKQogICAgfSkoKSwKICApCn0pCgpzZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ2FjdGl2YXRlJywgKGV2ZW50KSA9PiB7CiAgZXZlbnQud2FpdFVudGlsKAogICAgKGFzeW5jICgpID0+IHsKICAgICAgZm9yIChjb25zdCBrZXkgb2YgYXdhaXQgY2FjaGVzLmtleXMoKSkgewogICAgICAgIGlmIChrZXkuc3RhcnRzV2l0aCgnaGVsaW9ncmFwaC0nKSAmJiBrZXkgIT09IENBQ0hFKSBhd2FpdCBjYWNoZXMuZGVsZXRlKGtleSkKICAgICAgfQogICAgICBhd2FpdCBzZWxmLmNsaWVudHMuY2xhaW0oKQogICAgfSkoKSwKICApCn0pCgpzZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ2ZldGNoJywgKGV2ZW50KSA9PiB7CiAgY29uc3QgcmVxdWVzdCA9IGV2ZW50LnJlcXVlc3QKICBpZiAocmVxdWVzdC5tZXRob2QgIT09ICdHRVQnKSByZXR1cm4KICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcXVlc3QudXJsKQogIGlmICh1cmwub3JpZ2luICE9PSBzZWxmLmxvY2F0aW9uLm9yaWdpbikgcmV0dXJuCgogIC8vIEEgbmF2aWdhdGlvbiBpcyBhbnN3ZXJlZCB3aXRoIHRoZSBzaGVsbCwgd2hhdGV2ZXIgdGhlIHF1ZXJ5IHN0cmluZyB3YXMsIHNvCiAgLy8gdGhhdCBhIHNoYXJlZCBsaW5rIG9wZW5zIG9mZmxpbmUgZXhhY3RseSBhcyB0aGUgYmFyZSBhZGRyZXNzIGRvZXMuCiAgaWYgKHJlcXVlc3QubW9kZSA9PT0gJ25hdmlnYXRlJykgewogICAgZXZlbnQucmVzcG9uZFdpdGgoCiAgICAgIChhc3luYyAoKSA9PiB7CiAgICAgICAgY29uc3QgY2FjaGUgPSBhd2FpdCBjYWNoZXMub3BlbihDQUNIRSkKICAgICAgICBjb25zdCBjYWNoZWQgPSBhd2FpdCBjYWNoZS5tYXRjaCgnLi9pbmRleC5odG1sJykKICAgICAgICBpZiAoY2FjaGVkKSB7CiAgICAgICAgICAvLyBSZWZyZXNoIGluIHRoZSBiYWNrZ3JvdW5kIHNvIHRoZSBuZXh0IGxhdW5jaCBpcyBjdXJyZW50LgogICAgICAgICAgdm9pZCBmZXRjaChyZXF1ZXN0KQogICAgICAgICAgICAudGhlbihhc3luYyAocmVzcG9uc2UpID0+IHsKICAgICAgICAgICAgICBpZiAocmVzcG9uc2Uub2spIGF3YWl0IGNhY2hlLnB1dCgnLi9pbmRleC5odG1sJywgcmVzcG9uc2UuY2xvbmUoKSkKICAgICAgICAgICAgfSkKICAgICAgICAgICAgLmNhdGNoKCgpID0+IHVuZGVmaW5lZCkKICAgICAgICAgIHJldHVybiBjYWNoZWQKICAgICAgICB9CiAgICAgICAgcmV0dXJuIGZldGNoKHJlcXVlc3QpCiAgICAgIH0pKCksCiAgICApCiAgICByZXR1cm4KICB9CgogIGV2ZW50LnJlc3BvbmRXaXRoKAogICAgKGFzeW5jICgpID0+IHsKICAgICAgY29uc3QgY2FjaGUgPSBhd2FpdCBjYWNoZXMub3BlbihDQUNIRSkKICAgICAgY29uc3QgY2FjaGVkID0gYXdhaXQgY2FjaGUubWF0Y2gocmVxdWVzdCkKICAgICAgaWYgKGNhY2hlZCkgcmV0dXJuIGNhY2hlZAogICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHJlcXVlc3QpCiAgICAgIC8vIEhhc2hlZCBhc3NldHMgbmV2ZXIgY2hhbmdlIHVuZGVyIHRoZWlyIG93biBuYW1lLCBzbyB0aGV5IGFyZSB3b3J0aAogICAgICAvLyBrZWVwaW5nIHRoZSBtb21lbnQgdGhleSBhcmUgZmlyc3QgYXNrZWQgZm9yLgogICAgICBpZiAocmVzcG9uc2Uub2sgJiYgdXJsLnBhdGhuYW1lLmluY2x1ZGVzKCcvYXNzZXRzLycpKSBhd2FpdCBjYWNoZS5wdXQocmVxdWVzdCwgcmVzcG9uc2UuY2xvbmUoKSkKICAgICAgcmV0dXJuIHJlc3BvbnNlCiAgICB9KSgpLAogICkKfSkK",import.meta.url),{scope:"./"}).catch(()=>{})});Wo().catch(i=>{const t=i instanceof Error&&i.message.includes("WebGL2")?"Heliograph needs WebGL2, and this browser did not provide it.":"Heliograph could not start.";_o(t,i)});
