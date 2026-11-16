(function(){
var imgs=[],aidx=-1,zoom=4,drag=null,selectedSeg=null,fullPad=true;
var PV=NinePatchPreview,largePreview=null;
var $=function(s){return document.querySelector(s);};
var il=$('#il'),mc=$('#mc'),vp=$('#vp'),es=$('#es');
var ct=$('#ct'),to=$('#to'),dz=$('#dz'),po=$('#po'),ptx=$('#ptx'),pfl=$('#pfl');
var fi=$('#fi'),fif=$('#fif'),cb43=$('#cb43'),cb50=$('#cb50');
var slLen=$('#slLen'),slVal=$('#slVal');
var modeSingle=$('#modeSingle'),modeMulti=$('#modeMulti'),singleTools=$('#singleTools'),multiTools=$('#multiTools'),editHint=$('#editHint');
var pcW=$('#pcW'),pcH=$('#pcH'),pcWH=$('#pcWH'),pcC=$('#pcC'),pwc=$('#pwc'),phc=$('#phc');
var pcL=$('#pcL'),pvDialog=$('#pvDialog'),pvLarge=$('#pvLarge');
var mctx=mc.getContext('2d'),ctxW=pcW.getContext('2d'),ctxH=pcH.getContext('2d'),ctxWH=pcWH.getContext('2d'),ctxC=pcC.getContext('2d');
var tt;function toast(m){clearTimeout(tt);to.textContent=m;to.classList.add('sh');tt=setTimeout(function(){to.classList.remove('sh');},2000);}
var idc=0;function gid(){return'x'+(++idc);}
function defEdges(w,h,len){len=len||5;var st=new Uint8Array(w),sl=new Uint8Array(h),pb=new Uint8Array(w),pr=new Uint8Array(h);var ts=Math.max(0,Math.floor((w-len)/2));for(var i=0;i<len&&ts+i<w;i++)st[ts+i]=1;var ls=Math.max(0,Math.floor((h-len)/2));for(var i=0;i<len&&ls+i<h;i++)sl[ls+i]=1;for(var i=0;i<w;i++)pb[i]=1;for(var i=0;i<h;i++)pr[i]=1;return{st:st,sl:sl,pb:pb,pr:pr};}
function applySegLenTo(im){var w=im.w,h=im.h,len=im.segLen;im.st.fill(0);im.sl.fill(0);var ts=Math.max(0,Math.floor((w-len)/2));for(var j=0;j<len&&ts+j<w;j++)im.st[ts+j]=1;var ls=Math.max(0,Math.floor((h-len)/2));for(var j=0;j<len&&ls+j<h;j++)im.sl[ls+j]=1;}
function loadImg(f){return new Promise(function(rs,rj){var r=new FileReader();r.onload=function(e){var img=new Image();img.onload=function(){rs({img:img,name:f.name});};img.onerror=function(){rj(Error(f.name));};img.src=e.target.result;};r.onerror=function(){rj(Error(f.name));};r.readAsDataURL(f);});}
function addImgs(fl){var arr=Array.from(fl),added=0;function nx(i){if(i>=arr.length){if(added>0){if(aidx===-1)sel(0);render();}return;}loadImg(arr[i]).then(function(r){var w=r.img.naturalWidth,h=r.img.naturalHeight,d,source=r.img,imported=/\.9\.png$/i.test(r.name);if(imported){var raw=document.createElement('canvas');raw.width=w;raw.height=h;var rc=raw.getContext('2d',{willReadFrequently:true});rc.drawImage(source,0,0);d=PV.readMarkers(rc.getImageData(0,0,w,h).data,w,h);w-=2;h-=2;source=document.createElement('canvas');source.width=w;source.height=h;source.getContext('2d').drawImage(r.img,1,1,w,h,0,0,w,h);source.src=source.toDataURL();}else d=defEdges(w,h,5);var multi=segments(d.st).length>1||segments(d.sl).length>1,defaults=defEdges(w,h,5),len=imported?Math.max(1,...segments(d.st).concat(segments(d.sl)).map(function(s){return s.e-s.s+1;})):5;imgs.push({id:gid(),name:r.name,img:source,w:w,h:h,segLen:len,mode:multi?'multi':'single',imported:imported,st:d.st,sl:d.sl,singleSt:multi?defaults.st:d.st,singleSl:multi?defaults.sl:d.sl,multiSt:multi?d.st:d.st.slice(),multiSl:multi?d.sl:d.sl.slice(),pb:d.pb,pr:d.pr});added++;nx(i+1);}).catch(function(e){toast(arr[i].name+'：'+e.message);nx(i+1);});}nx(0);}
function render(){il.innerHTML=imgs.map(function(im,i){var multi=im.mode==='multi';return'<div class="iitem'+(i===aidx?' ac':'')+'" data-i="'+i+'"><img class="thumb" src="'+im.img.src+'"><div class="info"><div class="name" title="'+im.name+'">'+im.name+'</div><div class="meta"><span class="dim">'+im.w+' x '+im.h+'</span><span class="mode-tag'+(multi?' multi':'')+'">'+(multi?'多段':'单段')+'</span></div></div><button class="rm" data-i="'+i+'">x</button></div>';}).join('');ct.textContent='共 '+imgs.length+' 张';upEs();}
function upEs(){es.style.display=imgs.length===0?'flex':'none';if(imgs.length===0){mc.style.display='none';pcW.style.display='none';pcH.style.display='none';pcWH.style.display='none';pcC.style.display='none';pcL.style.display='none';$('#previewInfo').textContent='导入原图或已有的 .9.png，按实际像素查看';$('#previewWarning').textContent='';if(pvDialog.open)pvDialog.close();}}
function sel(i){aidx=i;selectedSeg=null;render();var im=imgs[aidx],vw=vp.clientWidth-20,vh=vp.clientHeight-20;zoom=Math.max(1,Math.floor(Math.min(vw/(im.w+2),vh/(im.h+2))));slLen.max=Math.max(1,Math.max(im.w,im.h));slLen.value=im.segLen;slVal.textContent=im.segLen;pwc.value=im.w;phc.value=im.h;upModeUI();draw();drawPv();}
function rmImg(i){imgs.splice(i,1);selectedSeg=null;if(imgs.length===0){aidx=-1;mc.style.display='none';pcW.style.display='none';pcH.style.display='none';pcWH.style.display='none';pcC.style.display='none';}else if(aidx>=imgs.length)aidx=imgs.length-1;else if(i<aidx)aidx--;render();upModeUI();if(aidx>=0){draw();drawPv();}}
function chk(ctx,w,h,sz){var a='#2a2a2a',b='#222';for(var y=0;y<h;y+=sz)for(var x=0;x<w;x+=sz){ctx.fillStyle=((x/sz+y/sz)%2===0)?a:b;ctx.fillRect(x,y,sz,sz);}}
function segBounds(arr){var s=-1,e=-1;for(var i=0;i<arr.length;i++){if(arr[i]){if(s===-1)s=i;e=i;}}return{s:s,e:e};}
function segments(arr){var out=[],s=-1;for(var i=0;i<=arr.length;i++){if(i<arr.length&&arr[i]){if(s<0)s=i;}else if(s>=0){out.push({s:s,e:i-1});s=-1;}}return out;}
function segmentAt(arr,pos){var ss=segments(arr);for(var i=0;i<ss.length;i++)if(pos>=ss[i].s&&pos<=ss[i].e)return ss[i];return null;}
function setRange(arr,s,e,v){for(var i=Math.max(0,s);i<=Math.min(arr.length-1,e);i++)arr[i]=v?1:0;}
function upModeUI(){var has=aidx>=0,im=has?imgs[aidx]:null,multi=!!im&&im.mode==='multi';modeSingle.classList.toggle('ac',!multi);modeMulti.classList.toggle('ac',multi);singleTools.style.display=multi?'none':'inline-flex';$('#singleRanges').hidden=!has||multi;multiTools.classList.toggle('sh',multi);editHint.textContent=multi?'每边最多 3 段；3 段时顶边最右段贴右、左边最下段贴底':'拖拽线段调整拉伸区';$('#removeSeg').disabled=!selectedSeg;$('#addTop').disabled=!has||segments(im.st).length>=3;$('#addLeft').disabled=!has||segments(im.sl).length>=3;}
function switchMode(mode){if(aidx<0)return;var im=imgs[aidx];im.mode=mode;if(mode==='multi'){im.st=im.multiSt;im.sl=im.multiSl;}else{im.st=im.singleSt;im.sl=im.singleSl;}selectedSeg=null;render();upModeUI();draw();drawPv();}
function thirdSegmentTouchesEnd(arr){var ss=segments(arr);return ss.length!==3||ss[2].e===arr.length-1;}
function alignThirdSegmentToEnd(arr){var ss=segments(arr);if(ss.length!==3||ss[2].e===arr.length-1)return true;var last=ss[2],len=last.e-last.s+1,target=arr.length-len;setRange(arr,last.s,last.e,0);if(target<=ss[1].e+1){setRange(arr,last.s,last.e,1);return false;}setRange(arr,target,arr.length-1,1);return true;}
function addMultiSegment(axis){if(aidx<0)return;var im=imgs[aidx],arr=axis==='st'?im.st:im.sl;if(segments(arr).length>=3){toast('每条边最多只能有 3 段');return;}var runs=[],s=-1;for(var i=0;i<=arr.length;i++){if(i<arr.length&&!arr[i]){if(s<0)s=i;}else if(s>=0){var a=s,b=i-1;if(a>0)a++;if(b<arr.length-1)b--;if(a<=b)runs.push({s:a,e:b,len:b-a+1});s=-1;}}if(!runs.length){toast('没有足够空间添加新线段');return;}runs.sort(function(a,b){return b.len-a.len;});var r=runs[0],len=Math.min(im.segLen,r.len),ns=r.s+Math.floor((r.len-len)/2);setRange(arr,ns,ns+len-1,1);if(!alignThirdSegmentToEnd(arr)){setRange(arr,ns,ns+len-1,0);toast('无法添加第 3 段：请先为贴边线段留出空间');return;}var ss=segments(arr),picked=segmentAt(arr,ns)||ss[ss.length-1];selectedSeg={im:im,axis:axis,start:picked.s};upModeUI();draw();drawPv();}
function removeSelectedSegment(){if(!selectedSeg||aidx<0||selectedSeg.im!==imgs[aidx])return;var arr=selectedSeg.axis==='st'?selectedSeg.im.st:selectedSeg.im.sl,sg=segmentAt(arr,selectedSeg.start);if(!sg)return;setRange(arr,sg.s,sg.e,0);selectedSeg=null;upModeUI();draw();drawPv();}
function draw(){
if(aidx<0){mc.style.display='none';return;}
var im=imgs[aidx],w=im.w,h=im.h,cw=(w+2)*zoom,ch=(h+2)*zoom;
if(im.mode==='single'){[['top',im.st],['left',im.sl]].forEach(function(item){var bounds=segBounds(item[1]);['Start','End'].forEach(function(end){var input=$('#'+item[0]+end);input.max=item[1].length;input.value=bounds.s<0?'':(end==='Start'?bounds.s:bounds.e)+1;});});}
mc.width=cw;mc.height=ch;mc.style.display='block';mc.style.width=cw+'px';mc.style.height=ch+'px';
var ctx=mctx;ctx.clearRect(0,0,cw,ch);chk(ctx,cw,ch,zoom);
ctx.drawImage(im.img,zoom,zoom,w*zoom,h*zoom);
var topSegs=segments(im.st),leftSegs=segments(im.sl);
ctx.fillStyle='#ff4444';
for(var si=0;si<topSegs.length;si++)ctx.fillRect((topSegs[si].s+1)*zoom,0,(topSegs[si].e-topSegs[si].s+1)*zoom,zoom);
for(var si=0;si<leftSegs.length;si++)ctx.fillRect(0,(leftSegs[si].s+1)*zoom,zoom,(leftSegs[si].e-leftSegs[si].s+1)*zoom);
ctx.fillStyle='#4ecdc4';
ctx.fillRect(zoom,(h+1)*zoom,w*zoom,zoom);ctx.fillRect((w+1)*zoom,zoom,zoom,h*zoom);
if(fullPad){ctx.fillRect((w+1)*zoom,0,zoom,zoom);ctx.fillRect(0,(h+1)*zoom,zoom,zoom);ctx.fillRect((w+1)*zoom,(h+1)*zoom,zoom,zoom);}
ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=1;
for(var si=0;si<topSegs.length;si++)ctx.strokeRect((topSegs[si].s+1)*zoom,0,(topSegs[si].e-topSegs[si].s+1)*zoom,zoom);
for(var si=0;si<leftSegs.length;si++)ctx.strokeRect(0,(leftSegs[si].s+1)*zoom,zoom,(leftSegs[si].e-leftSegs[si].s+1)*zoom);
if(selectedSeg&&selectedSeg.im===im){var sa=selectedSeg.axis==='st'?im.st:im.sl,ss=segmentAt(sa,selectedSeg.start);if(ss){ctx.strokeStyle='#ffd166';ctx.lineWidth=2;if(selectedSeg.axis==='st')ctx.strokeRect((ss.s+1)*zoom+1,1,(ss.e-ss.s+1)*zoom-2,zoom-2);else ctx.strokeRect(1,(ss.s+1)*zoom+1,zoom-2,(ss.e-ss.s+1)*zoom-2);}}
ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1;
ctx.beginPath();ctx.moveTo(0,zoom);ctx.lineTo(cw,zoom);ctx.moveTo(0,(h+1)*zoom);ctx.lineTo(cw,(h+1)*zoom);ctx.stroke();
ctx.beginPath();ctx.moveTo(zoom,0);ctx.lineTo(zoom,ch);ctx.moveTo((w+1)*zoom,0);ctx.lineTo((w+1)*zoom,ch);ctx.stroke();
ctx.fillStyle='rgba(255,255,255,0.15)';
for(var x=0;x<w;x++)if(!im.st[x])ctx.fillRect((x+1)*zoom,0,zoom,zoom);
for(var y=0;y<h;y++)if(!im.sl[y])ctx.fillRect(0,(y+1)*zoom,zoom,zoom);}
function bseg(sz,on){var seg=[],st=0;for(var i=0;i<=sz;i++){if(i===sz||on[i]!==(i>0?on[i-1]:0)){if(i>st)seg.push({s:st,e:i,stretch:on[st]===1});st=i;}}if(seg.length===0)seg.push({s:0,e:sz,stretch:false});return seg;}
function drawPv(){
if(aidx<0){pcW.style.display='none';pcH.style.display='none';pcWH.style.display='none';pcC.style.display='none';pcL.style.display='none';return;}
var im=imgs[aidx],w=im.w,h=im.h;
renderPv(ctxW,pcW,im,w*2,h);
renderPv(ctxH,pcH,im,w,h*2);
renderPv(ctxWH,pcWH,im,w*2,h*2);
renderPv(pcL.getContext('2d'),pcL,im,w*3,Math.round(h*.65));
renderPv(ctxC,pcC,im,PV.size(pwc.value,w),PV.size(phc.value,h));
var fixedW=w-im.st.reduce(function(a,b){return a+b;},0),fixedH=h-im.sl.reduce(function(a,b){return a+b;},0);
$('#previewInfo').textContent=(im.imported?'已读取原点九标记':'原图')+' '+w+' × '+h+' px；固定区合计 '+fixedW+' × '+fixedH+' px。预览按 1:1 显示，可滚动、点击放大。';
$('#previewWarning').textContent=(previewWarning(im,pcL.width,pcL.height,'横屏模拟')+' '+previewWarning(im,pcC.width,pcC.height,'自定义')).trim();
if(pvDialog.open)drawLarge();}
function previewWarning(im,tw,th,label){var x=PV.axis(im.st,tw),y=PV.axis(im.sl,th),messages=[];if(y.collapsed)messages.push('高度 '+th+' ≤ 上下固定区 '+y.fixed+'，纵向拉伸带被压没，可能出现横向接缝');if(x.collapsed)messages.push('宽度 '+tw+' ≤ 左右固定区 '+x.fixed+'，横向拉伸带被压没，可能出现纵向接缝');return messages.length?label+'：'+messages.join('；')+'。':'';}
function renderPv(ctx,cv,im,tw,th){tw=PV.size(tw,im.w);th=PV.size(th,im.h);cv.width=tw;cv.height=th;cv.style.display='block';ctx.clearRect(0,0,tw,th);var background=$('#pvBackground').value;if(background==='checker')chk(ctx,tw,th,8);else{ctx.fillStyle=background;ctx.fillRect(0,0,tw,th);}npv(ctx,im,tw,th);if(cv.id!=='pvLarge'){var label=cv.closest('.pv-item').querySelector('.pv-size');label.textContent=tw+' × '+th+' px · 点击放大';}}
function npv(ctx,im,tw,th){var layout=PV.draw(ctx,im.img,im.st,im.sl,tw,th,$('#pvSmooth').checked);if(!$('#pvContent').checked)return;var px=segBounds(im.pb),py=segBounds(im.pr);if(px.s<0||py.s<0)return;var x1=PV.coordinate(px.s,layout.x),x2=PV.coordinate(px.e+1,layout.x),y1=PV.coordinate(py.s,layout.y),y2=PV.coordinate(py.e+1,layout.y);ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(x1,y1,x2-x1,y2-y1);ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.setLineDash([4,4]);ctx.strokeRect(x1,y1,x2-x1,y2-y1);ctx.setLineDash([]);}
function drawLarge(){if(aidx<0||!largePreview)return;var im=imgs[aidx],scale=Number($('#pvLargeScale').value);renderPv(pvLarge.getContext('2d'),pvLarge,im,largePreview.width,largePreview.height);pvLarge.style.width=pvLarge.width*scale+'px';pvLarge.style.height=pvLarge.height*scale+'px';pvLarge.style.imageRendering=scale===1?'auto':'pixelated';$('#pvLargeTitle').textContent=largePreview.label+' · '+pvLarge.width+' × '+pvLarge.height+' px';$('#pvLargeWarning').textContent=previewWarning(im,pvLarge.width,pvLarge.height,'当前尺寸');}
function hitTopEdge(bx,by,w){return by>=-3&&by<=3&&bx>=1&&bx<=w;}
function hitLeftEdge(bx,by,h){return bx>=-3&&bx<=3&&by>=1&&by<=h;}
mc.addEventListener('mousedown',function(e){if(aidx<0)return;var r=mc.getBoundingClientRect(),cx=e.clientX-r.left,cy=e.clientY-r.top;var bx=Math.floor(cx/zoom),by=Math.floor(cy/zoom);var im=imgs[aidx],w=im.w,h=im.h,axis=null,pos=-1;if(hitTopEdge(bx,by,w)){axis='st';pos=bx-1;}else if(hitLeftEdge(bx,by,h)){axis='sl';pos=by-1;}if(!axis)return;if(im.mode==='single'){drag={axis:axis,im:im,w:w,h:h,single:true};return;}var arr=axis==='st'?im.st:im.sl,sg=segmentAt(arr,pos);if(!sg){selectedSeg=null;upModeUI();draw();return;}selectedSeg={im:im,axis:axis,start:sg.s};drag={axis:axis,im:im,w:w,h:h,start:sg.s,len:sg.e-sg.s+1,offset:pos-sg.s,single:false};upModeUI();draw();});
function validStart(arr,len,wanted){var max=arr.length-len;if(max<0)return-1;wanted=Math.max(0,Math.min(max,wanted));for(var d=0;d<=arr.length;d++){var opts=d===0?[wanted]:[wanted-d,wanted+d];for(var oi=0;oi<opts.length;oi++){var s=opts[oi];if(s<0||s>max)continue;var ok=true;if(s>0&&arr[s-1])ok=false;if(s+len<arr.length&&arr[s+len])ok=false;for(var j=0;ok&&j<len;j++)if(arr[s+j])ok=false;if(ok)return s;}}return-1;}
function moveSegment(im,axis,cx,cy,w,h){
var arr=axis==='st'?im.st:im.sl,size=axis==='st'?w:h,pos=(axis==='st'?Math.floor(cx/zoom):Math.floor(cy/zoom))-1;
if(drag.single){var old=segBounds(arr),len=Math.min(old.s>=0?old.e-old.s+1:im.segLen||5,size),ns=Math.max(0,Math.min(size-len,pos-Math.floor(len/2)));arr.fill(0);setRange(arr,ns,ns+len-1,1);return;}
var before=segments(arr),oldStart=drag.start,pinned=before.length===3&&before[2].s===oldStart;
setRange(arr,oldStart,oldStart+drag.len-1,0);
var wanted=pinned?size-drag.len:pos-drag.offset,ns=validStart(arr,drag.len,wanted);if(ns<0)ns=oldStart;
setRange(arr,ns,ns+drag.len-1,1);
if(!thirdSegmentTouchesEnd(arr)){setRange(arr,ns,ns+drag.len-1,0);ns=oldStart;setRange(arr,ns,ns+drag.len-1,1);}
drag.start=ns;selectedSeg.start=ns;}
mc.addEventListener('mousemove',function(e){if(!drag)return;var r=mc.getBoundingClientRect(),cx=e.clientX-r.left,cy=e.clientY-r.top;moveSegment(drag.im,drag.axis,cx,cy,drag.w,drag.h);draw();drawPv();});
window.addEventListener('mouseup',function(){if(drag){drag=null;draw();}});
mc.addEventListener('contextmenu',function(e){if(aidx<0||imgs[aidx].mode!=='multi')return;e.preventDefault();var r=mc.getBoundingClientRect(),bx=Math.floor((e.clientX-r.left)/zoom),by=Math.floor((e.clientY-r.top)/zoom),im=imgs[aidx],axis=null,pos=-1;if(hitTopEdge(bx,by,im.w)){axis='st';pos=bx-1;}else if(hitLeftEdge(bx,by,im.h)){axis='sl';pos=by-1;}if(!axis)return;var arr=axis==='st'?im.st:im.sl,sg=segmentAt(arr,pos);if(sg){selectedSeg={im:im,axis:axis,start:sg.s};removeSelectedSegment();}});
function resetDefault(im){var d=defEdges(im.w,im.h,im.segLen);if(im.mode==='multi'){im.multiSt=d.st;im.multiSl=d.sl;im.st=im.multiSt;im.sl=im.multiSl;}else{im.singleSt=d.st;im.singleSl=d.sl;im.st=im.singleSt;im.sl=im.singleSl;}im.pb=d.pb;im.pr=d.pr;selectedSeg=null;upModeUI();}
function edgeRuleError(im){var x=segments(im.st).length,y=segments(im.sl).length;if(!x&&!y)return'至少需要一条黑色拉伸线段';if(x>3||y>3)return'每条边最多只能有 3 段';if(!thirdSegmentTouchesEnd(im.st))return'顶边有 3 段时，最右线段必须贴右边';if(!thirdSegmentTouchesEnd(im.sl))return'左边有 3 段时，最下线段必须贴底边';return'';}
function genPNG(im){var w=im.w,h=im.h,tw=w+2,th=h+2,c=document.createElement('canvas');c.width=tw;c.height=th;var ctx=c.getContext('2d');ctx.clearRect(0,0,tw,th);ctx.drawImage(im.img,1,1);ctx.fillStyle='#000';for(var x=0;x<w;x++)if(im.st[x])ctx.fillRect(x+1,0,1,1);for(var y=0;y<h;y++)if(im.sl[y])ctx.fillRect(0,y+1,1,1);for(var x=0;x<w;x++)if(im.pb[x])ctx.fillRect(x+1,h+1,1,1);for(var y=0;y<h;y++)if(im.pr[y])ctx.fillRect(w+1,y+1,1,1);if(fullPad){ctx.fillRect(w+1,0,1,1);ctx.fillRect(0,h+1,1,1);ctx.fillRect(w+1,h+1,1,1);}return c;}
function dl(cv,fn){return new Promise(function(rs){cv.toBlob(function(b){var u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=fn;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);setTimeout(rs,100);},'image/png');});}
function en(n){return n.replace(/(?:\.9)?\.[^.]+$/i,'')+'.9.png';}
function expCur(){if(aidx<0){toast('请先选择图片');return;}var im=imgs[aidx],err=edgeRuleError(im);if(err){toast(err);return;}dl(genPNG(im),en(im.name)).then(function(){toast('已导出: '+en(im.name));});}
function expAll(){
if(imgs.length===0){toast('没有图片可导出');return;}
for(var vi=0;vi<imgs.length;vi++){var verr=edgeRuleError(imgs[vi]);if(verr){toast(imgs[vi].name+'：'+verr);return;}}
po.classList.add('ac');pfl.style.width='0%';ptx.textContent='准备中...';
var ver=fullPad?'4.3':'5.0';
var dt=new Date();
var ymd=dt.getFullYear()+('0'+(dt.getMonth()+1)).slice(-2)+('0'+dt.getDate()).slice(-2);
var zipName=ver+'点九导出'+ymd+'.zip';
var doZip=function(){
var zip=new JSZip(),total=imgs.length,done=0;
for(var i=0;i<total;i++){(function(idx){
var im=imgs[idx],c=genPNG(im);
c.toBlob(function(b){zip.file(en(im.name),b);done++;pfl.style.width=((done/total)*100)+'%';ptx.textContent='打包 '+done+'/'+total;
if(done===total){zip.generateAsync({type:'blob'}).then(function(zb){var u=URL.createObjectURL(zb),a=document.createElement('a');a.href=u;a.download=zipName;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);po.classList.remove('ac');toast('成功导出 '+total+' 张点九图');});}}, 'image/png');
})(i);}
};
if(window.JSZip){doZip();}else{var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';s.onload=doZip;document.head.appendChild(s);}
}
$('#bi').addEventListener('click',function(){fi.click();});$('#bif').addEventListener('click',function(){fif.click();});
fi.addEventListener('change',function(e){addImgs(e.target.files);fi.value='';});fif.addEventListener('change',function(e){addImgs(e.target.files);fif.value='';});
$('#bcl').addEventListener('click',function(){imgs=[];aidx=-1;selectedSeg=null;render();mc.style.display='none';pcW.style.display='none';pcH.style.display='none';pcWH.style.display='none';pcC.style.display='none';upEs();upModeUI();});
$('#bea').addEventListener('click',expAll);$('#bec').addEventListener('click',expCur);
$('#bce').addEventListener('click',function(){if(aidx<0)return;resetDefault(imgs[aidx]);draw();drawPv();toast('已重置为默认');});
modeSingle.addEventListener('click',function(){switchMode('single');});
modeMulti.addEventListener('click',function(){switchMode('multi');});
$('#addTop').addEventListener('click',function(){addMultiSegment('st');});
$('#addLeft').addEventListener('click',function(){addMultiSegment('sl');});
$('#removeSeg').addEventListener('click',removeSelectedSegment);
il.addEventListener('click',function(e){var it=e.target.closest('.iitem');if(!it)return;var i=parseInt(it.dataset.i);if(e.target.closest('.rm'))rmImg(i);else sel(i);});
$('#bzi').addEventListener('click',function(){zoom=Math.min(zoom*2,32);draw();});$('#bzo').addEventListener('click',function(){zoom=Math.max(Math.floor(zoom/2),1);draw();});
$('#bzf').addEventListener('click',function(){if(aidx<0)return;var im=imgs[aidx],vw=vp.clientWidth-20,vh=vp.clientHeight-20;zoom=Math.max(1,Math.floor(Math.min(vw/(im.w+2),vh/(im.h+2))));draw();});
document.addEventListener('dragover',function(e){e.preventDefault();dz.classList.add('ac');});
dz.addEventListener('dragleave',function(e){if(e.target===dz)dz.classList.remove('ac');});
document.addEventListener('drop',function(e){e.preventDefault();dz.classList.remove('ac');if(e.dataTransfer.files.length>0)addImgs(e.dataTransfer.files);});
function setVer(v){fullPad=(v==='43');cb43.checked=(v==='43');cb50.checked=(v==='50');draw();drawPv();}
cb43.addEventListener('change',function(){if(cb43.checked)setVer('43');else cb43.checked=true;});
cb50.addEventListener('change',function(){if(cb50.checked)setVer('50');else cb50.checked=true;});
slLen.addEventListener('input',function(){if(aidx<0)return;var im=imgs[aidx];im.segLen=parseInt(slLen.value);slVal.textContent=im.segLen;if(im.mode==='single')applySegLenTo(im);draw();drawPv();});
['top','left'].forEach(function(prefix){['Start','End'].forEach(function(end){$('#'+prefix+end).addEventListener('change',function(){if(aidx<0||imgs[aidx].mode!=='single')return;var im=imgs[aidx],arr=prefix==='top'?im.st:im.sl,s=Number($('#'+prefix+'Start').value),e=Number($('#'+prefix+'End').value);if(!Number.isInteger(s)||!Number.isInteger(e)||s<1||e<s||e>arr.length){toast('请输入 1～'+arr.length+' 内的起止位置，终点不能小于起点');draw();return;}arr.fill(0);setRange(arr,s-1,e-1,1);draw();drawPv();});});});
pwc.addEventListener('input',drawPv);
phc.addEventListener('input',drawPv);
['pvBackground','pvSmooth','pvContent'].forEach(function(id){$('#'+id).addEventListener('change',drawPv);});
$('#pvLargeScale').addEventListener('change',drawLarge);
$('#pvClose').addEventListener('click',function(){pvDialog.close();});
$('#landscapeSize').addEventListener('click',function(){if(aidx<0)return;pwc.value=PV.size(imgs[aidx].w*3,imgs[aidx].w);phc.value=PV.size(imgs[aidx].h*.65,imgs[aidx].h);drawPv();});
[pcW,pcH,pcWH,pcL,pcC].forEach(function(canvas){canvas.addEventListener('click',function(){if(aidx<0)return;largePreview={width:canvas.width,height:canvas.height,label:canvas.closest('.pv-item').querySelector('.pv-label').textContent};$('#pvLargeScale').value='2';pvDialog.showModal();drawLarge();});canvas.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();canvas.click();}});});
document.addEventListener('keydown',function(e){if(e.ctrlKey&&e.key==='e'){e.preventDefault();expAll();}else if(e.ctrlKey&&e.key==='s'){e.preventDefault();expCur();}else if(e.ctrlKey&&e.key==='o'){e.preventDefault();fi.click();}else if((e.key==='+'||e.key==='=')&&e.ctrlKey){e.preventDefault();zoom=Math.min(zoom*2,32);draw();}else if(e.key==='-'&&e.ctrlKey){e.preventDefault();zoom=Math.max(Math.floor(zoom/2),1);draw();}});
upEs();upModeUI();})();
