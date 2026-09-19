// Injected in the page's ISOLATED world. Only visible, filename-matched viewer controls.
export async function captureSlidePreview(marker,name,token,assetId,expectedUrl,maxBytes=64*1024*1024) {
  const job=globalThis.__personalExportCapture, asset=job?.assets?.get(assetId);
  if(location.origin!=='https://chatgpt.com'||location.href!==expectedUrl||job?.token!==token||!asset)return {error:'The slide capture session expired.'};
  if(!Number.isFinite(maxBytes)||maxBytes<=0||maxBytes>64*1024*1024)return {error:'Slide preview memory budget unavailable.'};
  const card=[...document.querySelectorAll('[data-ternote-file]')].find(e=>e.getAttribute('data-ternote-file')===marker);
  if(!card||!card.closest('[data-message-author-role]'))return {error:'The presentation card is no longer available.'};
  const normalized=value=>String(value||'').replace(/\s+/g,' ').trim();
  const stem=name.replace(/\.pptx$/i,'');
  const visible=node=>!!node?.getClientRects().length && getComputedStyle(node).visibility!=='hidden';
  const previousClose=new Set(document.querySelectorAll('button[aria-label="Close"]'));
  let root,close,originalIndex,position,completed=false,bytes=0;
  const pages=[],started=Date.now();
  function check(){
    if(job.controller.signal.aborted||globalThis.__personalExportCapture!==job||location.href!==expectedUrl||card.getAttribute('data-ternote-file')!==marker)throw new Error('Slide capture cancelled or conversation changed.');
    if(Date.now()-started>300000)throw new Error('Slide preview exceeded the five-minute capture budget. No partial deck included.');
    job.lastAccess=Date.now();
  }
  const pause=async ms=>{check();await new Promise(resolve=>setTimeout(resolve,ms));check();};
  const button=(scope,label)=>[...scope.querySelectorAll('button')].filter(b=>b.getAttribute('aria-label')===label&&visible(b));
  function counter(){
    const counters=[...root.querySelectorAll('span,div,p')].filter(visible).map(e=>normalized(e.textContent).match(/^(\d+)\s*\/\s*(\d+)$/)).filter(Boolean);
    const values=new Set(counters.map(m=>Number(m[1])+'/'+Number(m[2])));
    if(values.size!==1)throw new Error('No unambiguous slide counter found.');
    const [index,total]=[...values][0].split('/').map(Number);
    if(index<1||total<index||total>10000)throw new Error('Unsupported slide counter.');
    return {index,total};
  }
  function surface(){
    const roots=[root];
    for(let i=0;i<roots.length;i++) {
      if(i>20)throw new Error('Preview frame nesting is too complex.');
      for(const frame of roots[i].querySelectorAll('iframe'))try{if(visible(frame)&&frame.contentDocument?.body)roots.push(frame.contentDocument.body);}catch{}
    }
    const candidates=roots.flatMap(r=>[...r.querySelectorAll('canvas,img')]).filter(e=>visible(e)&&!e.closest('button,[role="button"]')).map(e=>({e,box:e.getBoundingClientRect()})).filter(({e,box})=>box.width>=300&&box.height>=150&&(e.tagName==='CANVAS'?e.width&&e.height:e.complete&&e.naturalWidth));
    candidates.sort((a,b)=>b.box.width*b.box.height-a.box.width*a.box.height);
    if(!candidates.length)throw new Error('No readable full-slide canvas or image found. The viewer may use a protected frame or HTML/SVG rendering.');
    if(candidates[1]&&candidates[1].box.width*candidates[1].box.height>candidates[0].box.width*candidates[0].box.height*.9)throw new Error('Multiple overlapping slide surfaces found; refusing a potentially incomplete screenshot.');
    const chosen=candidates[0],owner=chosen.e.parentElement;
    // A canvas used only for a chart/background is not a whole slide if text is layered over it.
    for(const overlay of owner.querySelectorAll('span,p,h1,h2,h3,svg')) {
      if(overlay===chosen.e||!visible(overlay))continue;
      const style=getComputedStyle(overlay),box=overlay.getBoundingClientRect();
      if(style.opacity==='0'||style.color==='rgba(0, 0, 0, 0)'||style.color==='transparent')continue;
      if(box.width&&box.height&&box.left<chosen.box.right&&box.right>chosen.box.left&&box.top<chosen.box.bottom&&box.bottom>chosen.box.top&&(overlay.tagName.toLowerCase()==='svg'||normalized(overlay.textContent)))throw new Error('The slide has separate visible text/vector layers. A canvas-only capture would be incomplete.');
    }
    return candidates[0].e;
  }
  function snapshot(){
    const source=surface(),width=source.tagName==='CANVAS'?source.width:source.naturalWidth,height=source.tagName==='CANVAS'?source.height:source.naturalHeight;
    if(width*height>80_000_000)throw new Error('Slide dimensions exceed the image safety budget.');
    const scale=Math.min(1,2200/Math.max(width,height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    try {const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(source,0,0,canvas.width,canvas.height);
      return {data:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height};
    }catch{throw new Error('The browser prevents reading this slide image. No reconstructed slide was substituted.');}
    finally{canvas.width=canvas.height=0;}
  }
  async function move(label,target,total){
    check();const controls=button(root,label);
    if(controls.length!==1||controls[0].disabled||controls[0].getAttribute('aria-disabled')==='true')throw new Error('A required slide navigation control is unavailable.');
    controls[0].click();
    for(let i=0;i<100;i++){await pause(100);const c=counter();if(c.total!==total)throw new Error('The presentation changed during capture.');if(c.index===target){position=target;return;}}
    throw new Error('The slide viewer did not advance. No partial deck included.');
  }
  try {
    card.click();
    for(let i=0;i<80&&!root;i++) {
      check();
      const candidates=[];
      for(const next of button(document,'Go to next slide'))for(let node=next.parentElement,depth=0;node&&node!==document.body&&depth<10;node=node.parentElement,depth++) {
        if(node.querySelector('[data-message-author-role]'))break;
        const titles=[...node.querySelectorAll('h1,h2,h3,[title],span,p,div')];
        if(titles.some(e=>[name,stem].includes(normalized(e.getAttribute('title')||e.textContent)))&&button(node,'Go to previous slide').length===1&&node.querySelector('canvas,img,iframe')){candidates.push(node);break;}
      }
      if(new Set(candidates).size===1)root=candidates[0];
      if(!root)await pause(100);
    }
    close=[...document.querySelectorAll('button[aria-label="Close"]')].find(e=>!previousClose.has(e)&&visible(e));
    if(!root)throw new Error('The presentation viewer could not be identified safely.');
    const initial=counter(),total=initial.total;originalIndex=position=initial.index;
    while(position>1)await move('Go to previous slide',position-1,total);
    for(let number=1;number<=total;number++) {
      check();
      try{globalThis.chrome?.runtime?.sendMessage({type:'capture-progress',token,stage:'Capturing original slide previews',current:number,total})?.catch(()=>{});}catch{}
      // Wait for navigation and pixels to settle, not just the counter to change.
      await pause(1000);let previous,stable,snapshotError;
      for(let attempt=0;attempt<30;attempt++) {
        const c=counter();if(c.index!==number||c.total!==total)throw new Error('Slide navigation changed unexpectedly.');
        try {
          if(root.matches('[aria-busy="true"]')||root.querySelector('[aria-busy="true"],[role="progressbar"]'))throw new Error('The slide is still loading.');
          const current=snapshot();if(current.data===previous?.data){stable=current;break;}previous=current;
        }catch(error){snapshotError=error;previous=undefined;}
        await pause(200);
      }
      if(!stable)throw snapshotError||new Error('The slide image did not settle. No partial deck included.');
      const encoded=stable.data.split(',')[1],data=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),blob=new Blob([data],{type:'image/png'});
      bytes+=blob.size;
      if(bytes>maxBytes)throw new Error('Slide previews exceed the available memory budget (up to 64 MB per presentation).');
      pages.push({blob,width:stable.width,height:stable.height});
      if(number<total)await move('Go to next slide',number+1,total);
    }
    check();asset.previewPages=pages;completed=true;
    return {count:pages.length,bytes};
  }catch(error){return {error:error.message};}
  finally {
    if(!completed){pages.length=0;delete asset.previewPages;}
    if(close?.isConnected&&location.href===expectedUrl)try{close.click();}catch{}
    // Only close the viewer opened by this operation; never close a pre-existing one.
    else if(root&&originalIndex&&position!==originalIndex&&!job.controller.signal.aborted&&location.href===expectedUrl) {
      try{const total=counter().total;while(position!==originalIndex)await move(position>originalIndex?'Go to previous slide':'Go to next slide',position+(position>originalIndex?-1:1),total);}catch{}
    }
  }
}
