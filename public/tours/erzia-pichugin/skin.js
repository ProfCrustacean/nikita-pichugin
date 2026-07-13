// Garden Gnome Software - Skin
// Pano2VR pro 4.5.0/10633
// Filename: maksbob-without-thumbnails-01.ggsk
// Generated Ср 28. дек 21:04:31 2016

function pano2vrSkin(player,base) {
	var me=this;
	var flag=false;
	var nodeMarker=new Array();
	var activeNodeMarker=new Array();
	this.player=player;
	this.player.skinObj=this;
	this.divSkin=player.divSkin;
	var basePath="";
	// auto detect base path
	if (base=='?') {
		var scripts = document.getElementsByTagName('script');
		for(var i=0;i<scripts.length;i++) {
			var src=scripts[i].src;
			if (src.indexOf('skin.js')>=0) {
				var p=src.lastIndexOf('/');
				if (p>=0) {
					basePath=src.substr(0,p+1);
				}
			}
		}
	} else
	if (base) {
		basePath=base;
	}
	this.elementMouseDown=new Array();
	this.elementMouseOver=new Array();
	var cssPrefix='';
	var domTransition='transition';
	var domTransform='transform';
	var prefixes='Webkit,Moz,O,ms,Ms'.split(',');
	var i;
	for(i=0;i<prefixes.length;i++) {
		if (typeof document.body.style[prefixes[i] + 'Transform'] !== 'undefined') {
			cssPrefix='-' + prefixes[i].toLowerCase() + '-';
			domTransition=prefixes[i] + 'Transition';
			domTransform=prefixes[i] + 'Transform';
		}
	}
	
	this.player.setMargins(0,0,0,0);
	
	this.updateSize=function(startElement) {
		var stack=new Array();
		stack.push(startElement);
		while(stack.length>0) {
			e=stack.pop();
			if (e.ggUpdatePosition) {
				e.ggUpdatePosition();
			}
			if (e.hasChildNodes()) {
				for(i=0;i<e.childNodes.length;i++) {
					stack.push(e.childNodes[i]);
				}
			}
		}
	}
	
	parameterToTransform=function(p) {
		var hs='translate(' + p.rx + 'px,' + p.ry + 'px) rotate(' + p.a + 'deg) scale(' + p.sx + ',' + p.sy + ')';
		return hs;
	}
	
	this.findElements=function(id,regex) {
		var r=new Array();
		var stack=new Array();
		var pat=new RegExp(id,'');
		stack.push(me.divSkin);
		while(stack.length>0) {
			e=stack.pop();
			if (regex) {
				if (pat.test(e.ggId)) r.push(e);
			} else {
				if (e.ggId==id) r.push(e);
			}
			if (e.hasChildNodes()) {
				for(i=0;i<e.childNodes.length;i++) {
					stack.push(e.childNodes[i]);
				}
			}
		}
		return r;
	}
	
	this.preloadImages=function() {
		var preLoadImg=new Image();
		preLoadImg.src=basePath + 'images/fullscreenbutton__o.png';
		preLoadImg.src=basePath + 'images/fullscreenbutton__a.png';
		preLoadImg.src=basePath + 'images/zoomout__o.png';
		preLoadImg.src=basePath + 'images/zoomout__a.png';
		preLoadImg.src=basePath + 'images/zoomin__o.png';
		preLoadImg.src=basePath + 'images/zoomin__a.png';
		preLoadImg.src=basePath + 'images/hidemarkers__o.png';
		preLoadImg.src=basePath + 'images/hidemarkers__a.png';
	}
	
	this.addSkin=function() {
		this._loading=document.createElement('div');
		this._loading.ggId="loading";
		this._loading.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
		this._loading.ggVisible=true;
		this._loading.className='ggskin ggskin_container';
		this._loading.ggType='container';
		this._loading.ggUpdatePosition=function() {
			this.style[domTransition]='none';
			if (this.parentNode) {
				w=this.parentNode.offsetWidth;
				this.style.left=(-77 + w/2) + 'px';
				h=this.parentNode.offsetHeight;
				this.style.top=(-23 + h/2) + 'px';
			}
		}
		hs ='position:absolute;';
		hs+='left: -77px;';
		hs+='top:  -23px;';
		hs+='width: 210px;';
		hs+='height: 60px;';
		hs+=cssPrefix + 'transform-origin: 50% 50%;';
		hs+='visibility: inherit;';
		this._loading.setAttribute('style',hs);
		this._loading.onclick=function () {
			me._loading.style[domTransition]='none';
			me._loading.style.visibility='hidden';
			me._loading.ggVisible=false;
		}
		this._start=document.createElement('div');
		this._start.ggId="start";
		this._start.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
		this._start.ggVisible=true;
		this._start.className='ggskin ggskin_image';
		this._start.ggType='image';
		hs ='position:absolute;';
		hs+='left: -139px;';
		hs+='top:  -97px;';
		hs+='width: 431px;';
		hs+='height: 219px;';
		hs+=cssPrefix + 'transform-origin: 50% 50%;';
		hs+='visibility: inherit;';
		this._start.setAttribute('style',hs);
		this._start__img=document.createElement('img');
		this._start__img.className='ggskin ggskin_image';
		this._start__img.setAttribute('src',basePath + 'images/start.png');
		this._start__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
		this._start__img.className='ggskin ggskin_image';
		this._start__img['ondragstart']=function() { return false; };
		me.player.checkLoaded.push(this._start__img);
		this._start.appendChild(this._start__img);
		this._loading.appendChild(this._start);
		this._loadingtext=document.createElement('div');
		this._loadingtext__text=document.createElement('div');
		this._loadingtext.className='ggskin ggskin_textdiv';
		this._loadingtext.ggTextDiv=this._loadingtext__text;
		this._loadingtext.ggId="loadingtext";
		this._loadingtext.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
		this._loadingtext.ggVisible=true;
		this._loadingtext.className='ggskin ggskin_text';
		this._loadingtext.ggType='text';
		this._loadingtext.ggUpdatePosition=function() {
			this.style[domTransition]='none';
			this.style.width=this.ggTextDiv.offsetWidth + 'px';
			this.style.height=this.ggTextDiv.offsetHeight + 'px';
			this.ggTextDiv.style.left=(0 + (176-this.ggTextDiv.offsetWidth)/2) + 'px';
		}
		hs ='position:absolute;';
		hs+='left: 19px;';
		hs+='top:  38px;';
		hs+='width: 176px;';
		hs+='height: 23px;';
		hs+=cssPrefix + 'transform-origin: 50% 50%;';
		hs+='visibility: inherit;';
		this._loadingtext.setAttribute('style',hs);
		hs ='position:absolute;';
		hs+='left: 0px;';
		hs+='top:  0px;';
		hs+='width: auto;';
		hs+='height: auto;';
		hs+='border: 0px solid #000000;';
		hs+='color: #ffffff;';
		hs+='text-align: left;';
		hs+='white-space: nowrap;';
		hs+='padding: 0px 1px 0px 1px;';
		hs+='overflow: hidden;';
		this._loadingtext__text.setAttribute('style',hs);
		this._loadingtext.ggUpdateText=function() {
			var hs="\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442\u0441\u044f... "+(me.player.getPercentLoaded()*100.0).toFixed(0)+"%";
			if (hs!=this.ggText) {
				this.ggText=hs;
				this.ggTextDiv.innerHTML=hs;
			}
		this.ggUpdatePosition();
		}
		this._loadingtext.ggUpdateText();
		this._loadingtext.appendChild(this._loadingtext__text);
		this._loading.appendChild(this._loadingtext);
		this._rectangle_66=document.createElement('div');
		this._rectangle_66.ggId="Rectangle 66";
		this._rectangle_66.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:0.4 };
		this._rectangle_66.ggVisible=true;
		this._rectangle_66.className='ggskin ggskin_rectangle';
		this._rectangle_66.ggType='rectangle';
		hs ='position:absolute;';
		hs+='left: -73px;';
		hs+='top:  57px;';
		hs+='width: 300px;';
		hs+='height: 6px;';
		hs+=cssPrefix + 'transform-origin: 50% 50%;';
		hs+=cssPrefix + 'transform: ' + parameterToTransform(this._rectangle_66.ggParameter) + ';';
		hs+='visibility: inherit;';
		hs+='background: #ffffff;';
		hs+='border: 0px solid #000000;';
		this._rectangle_66.setAttribute('style',hs);
		this._loading.appendChild(this._rectangle_66);
		this.divSkin.appendChild(this._loading);
		this._fullscreenzoom=document.createElement('div');
		this._fullscreenzoom.ggId="fullscreen-zoom";
		this._fullscreenzoom.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
		this._fullscreenzoom.ggVisible=true;
		this._fullscreenzoom.className='ggskin ggskin_container';
		this._fullscreenzoom.ggType='container';
		this._fullscreenzoom.ggUpdatePosition=function() {
			this.style[domTransition]='none';
			if (this.parentNode) {
				w=this.parentNode.offsetWidth;
				this.style.left=(-1 + w) + 'px';
			}
		}
		hs ='position:absolute;';
		hs+='left: -1px;';
		hs+='top:  1px;';
		hs+='width: 10px;';
		hs+='height: 10px;';
		hs+=cssPrefix + 'transform-origin: 50% 50%;';
		hs+='visibility: inherit;';
		this._fullscreenzoom.setAttribute('style',hs);
		this._zoominhint=document.createElement('div');
		this._zoominhint.ggId="zoomin-hint";
		this._zoominhint.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
		this._zoominhint.ggVisible=true;
		this._zoominhint.className='ggskin ggskin_image';
		this._zoominhint.ggType='image';
		hs ='position:absolute;';
		hs+='left: -193px;';
		hs+='top:  28px;';
		hs+='width: 169px;';
		hs+='height: 86px;';
		hs+=cssPrefix + 'transform-origin: 50% 50%;';
		hs+='visibility: inherit;';
		this._zoominhint.setAttribute('style',hs);
		this._zoominhint__img=document.createElement('img');
		this._zoominhint__img.className='ggskin ggskin_image';
		this._zoominhint__img.setAttribute('src',basePath + 'images/zoominhint.png');
		this._zoominhint__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
		this._zoominhint__img.className='ggskin ggskin_image';
		this._zoominhint__img['ondragstart']=function() { return false; };
		me.player.checkLoaded.push(this._zoominhint__img);
		this._zoominhint.appendChild(this._zoominhint__img);
		this._fullscreenzoom.appendChild(this._zoominhint);
		this._zoomouthint=document.createElement('div');
		this._zoomouthint.ggId="zoomout-hint";
		this._zoomouthint.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
		this._zoomouthint.ggVisible=true;
		this._zoomouthint.className='ggskin ggskin_image';
		this._zoomouthint.ggType='image';
		hs ='position:absolute;';
		hs+='left: -152px;';
		hs+='top:  28px;';
		hs+='width: 169px;';
		hs+='height: 86px;';
		hs+=cssPrefix + 'transform-origin: 50% 50%;';
		hs+='visibility: inherit;';
		this._zoomouthint.setAttribute('style',hs);
		this._zoomouthint__img=document.createElement('img');
		this._zoomouthint__img.className='ggskin ggskin_image';
		this._zoomouthint__img.setAttribute('src',basePath + 'images/zoomouthint.png');
		this._zoomouthint__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
		this._zoomouthint__img.className='ggskin ggskin_image';
		this._zoomouthint__img['ondragstart']=function() { return false; };
		me.player.checkLoaded.push(this._zoomouthint__img);
		this._zoomouthint.appendChild(this._zoomouthint__img);
		this._fullscreenzoom.appendChild(this._zoomouthint);
		this._markerhint=document.createElement('div');
		this._markerhint.ggId="marker-hint";
		this._markerhint.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
		this._markerhint.ggVisible=true;
		this._markerhint.className='ggskin ggskin_image';
		this._markerhint.ggType='image';
		hs ='position:absolute;';
		hs+='left: -257px;';
		hs+='top:  30px;';
		hs+='width: 224px;';
		hs+='height: 81px;';
		hs+=cssPrefix + 'transform-origin: 50% 50%;';
		hs+='visibility: inherit;';
		this._markerhint.setAttribute('style',hs);
		this._markerhint__img=document.createElement('img');
		this._markerhint__img.className='ggskin ggskin_image';
		this._markerhint__img.setAttribute('src',basePath + 'images/markerhint.png');
		this._markerhint__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
		this._markerhint__img.className='ggskin ggskin_image';
		this._markerhint__img['ondragstart']=function() { return false; };
		me.player.checkLoaded.push(this._markerhint__img);
		this._markerhint.appendChild(this._markerhint__img);
		this._fullscreenzoom.appendChild(this._markerhint);
		this._fullscreenhint=document.createElement('div');
		this._fullscreenhint.ggId="fullscreen-hint";
		this._fullscreenhint.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
		this._fullscreenhint.ggVisible=true;
		this._fullscreenhint.className='ggskin ggskin_image';
		this._fullscreenhint.ggType='image';
		hs ='position:absolute;';
		hs+='left: -237px;';
		hs+='top:  28px;';
		hs+='width: 264px;';
		hs+='height: 96px;';
		hs+=cssPrefix + 'transform-origin: 50% 50%;';
		hs+='visibility: inherit;';
		this._fullscreenhint.setAttribute('style',hs);
		this._fullscreenhint__img=document.createElement('img');
		this._fullscreenhint__img.className='ggskin ggskin_image';
		this._fullscreenhint__img.setAttribute('src',basePath + 'images/fullscreenhint.png');
		this._fullscreenhint__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
		this._fullscreenhint__img.className='ggskin ggskin_image';
		this._fullscreenhint__img['ondragstart']=function() { return false; };
		me.player.checkLoaded.push(this._fullscreenhint__img);
		this._fullscreenhint.appendChild(this._fullscreenhint__img);
		this._fullscreenzoom.appendChild(this._fullscreenhint);
		this._fullscreenbutton=document.createElement('div');
		this._fullscreenbutton.ggId="fullscreen-button";
		this._fullscreenbutton.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
		this._fullscreenbutton.ggVisible=true;
		this._fullscreenbutton.className='ggskin ggskin_button';
		this._fullscreenbutton.ggType='button';
		hs ='position:absolute;';
		hs+='left: -43px;';
		hs+='top:  0px;';
		hs+='width: 43px;';
		hs+='height: 43px;';
		hs+=cssPrefix + 'transform-origin: 50% 50%;';
		hs+='visibility: inherit;';
		hs+='cursor: pointer;';
		this._fullscreenbutton.setAttribute('style',hs);
		this._fullscreenbutton__img=document.createElement('img');
		this._fullscreenbutton__img.className='ggskin ggskin_button';
		this._fullscreenbutton__img.setAttribute('src',basePath + 'images/fullscreenbutton.png');
		this._fullscreenbutton__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
		this._fullscreenbutton__img.className='ggskin ggskin_button';
		this._fullscreenbutton__img['ondragstart']=function() { return false; };
		me.player.checkLoaded.push(this._fullscreenbutton__img);
		this._fullscreenbutton.appendChild(this._fullscreenbutton__img);
		this._fullscreenbutton.onclick=function () {
			me.player.toggleFullscreen();
		}
		this._fullscreenbutton.onmouseover=function () {
			me._fullscreenbutton__img.src=basePath + 'images/fullscreenbutton__o.png';
			me._fullscreenbutton.ggIsOver=true;
			me.elementMouseOver['fullscreenbutton']=true;
		}
		this._fullscreenbutton.onmouseout=function () {
			me._fullscreenhint.style[domTransition]='none';
			me._fullscreenhint.style.visibility='hidden';
			me._fullscreenhint.ggVisible=false;
			me._fullscreenbutton__img.src=basePath + 'images/fullscreenbutton.png';
			me._fullscreenbutton.ggIsOver=false;
			me.elementMouseOver['fullscreenbutton']=false;
		}
		this._fullscreenbutton.onmousedown=function () {
			me._fullscreenbutton__img.src=basePath + 'images/fullscreenbutton__a.png';
		}
		this._fullscreenbutton.onmouseup=function () {
			if (me._fullscreenbutton.ggIsOver) {
				me._fullscreenbutton__img.src=basePath + 'images/fullscreenbutton__o.png';
			} else {
				me._fullscreenbutton__img.src=basePath + 'images/fullscreenbutton.png';
			}
		}
		this._fullscreenbutton.ontouchend=function () {
			me.elementMouseOver['fullscreenbutton']=false;
		}
		this._fullscreenzoom.appendChild(this._fullscreenbutton);
		this._zoomout=document.createElement('div');
		this._zoomout.ggId="zoom-out";
		this._zoomout.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
		this._zoomout.ggVisible=true;
		this._zoomout.className='ggskin ggskin_button';
		this._zoomout.ggType='button';
		hs ='position:absolute;';
		hs+='left: -86px;';
		hs+='top:  0px;';
		hs+='width: 42px;';
		hs+='height: 42px;';
		hs+=cssPrefix + 'transform-origin: 50% 50%;';
		hs+='visibility: inherit;';
		hs+='cursor: pointer;';
		this._zoomout.setAttribute('style',hs);
		this._zoomout__img=document.createElement('img');
		this._zoomout__img.className='ggskin ggskin_button';
		this._zoomout__img.setAttribute('src',basePath + 'images/zoomout.png');
		this._zoomout__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
		this._zoomout__img.className='ggskin ggskin_button';
		this._zoomout__img['ondragstart']=function() { return false; };
		me.player.checkLoaded.push(this._zoomout__img);
		this._zoomout.appendChild(this._zoomout__img);
		this._zoomout.onclick=function () {
			me.player.changeFovLog(1,true);
		}
		this._zoomout.onmouseover=function () {
			me._zoomouthint.style[domTransition]='none';
			me._zoomouthint.style.visibility='inherit';
			me._zoomouthint.ggVisible=true;
			me._zoomout__img.src=basePath + 'images/zoomout__o.png';
			me._zoomout.ggIsOver=true;
		}
		this._zoomout.onmouseout=function () {
			me._zoomouthint.style[domTransition]='none';
			me._zoomouthint.style.visibility='hidden';
			me._zoomouthint.ggVisible=false;
			me._zoomout__img.src=basePath + 'images/zoomout.png';
			me._zoomout.ggIsOver=false;
		}
		this._zoomout.onmousedown=function () {
			me._zoomout__img.src=basePath + 'images/zoomout__a.png';
		}
		this._zoomout.onmouseup=function () {
			if (me._zoomout.ggIsOver) {
				me._zoomout__img.src=basePath + 'images/zoomout__o.png';
			} else {
				me._zoomout__img.src=basePath + 'images/zoomout.png';
			}
		}
		this._fullscreenzoom.appendChild(this._zoomout);
		this._zoomin=document.createElement('div');
		this._zoomin.ggId="zoomin";
		this._zoomin.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
		this._zoomin.ggVisible=true;
		this._zoomin.className='ggskin ggskin_button';
		this._zoomin.ggType='button';
		hs ='position:absolute;';
		hs+='left: -129px;';
		hs+='top:  0px;';
		hs+='width: 42px;';
		hs+='height: 42px;';
		hs+=cssPrefix + 'transform-origin: 50% 50%;';
		hs+='visibility: inherit;';
		hs+='cursor: pointer;';
		this._zoomin.setAttribute('style',hs);
		this._zoomin__img=document.createElement('img');
		this._zoomin__img.className='ggskin ggskin_button';
		this._zoomin__img.setAttribute('src',basePath + 'images/zoomin.png');
		this._zoomin__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
		this._zoomin__img.className='ggskin ggskin_button';
		this._zoomin__img['ondragstart']=function() { return false; };
		me.player.checkLoaded.push(this._zoomin__img);
		this._zoomin.appendChild(this._zoomin__img);
		this._zoomin.onclick=function () {
			me.player.changeFovLog(-1,true);
		}
		this._zoomin.onmouseover=function () {
			me._zoominhint.style[domTransition]='none';
			me._zoominhint.style.visibility='inherit';
			me._zoominhint.ggVisible=true;
			me._zoomin__img.src=basePath + 'images/zoomin__o.png';
			me._zoomin.ggIsOver=true;
		}
		this._zoomin.onmouseout=function () {
			me._zoominhint.style[domTransition]='none';
			me._zoominhint.style.visibility='hidden';
			me._zoominhint.ggVisible=false;
			me._zoomin__img.src=basePath + 'images/zoomin.png';
			me._zoomin.ggIsOver=false;
		}
		this._zoomin.onmousedown=function () {
			me._zoomin__img.src=basePath + 'images/zoomin__a.png';
		}
		this._zoomin.onmouseup=function () {
			if (me._zoomin.ggIsOver) {
				me._zoomin__img.src=basePath + 'images/zoomin__o.png';
			} else {
				me._zoomin__img.src=basePath + 'images/zoomin.png';
			}
		}
		this._fullscreenzoom.appendChild(this._zoomin);
		this._hidemarkers=document.createElement('div');
		this._hidemarkers.ggId="hidemarkers";
		this._hidemarkers.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
		this._hidemarkers.ggVisible=true;
		this._hidemarkers.className='ggskin ggskin_button';
		this._hidemarkers.ggType='button';
		hs ='position:absolute;';
		hs+='left: -172px;';
		hs+='top:  0px;';
		hs+='width: 42px;';
		hs+='height: 42px;';
		hs+=cssPrefix + 'transform-origin: 50% 50%;';
		hs+='visibility: inherit;';
		hs+='cursor: pointer;';
		this._hidemarkers.setAttribute('style',hs);
		this._hidemarkers__img=document.createElement('img');
		this._hidemarkers__img.className='ggskin ggskin_button';
		this._hidemarkers__img.setAttribute('src',basePath + 'images/hidemarkers.png');
		this._hidemarkers__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
		this._hidemarkers__img.className='ggskin ggskin_button';
		this._hidemarkers__img['ondragstart']=function() { return false; };
		me.player.checkLoaded.push(this._hidemarkers__img);
		this._hidemarkers.appendChild(this._hidemarkers__img);
		this._hidemarkers.onclick=function () {
			var list=me.findElements("hotspot",false);
			if (list.length>0) {
				var e=list[0];
				flag=(e.style.visibility=='hidden');
			}
			while(list.length>0) {
				var e=list.pop();
				e.style[domTransition]='none';
				e.style.visibility=flag?'inherit':'hidden';
				e.ggVisible=flag;
			}
			var list=me.findElements("hotspot-left",false);
			if (list.length>0) {
				var e=list[0];
				flag=(e.style.visibility=='hidden');
			}
			while(list.length>0) {
				var e=list.pop();
				e.style[domTransition]='none';
				e.style.visibility=flag?'inherit':'hidden';
				e.ggVisible=flag;
			}
			var list=me.findElements("hotspot-right",false);
			if (list.length>0) {
				var e=list[0];
				flag=(e.style.visibility=='hidden');
			}
			while(list.length>0) {
				var e=list.pop();
				e.style[domTransition]='none';
				e.style.visibility=flag?'inherit':'hidden';
				e.ggVisible=flag;
			}
			var list=me.findElements("hotspot-down",false);
			if (list.length>0) {
				var e=list[0];
				flag=(e.style.visibility=='hidden');
			}
			while(list.length>0) {
				var e=list.pop();
				e.style[domTransition]='none';
				e.style.visibility=flag?'inherit':'hidden';
				e.ggVisible=flag;
			}
		}
		this._hidemarkers.onmouseover=function () {
			me._hidemarkers__img.src=basePath + 'images/hidemarkers__o.png';
			me._hidemarkers.ggIsOver=true;
			me.elementMouseOver['hidemarkers']=true;
		}
		this._hidemarkers.onmouseout=function () {
			me._markerhint.style[domTransition]='none';
			me._markerhint.style.visibility='hidden';
			me._markerhint.ggVisible=false;
			me._hidemarkers__img.src=basePath + 'images/hidemarkers.png';
			me._hidemarkers.ggIsOver=false;
			me.elementMouseOver['hidemarkers']=false;
		}
		this._hidemarkers.onmousedown=function () {
			me._hidemarkers__img.src=basePath + 'images/hidemarkers__a.png';
		}
		this._hidemarkers.onmouseup=function () {
			if (me._hidemarkers.ggIsOver) {
				me._hidemarkers__img.src=basePath + 'images/hidemarkers__o.png';
			} else {
				me._hidemarkers__img.src=basePath + 'images/hidemarkers.png';
			}
		}
		this._hidemarkers.ontouchend=function () {
			me.elementMouseOver['hidemarkers']=false;
		}
		this._fullscreenzoom.appendChild(this._hidemarkers);
		this.divSkin.appendChild(this._fullscreenzoom);
		me._zoominhint.style[domTransition]='none';
		me._zoominhint.style.visibility='hidden';
		me._zoominhint.ggVisible=false;
		me._zoomouthint.style[domTransition]='none';
		me._zoomouthint.style.visibility='hidden';
		me._zoomouthint.ggVisible=false;
		me._markerhint.style[domTransition]='none';
		me._markerhint.style.visibility='hidden';
		me._markerhint.ggVisible=false;
		me._fullscreenhint.style[domTransition]='none';
		me._fullscreenhint.style.visibility='hidden';
		me._fullscreenhint.ggVisible=false;
		this.preloadImages();
		this.divSkin.ggUpdateSize=function(w,h) {
			me.updateSize(me.divSkin);
		}
		this.divSkin.ggViewerInit=function() {
		}
		this.divSkin.ggLoaded=function() {
			me._loading.style[domTransition]='none';
			me._loading.style.visibility='hidden';
			me._loading.ggVisible=false;
		}
		this.divSkin.ggReLoaded=function() {
			me._loading.style[domTransition]='none';
			me._loading.style.visibility='inherit';
			me._loading.ggVisible=true;
		}
		this.divSkin.ggLoadedLevels=function() {
		}
		this.divSkin.ggReLoadedLevels=function() {
		}
		this.divSkin.ggEnterFullscreen=function() {
		}
		this.divSkin.ggExitFullscreen=function() {
		}
		this.skinTimerEvent();
	};
	this.hotspotProxyClick=function(id) {
	}
	this.hotspotProxyOver=function(id) {
	}
	this.hotspotProxyOut=function(id) {
	}
	this.changeActiveNode=function(id) {
		var newMarker=new Array();
		var i,j;
		var tags=me.player.userdata.tags;
		for (i=0;i<nodeMarker.length;i++) {
			var match=false;
			if ((nodeMarker[i].ggMarkerNodeId==id) && (id!='')) match=true;
			for(j=0;j<tags.length;j++) {
				if (nodeMarker[i].ggMarkerNodeId==tags[j]) match=true;
			}
			if (match) {
				newMarker.push(nodeMarker[i]);
			}
		}
		for(i=0;i<activeNodeMarker.length;i++) {
			if (newMarker.indexOf(activeNodeMarker[i])<0) {
				if (activeNodeMarker[i].ggMarkerNormal) {
					activeNodeMarker[i].ggMarkerNormal.style.visibility='inherit';
				}
				if (activeNodeMarker[i].ggMarkerActive) {
					activeNodeMarker[i].ggMarkerActive.style.visibility='hidden';
				}
				if (activeNodeMarker[i].ggDeactivate) {
					activeNodeMarker[i].ggDeactivate();
				}
			}
		}
		for(i=0;i<newMarker.length;i++) {
			if (activeNodeMarker.indexOf(newMarker[i])<0) {
				if (newMarker[i].ggMarkerNormal) {
					newMarker[i].ggMarkerNormal.style.visibility='hidden';
				}
				if (newMarker[i].ggMarkerActive) {
					newMarker[i].ggMarkerActive.style.visibility='inherit';
				}
				if (newMarker[i].ggActivate) {
					newMarker[i].ggActivate();
				}
			}
		}
		activeNodeMarker=newMarker;
	}
	this.skinTimerEvent=function() {
		setTimeout(function() { me.skinTimerEvent(); }, 10);
		this._loadingtext.ggUpdateText();
		var hs='';
		if (me._rectangle_66.ggParameter) {
			hs+=parameterToTransform(me._rectangle_66.ggParameter) + ' ';
		}
		hs+='scale(' + (1 * me.player.getPercentLoaded() + 0) + ',1.0) ';
		me._rectangle_66.style[domTransform]=hs;
		if (me.elementMouseOver['fullscreenbutton']) {
			me._fullscreenhint.style[domTransition]='none';
			me._fullscreenhint.style.visibility='inherit';
			me._fullscreenhint.ggVisible=true;
		}
		if (me.elementMouseOver['hidemarkers']) {
			me._markerhint.style[domTransition]='none';
			me._markerhint.style.visibility='inherit';
			me._markerhint.ggVisible=true;
		}
	};
	function SkinHotspotClass(skinObj,hotspot) {
		var me=this;
		var flag=false;
		this.player=skinObj.player;
		this.skin=skinObj;
		this.hotspot=hotspot;
		this.elementMouseDown=new Array();
		this.elementMouseOver=new Array();
		this.__div=document.createElement('div');
		this.__div.setAttribute('style','position:absolute; left:0px;top:0px;visibility: inherit;');
		
		this.findElements=function(id,regex) {
			return me.skin.findElements(id,regex);
		}
		
		if (hotspot.skinid=='hotspot') {
			this.__div=document.createElement('div');
			this.__div.ggId="hotspot";
			this.__div.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this.__div.ggVisible=true;
			this.__div.className='ggskin ggskin_hotspot';
			this.__div.ggType='hotspot';
			hs ='position:absolute;';
			hs+='left: 450px;';
			hs+='top:  49px;';
			hs+='width: 5px;';
			hs+='height: 5px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: inherit;';
			this.__div.setAttribute('style',hs);
			this.__div.onclick=function () {
				me.skin.hotspotProxyClick(me.hotspot.id);
			}
			this.__div.onmouseover=function () {
				me.player.hotspot=me.hotspot;
				me.skin.hotspotProxyOver(me.hotspot.id);
			}
			this.__div.onmouseout=function () {
				me.player.hotspot=me.player.emptyHotspot;
				me.skin.hotspotProxyOut(me.hotspot.id);
			}
			this.__183=document.createElement('div');
			this.__183.ggId="\u041a\u043d\u043e\u043f\u043a\u0430 18";
			this.__183.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this.__183.ggVisible=true;
			this.__183.className='ggskin ggskin_button';
			this.__183.ggType='button';
			hs ='position:absolute;';
			hs+='left: -38px;';
			hs+='top:  -40px;';
			hs+='width: 79px;';
			hs+='height: 79px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: inherit;';
			hs+='cursor: pointer;';
			this.__183.setAttribute('style',hs);
			this.__183__img=document.createElement('img');
			this.__183__img.className='ggskin ggskin_button';
			this.__183__img.setAttribute('src',basePath + 'images/_183.png');
			this.__183__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
			this.__183__img.className='ggskin ggskin_button';
			this.__183__img['ondragstart']=function() { return false; };
			me.player.checkLoaded.push(this.__183__img);
			this.__183.appendChild(this.__183__img);
			this.__183.onclick=function () {
				me.player.openUrl(me.hotspot.url,me.hotspot.target);
			}
			this.__183.onmouseover=function () {
				me.__183__img.src=basePath + 'images/_183__o.png';
				me.__183.ggIsOver=true;
			}
			this.__183.onmouseout=function () {
				me.__183__img.src=basePath + 'images/_183.png';
				me.__183.ggIsOver=false;
			}
			this.__183.onmousedown=function () {
				me.__183__img.src=basePath + 'images/_183__a.png';
			}
			this.__183.onmouseup=function () {
				if (me.__183.ggIsOver) {
					me.__183__img.src=basePath + 'images/_183__o.png';
				} else {
					me.__183__img.src=basePath + 'images/_183.png';
				}
			}
			this.__div.appendChild(this.__183);
		} else
		if (hotspot.skinid=='hotspot-text') {
			this.__div=document.createElement('div');
			this.__div.ggId="hotspot-text";
			this.__div.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this.__div.ggVisible=true;
			this.__div.className='ggskin ggskin_hotspot';
			this.__div.ggType='hotspot';
			hs ='position:absolute;';
			hs+='left: 450px;';
			hs+='top:  49px;';
			hs+='width: 5px;';
			hs+='height: 5px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: inherit;';
			this.__div.setAttribute('style',hs);
			this.__div.onclick=function () {
				me.skin.hotspotProxyClick(me.hotspot.id);
			}
			this.__div.onmouseover=function () {
				me.player.hotspot=me.hotspot;
				me.skin.hotspotProxyOver(me.hotspot.id);
			}
			this.__div.onmouseout=function () {
				me.player.hotspot=me.player.emptyHotspot;
				me.skin.hotspotProxyOut(me.hotspot.id);
			}
			this.__182=document.createElement('div');
			this.__182.ggId="\u041a\u043d\u043e\u043f\u043a\u0430 18";
			this.__182.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this.__182.ggVisible=true;
			this.__182.className='ggskin ggskin_button';
			this.__182.ggType='button';
			hs ='position:absolute;';
			hs+='left: -34px;';
			hs+='top:  -35px;';
			hs+='width: 70px;';
			hs+='height: 70px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: inherit;';
			hs+='cursor: pointer;';
			this.__182.setAttribute('style',hs);
			this.__182__img=document.createElement('img');
			this.__182__img.className='ggskin ggskin_button';
			this.__182__img.setAttribute('src',basePath + 'images/_182.png');
			this.__182__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
			this.__182__img.className='ggskin ggskin_button';
			this.__182__img['ondragstart']=function() { return false; };
			me.player.checkLoaded.push(this.__182__img);
			this.__182.appendChild(this.__182__img);
			this.__182.onclick=function () {
				me.player.openUrl(me.hotspot.url,me.hotspot.target);
			}
			this.__182.onmouseover=function () {
				me._infotext.style[domTransition]='none';
				me._infotext.style.visibility='inherit';
				me._infotext.ggVisible=true;
				me.__182__img.src=basePath + 'images/_182__o.png';
				me.__182.ggIsOver=true;
			}
			this.__182.onmouseout=function () {
				me._infotext.style[domTransition]='none';
				me._infotext.style.visibility='hidden';
				me._infotext.ggVisible=false;
				me.__182__img.src=basePath + 'images/_182.png';
				me.__182.ggIsOver=false;
			}
			this.__182.onmousedown=function () {
				me.__182__img.src=basePath + 'images/_182__a.png';
			}
			this.__182.onmouseup=function () {
				if (me.__182.ggIsOver) {
					me.__182__img.src=basePath + 'images/_182__o.png';
				} else {
					me.__182__img.src=basePath + 'images/_182.png';
				}
			}
			this.__div.appendChild(this.__182);
			this._infotext=document.createElement('div');
			this._infotext__text=document.createElement('div');
			this._infotext.className='ggskin ggskin_textdiv';
			this._infotext.ggTextDiv=this._infotext__text;
			this._infotext.ggId="info-text";
			this._infotext.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this._infotext.ggVisible=false;
			this._infotext.className='ggskin ggskin_text';
			this._infotext.ggType='text';
			hs ='position:absolute;';
			hs+='left: -100px;';
			hs+='top:  26px;';
			hs+='width: 98px;';
			hs+='height: 20px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: hidden;';
			this._infotext.setAttribute('style',hs);
			hs ='position:absolute;';
			hs+='left: 0px;';
			hs+='top:  0px;';
			hs+='width: 98px;';
			hs+='height: auto;';
			hs+='background: #000000;';
			hs+='background: rgba(0,0,0,0.411765);';
			hs+='border: 0px solid #000000;';
			hs+='border-radius: 3px;';
			hs+=cssPrefix + 'border-radius: 3px;';
			hs+='color: #ffffff;';
			hs+='text-align: center;';
			hs+='white-space: pre-wrap;';
			hs+='padding: 0px 1px 0px 1px;';
			hs+='overflow: hidden;';
			this._infotext__text.setAttribute('style',hs);
			this._infotext__text.innerHTML="<div style=\"font-size: 11px;color:#ffffff; padding:10px; text-shadow:1px 1px 1px #404040;\">"+me.hotspot.title+"<\/div>";
			this._infotext.appendChild(this._infotext__text);
			this.__div.appendChild(this._infotext);
		} else
		if (hotspot.skinid=='hotspot-left') {
			this.__div=document.createElement('div');
			this.__div.ggId="hotspot-left";
			this.__div.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this.__div.ggVisible=true;
			this.__div.className='ggskin ggskin_hotspot';
			this.__div.ggType='hotspot';
			hs ='position:absolute;';
			hs+='left: 450px;';
			hs+='top:  49px;';
			hs+='width: 5px;';
			hs+='height: 5px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: inherit;';
			this.__div.setAttribute('style',hs);
			this.__div.onclick=function () {
				me.skin.hotspotProxyClick(me.hotspot.id);
			}
			this.__div.onmouseover=function () {
				me.player.hotspot=me.hotspot;
				me.skin.hotspotProxyOver(me.hotspot.id);
			}
			this.__div.onmouseout=function () {
				me.player.hotspot=me.player.emptyHotspot;
				me.skin.hotspotProxyOut(me.hotspot.id);
			}
			this.__181=document.createElement('div');
			this.__181.ggId="\u041a\u043d\u043e\u043f\u043a\u0430 18";
			this.__181.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this.__181.ggVisible=true;
			this.__181.className='ggskin ggskin_button';
			this.__181.ggType='button';
			hs ='position:absolute;';
			hs+='left: -40px;';
			hs+='top:  -41px;';
			hs+='width: 85px;';
			hs+='height: 85px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: inherit;';
			hs+='cursor: pointer;';
			this.__181.setAttribute('style',hs);
			this.__181__img=document.createElement('img');
			this.__181__img.className='ggskin ggskin_button';
			this.__181__img.setAttribute('src',basePath + 'images/_181.png');
			this.__181__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
			this.__181__img.className='ggskin ggskin_button';
			this.__181__img['ondragstart']=function() { return false; };
			me.player.checkLoaded.push(this.__181__img);
			this.__181.appendChild(this.__181__img);
			this.__181.onclick=function () {
				me.player.openUrl(me.hotspot.url,me.hotspot.target);
			}
			this.__181.onmouseover=function () {
				me.__181__img.src=basePath + 'images/_181__o.png';
				me.__181.ggIsOver=true;
			}
			this.__181.onmouseout=function () {
				me.__181__img.src=basePath + 'images/_181.png';
				me.__181.ggIsOver=false;
			}
			this.__181.onmousedown=function () {
				me.__181__img.src=basePath + 'images/_181__a.png';
			}
			this.__181.onmouseup=function () {
				if (me.__181.ggIsOver) {
					me.__181__img.src=basePath + 'images/_181__o.png';
				} else {
					me.__181__img.src=basePath + 'images/_181.png';
				}
			}
			this.__div.appendChild(this.__181);
		} else
		if (hotspot.skinid=='hotspot-right') {
			this.__div=document.createElement('div');
			this.__div.ggId="hotspot-right";
			this.__div.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this.__div.ggVisible=true;
			this.__div.className='ggskin ggskin_hotspot';
			this.__div.ggType='hotspot';
			hs ='position:absolute;';
			hs+='left: 450px;';
			hs+='top:  49px;';
			hs+='width: 5px;';
			hs+='height: 5px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: inherit;';
			this.__div.setAttribute('style',hs);
			this.__div.onclick=function () {
				me.skin.hotspotProxyClick(me.hotspot.id);
			}
			this.__div.onmouseover=function () {
				me.player.hotspot=me.hotspot;
				me.skin.hotspotProxyOver(me.hotspot.id);
			}
			this.__div.onmouseout=function () {
				me.player.hotspot=me.player.emptyHotspot;
				me.skin.hotspotProxyOut(me.hotspot.id);
			}
			this.__180=document.createElement('div');
			this.__180.ggId="\u041a\u043d\u043e\u043f\u043a\u0430 18";
			this.__180.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this.__180.ggVisible=true;
			this.__180.className='ggskin ggskin_button';
			this.__180.ggType='button';
			hs ='position:absolute;';
			hs+='left: -40px;';
			hs+='top:  -40px;';
			hs+='width: 84px;';
			hs+='height: 84px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: inherit;';
			hs+='cursor: pointer;';
			this.__180.setAttribute('style',hs);
			this.__180__img=document.createElement('img');
			this.__180__img.className='ggskin ggskin_button';
			this.__180__img.setAttribute('src',basePath + 'images/_180.png');
			this.__180__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
			this.__180__img.className='ggskin ggskin_button';
			this.__180__img['ondragstart']=function() { return false; };
			me.player.checkLoaded.push(this.__180__img);
			this.__180.appendChild(this.__180__img);
			this.__180.onclick=function () {
				me.player.openUrl(me.hotspot.url,me.hotspot.target);
			}
			this.__180.onmouseover=function () {
				me.__180__img.src=basePath + 'images/_180__o.png';
				me.__180.ggIsOver=true;
			}
			this.__180.onmouseout=function () {
				me.__180__img.src=basePath + 'images/_180.png';
				me.__180.ggIsOver=false;
			}
			this.__180.onmousedown=function () {
				me.__180__img.src=basePath + 'images/_180__a.png';
			}
			this.__180.onmouseup=function () {
				if (me.__180.ggIsOver) {
					me.__180__img.src=basePath + 'images/_180__o.png';
				} else {
					me.__180__img.src=basePath + 'images/_180.png';
				}
			}
			this.__div.appendChild(this.__180);
		} else
		if (hotspot.skinid=='hotspot-down') {
			this.__div=document.createElement('div');
			this.__div.ggId="hotspot-down";
			this.__div.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this.__div.ggVisible=true;
			this.__div.className='ggskin ggskin_hotspot';
			this.__div.ggType='hotspot';
			hs ='position:absolute;';
			hs+='left: 450px;';
			hs+='top:  49px;';
			hs+='width: 5px;';
			hs+='height: 5px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: inherit;';
			this.__div.setAttribute('style',hs);
			this.__div.onclick=function () {
				me.skin.hotspotProxyClick(me.hotspot.id);
			}
			this.__div.onmouseover=function () {
				me.player.hotspot=me.hotspot;
				me.skin.hotspotProxyOver(me.hotspot.id);
			}
			this.__div.onmouseout=function () {
				me.player.hotspot=me.player.emptyHotspot;
				me.skin.hotspotProxyOut(me.hotspot.id);
			}
			this.__18=document.createElement('div');
			this.__18.ggId="\u041a\u043d\u043e\u043f\u043a\u0430 18";
			this.__18.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this.__18.ggVisible=true;
			this.__18.className='ggskin ggskin_button';
			this.__18.ggType='button';
			hs ='position:absolute;';
			hs+='left: -42px;';
			hs+='top:  -42px;';
			hs+='width: 85px;';
			hs+='height: 85px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: inherit;';
			hs+='cursor: pointer;';
			this.__18.setAttribute('style',hs);
			this.__18__img=document.createElement('img');
			this.__18__img.className='ggskin ggskin_button';
			this.__18__img.setAttribute('src',basePath + 'images/_18.png');
			this.__18__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
			this.__18__img.className='ggskin ggskin_button';
			this.__18__img['ondragstart']=function() { return false; };
			me.player.checkLoaded.push(this.__18__img);
			this.__18.appendChild(this.__18__img);
			this.__18.onclick=function () {
				me.player.openUrl(me.hotspot.url,me.hotspot.target);
			}
			this.__18.onmouseover=function () {
				me.__18__img.src=basePath + 'images/_18__o.png';
				me.__18.ggIsOver=true;
			}
			this.__18.onmouseout=function () {
				me.__18__img.src=basePath + 'images/_18.png';
				me.__18.ggIsOver=false;
			}
			this.__18.onmousedown=function () {
				me.__18__img.src=basePath + 'images/_18__a.png';
			}
			this.__18.onmouseup=function () {
				if (me.__18.ggIsOver) {
					me.__18__img.src=basePath + 'images/_18__o.png';
				} else {
					me.__18__img.src=basePath + 'images/_18.png';
				}
			}
			this.__div.appendChild(this.__18);
		} else
		if (hotspot.skinid=='hotspot-info') {
			this.__div=document.createElement('div');
			this.__div.ggId="hotspot-info";
			this.__div.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this.__div.ggVisible=true;
			this.__div.className='ggskin ggskin_hotspot';
			this.__div.ggType='hotspot';
			hs ='position:absolute;';
			hs+='left: 411px;';
			hs+='top:  175px;';
			hs+='width: 5px;';
			hs+='height: 5px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: inherit;';
			this.__div.setAttribute('style',hs);
			this.__div.onclick=function () {
				me.skin.hotspotProxyClick(me.hotspot.id);
			}
			this.__div.onmouseover=function () {
				me.player.hotspot=me.hotspot;
				me.skin.hotspotProxyOver(me.hotspot.id);
			}
			this.__div.onmouseout=function () {
				me.player.hotspot=me.player.emptyHotspot;
				me.skin.hotspotProxyOut(me.hotspot.id);
			}
			this._infobtn=document.createElement('div');
			this._infobtn.ggId="info-btn";
			this._infobtn.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this._infobtn.ggVisible=true;
			this._infobtn.className='ggskin ggskin_button';
			this._infobtn.ggType='button';
			hs ='position:absolute;';
			hs+='left: -42px;';
			hs+='top:  -42px;';
			hs+='width: 76px;';
			hs+='height: 76px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: inherit;';
			hs+='cursor: pointer;';
			this._infobtn.setAttribute('style',hs);
			this._infobtn__img=document.createElement('img');
			this._infobtn__img.className='ggskin ggskin_button';
			this._infobtn__img.setAttribute('src',basePath + 'images/infobtn.png');
			this._infobtn__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
			this._infobtn__img.className='ggskin ggskin_button';
			this._infobtn__img['ondragstart']=function() { return false; };
			me.player.checkLoaded.push(this._infobtn__img);
			this._infobtn.appendChild(this._infobtn__img);
			this._infobtn.onclick=function () {
				me.player.openUrl(me.hotspot.url,me.hotspot.target);
			}
			this._infobtn.onmouseover=function () {
				me._hstext.style[domTransition]='none';
				me._hstext.style.visibility='inherit';
				me._hstext.ggVisible=true;
				me._infobtn__img.src=basePath + 'images/infobtn__o.png';
				me._infobtn.ggIsOver=true;
			}
			this._infobtn.onmouseout=function () {
				me._hstext.style[domTransition]='none';
				me._hstext.style.visibility='hidden';
				me._hstext.ggVisible=false;
				me._infobtn__img.src=basePath + 'images/infobtn.png';
				me._infobtn.ggIsOver=false;
			}
			this._infobtn.onmousedown=function () {
				me._infobtn__img.src=basePath + 'images/infobtn__a.png';
			}
			this._infobtn.onmouseup=function () {
				if (me._infobtn.ggIsOver) {
					me._infobtn__img.src=basePath + 'images/infobtn__o.png';
				} else {
					me._infobtn__img.src=basePath + 'images/infobtn.png';
				}
			}
			this.__div.appendChild(this._infobtn);
			this._hstext=document.createElement('div');
			this._hstext__text=document.createElement('div');
			this._hstext.className='ggskin ggskin_textdiv';
			this._hstext.ggTextDiv=this._hstext__text;
			this._hstext.ggId="hs-text";
			this._hstext.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this._hstext.ggVisible=false;
			this._hstext.className='ggskin ggskin_text';
			this._hstext.ggType='text';
			hs ='position:absolute;';
			hs+='left: -179px;';
			hs+='top:  31px;';
			hs+='width: 334px;';
			hs+='height: 18px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: hidden;';
			this._hstext.setAttribute('style',hs);
			hs ='position:absolute;';
			hs+='left: 0px;';
			hs+='top:  0px;';
			hs+='width: 334px;';
			hs+='height: auto;';
			hs+='background: #000000;';
			hs+='background: rgba(0,0,0,0.784314);';
			hs+='border: 10px solid #000000;';
			hs+='border: 10px solid rgba(0,0,0,0.784314);';
			hs+=cssPrefix + 'background-clip: padding-box;';
			hs+='background-clip: padding-box;';
			hs+='border-radius: 10px;';
			hs+=cssPrefix + 'border-radius: 10px;';
			hs+='color: #ffffff;';
			hs+='text-align: left;';
			hs+='white-space: pre-wrap;';
			hs+='padding: 2px 3px 2px 3px;';
			hs+='overflow: hidden;';
			this._hstext__text.setAttribute('style',hs);
			this._hstext__text.innerHTML=me.hotspot.title;
			this._hstext.appendChild(this._hstext__text);
			this.__div.appendChild(this._hstext);
		} else
		{
			this.__div=document.createElement('div');
			this.__div.ggId="hs-air";
			this.__div.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this.__div.ggVisible=true;
			this.__div.className='ggskin ggskin_hotspot';
			this.__div.ggType='hotspot';
			hs ='position:absolute;';
			hs+='left: 450px;';
			hs+='top:  49px;';
			hs+='width: 5px;';
			hs+='height: 5px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: inherit;';
			this.__div.setAttribute('style',hs);
			this.__div.onclick=function () {
				me.skin.hotspotProxyClick(me.hotspot.id);
			}
			this.__div.onmouseover=function () {
				me.player.hotspot=me.hotspot;
				me.skin.hotspotProxyOver(me.hotspot.id);
			}
			this.__div.onmouseout=function () {
				me.player.hotspot=me.player.emptyHotspot;
				me.skin.hotspotProxyOut(me.hotspot.id);
			}
			this._hsairbtn=document.createElement('div');
			this._hsairbtn.ggId="hsair-btn";
			this._hsairbtn.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this._hsairbtn.ggVisible=true;
			this._hsairbtn.className='ggskin ggskin_button';
			this._hsairbtn.ggType='button';
			hs ='position:absolute;';
			hs+='left: -42px;';
			hs+='top:  -43px;';
			hs+='width: 86px;';
			hs+='height: 87px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: inherit;';
			hs+='cursor: pointer;';
			this._hsairbtn.setAttribute('style',hs);
			this._hsairbtn__img=document.createElement('img');
			this._hsairbtn__img.className='ggskin ggskin_button';
			this._hsairbtn__img.setAttribute('src',basePath + 'images/hsairbtn.png');
			this._hsairbtn__img.setAttribute('style','position: absolute;top: 0px;left: 0px;-webkit-user-drag:none;');
			this._hsairbtn__img.className='ggskin ggskin_button';
			this._hsairbtn__img['ondragstart']=function() { return false; };
			me.player.checkLoaded.push(this._hsairbtn__img);
			this._hsairbtn.appendChild(this._hsairbtn__img);
			this._hsairbtn.onclick=function () {
				me.player.openUrl(me.hotspot.url,me.hotspot.target);
			}
			this._hsairbtn.onmouseover=function () {
				me._hstext2.style[domTransition]='none';
				me._hstext2.style.visibility='inherit';
				me._hstext2.ggVisible=true;
				me._hsairbtn__img.src=basePath + 'images/hsairbtn__o.png';
				me._hsairbtn.ggIsOver=true;
			}
			this._hsairbtn.onmouseout=function () {
				me._hstext2.style[domTransition]='none';
				me._hstext2.style.visibility='hidden';
				me._hstext2.ggVisible=false;
				me._hsairbtn__img.src=basePath + 'images/hsairbtn.png';
				me._hsairbtn.ggIsOver=false;
			}
			this._hsairbtn.onmousedown=function () {
				me._hsairbtn__img.src=basePath + 'images/hsairbtn__a.png';
			}
			this._hsairbtn.onmouseup=function () {
				if (me._hsairbtn.ggIsOver) {
					me._hsairbtn__img.src=basePath + 'images/hsairbtn__o.png';
				} else {
					me._hsairbtn__img.src=basePath + 'images/hsairbtn.png';
				}
			}
			this.__div.appendChild(this._hsairbtn);
			this._hstext2=document.createElement('div');
			this._hstext2__text=document.createElement('div');
			this._hstext2.className='ggskin ggskin_textdiv';
			this._hstext2.ggTextDiv=this._hstext2__text;
			this._hstext2.ggId="hs-text2";
			this._hstext2.ggParameter={ rx:0,ry:0,a:0,sx:1,sy:1 };
			this._hstext2.ggVisible=false;
			this._hstext2.className='ggskin ggskin_text';
			this._hstext2.ggType='text';
			this._hstext2.ggUpdatePosition=function() {
				this.style[domTransition]='none';
				this.style.width=this.ggTextDiv.offsetWidth + 'px';
				this.style.height=this.ggTextDiv.offsetHeight + 'px';
				this.ggTextDiv.style.left=(0 + (208-this.ggTextDiv.offsetWidth)/2) + 'px';
			}
			hs ='position:absolute;';
			hs+='left: -142px;';
			hs+='top:  157px;';
			hs+='width: 184px;';
			hs+='height: 18px;';
			hs+=cssPrefix + 'transform-origin: 50% 50%;';
			hs+='visibility: hidden;';
			this._hstext2.setAttribute('style',hs);
			hs ='position:absolute;';
			hs+='left: 0px;';
			hs+='top:  0px;';
			hs+='width: auto;';
			hs+='height: auto;';
			hs+='background: #000000;';
			hs+='background: rgba(0,0,0,0.784314);';
			hs+='border: 10px solid #000000;';
			hs+='border: 10px solid rgba(0,0,0,0.784314);';
			hs+=cssPrefix + 'background-clip: padding-box;';
			hs+='background-clip: padding-box;';
			hs+='border-radius: 10px;';
			hs+=cssPrefix + 'border-radius: 10px;';
			hs+='color: #ffffff;';
			hs+='text-align: center;';
			hs+='white-space: nowrap;';
			hs+='padding: 2px 3px 2px 3px;';
			hs+='overflow: hidden;';
			this._hstext2__text.setAttribute('style',hs);
			this._hstext2__text.innerHTML=me.hotspot.title;
			this._hstext2.appendChild(this._hstext2__text);
			this.__div.appendChild(this._hstext2);
		}
	};
	this.addSkinHotspot=function(hotspot) {
		return new SkinHotspotClass(me,hotspot);
	}
	this.addSkin();
};