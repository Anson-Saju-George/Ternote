import assert from 'node:assert/strict';
import {captureSlidePreview} from '../src/slide-preview.js';
import {readCapturePreview} from '../src/extract.js';

export async function slidePreviewTests({evaluate,page,send,sleep,fixtureSessions,ui}) {
  const session=await page();
  fixtureSessions.set(session,'<!doctype html><title>Preview fixture</title><main><article data-message-author-role="assistant"><button id="generated">generated.pptx</button></article><article data-message-author-role="user"><button id="uploaded">uploaded.pptx</button></article></main>');
  await send('Fetch.enable',{patterns:[{urlPattern:'*'}]},session);await send('Page.navigate',{url:'https://chatgpt.com/c/slide-preview-fixture'},session);
  for(let i=0;i<40;i++){if(await evaluate(session,"document.title==='Preview fixture'"))break;await sleep(50);}
  await evaluate(session,`window.captureSlides=${captureSlidePreview.toString()};
    window.setupPreview=(id,mode='normal')=>{
      document.querySelectorAll('[data-ternote-file]').forEach(e=>e.removeAttribute('data-ternote-file'));
      const card=document.getElementById(id);card.setAttribute('data-ternote-file','preview:asset-1');
      window.__personalExportCapture={token:'preview',controller:new AbortController(),assets:new Map([['asset-1',{}]])};
      card.onclick=()=>{
        const root=document.createElement('section');root.id='viewer';
        const title=document.createElement('h2');title.textContent=mode==='wrong'?'different':id;
        const counter=document.createElement('span'),canvas=document.createElement('canvas');canvas.width=600;canvas.height=338;
        const previous=document.createElement('button'),next=document.createElement('button'),close=document.createElement('button');
        previous.setAttribute('aria-label','Go to previous slide');next.setAttribute('aria-label','Go to next slide');close.setAttribute('aria-label','Close');
        let index=2;const draw=()=>{counter.textContent=index+'/3';previous.disabled=index===1;next.disabled=index===3;
          root.setAttribute('aria-busy','true');setTimeout(()=>{const ctx=canvas.getContext('2d');ctx.fillStyle=['#ff0000','#00ff00','#0000ff'][index-1];ctx.fillRect(0,0,600,338);ctx.fillStyle='white';ctx.font='32px sans-serif';ctx.fillText('Slide '+index,100,120);root.removeAttribute('aria-busy');},250);};
        previous.onclick=()=>{index--;draw();};next.onclick=()=>{if(mode!=='stuck'){index++;draw();}};close.onclick=()=>root.remove();
        root.append(title,previous,counter,next,close,canvas);document.body.append(root);draw();
        if(mode==='cancel')setTimeout(()=>window.__personalExportCapture.controller.abort(),400);
      };
    };`);
  let firstSlide;
  for(const id of ['generated','uploaded']) {
    await evaluate(session,`setupPreview('${id}')`);
    const result=await evaluate(session,`captureSlides('preview:asset-1','${id}.pptx','preview','asset-1',location.href)`);
    assert.equal(result.count,3,id+': '+JSON.stringify(result));
    const colours=await evaluate(session,"(async()=>{const result=[];for(const p of __personalExportCapture.assets.get('asset-1').previewPages){const b=await createImageBitmap(p.blob),c=document.createElement('canvas');c.width=c.height=1;c.getContext('2d').drawImage(b,0,0);result.push([...c.getContext('2d').getImageData(0,0,1,1).data].slice(0,3));b.close();}return result})()");
    assert.deepEqual(colours,[[255,0,0],[0,255,0],[0,0,255]]);
    assert(await evaluate(session,"!document.getElementById('viewer')"));
    const part=await evaluate(session,'('+readCapturePreview.toString()+')("preview","asset-1",0,0)');assert(part.done);firstSlide=part.base64;
    assert(await evaluate(session,"!__personalExportCapture.assets.get('asset-1').previewPages[0].blob"));
  }
  for(const mode of ['wrong','cancel','stuck']) {
    await evaluate(session,`setupPreview('generated','${mode}')`);
    const result=await evaluate(session,"captureSlides('preview:asset-1','generated.pptx','preview','asset-1',location.href)");
    assert(result.error);assert(await evaluate(session,"!__personalExportCapture.assets.get('asset-1').previewPages&&!document.getElementById('viewer')"));
  }
  const pdf=await evaluate(ui,`(async()=>{
    const {renderAsset,openPdf}=await import('../assets.js'),{createPdf}=await import('../pdf.js'),{prepareConversation}=await import('../exporters.js');
    const slide=await renderAsset({kind:'image',mime:'image/png'},Uint8Array.from(atob('${firstSlide}'),c=>c.charCodeAt(0)).buffer);
    const c={messages:[{role:'user',blocks:[{type:'paragraph',text:'BEFORE PREVIEW'},{type:'asset',assetId:'deck',name:'Slides'},{type:'paragraph',text:'AFTER PREVIEW'}]}],assets:[{id:'deck',kind:'pptx',status:'ready',slidePreviews:true,name:'Slides',pages:[1,2].map(i=>({type:'image',data:slide.data,width:slide.width,height:slide.height,name:'Slide '+i}))}]};
    const blob=await createPdf(c),task=await openPdf(await blob.arrayBuffer()),doc=await task.promise;let text='';for(let n=1;n<=doc.numPages;n++)text+=(await(await doc.getPage(n)).getTextContent()).items.map(t=>t.str).join(' ');const count=doc.numPages;await task.destroy();
    return {count,text,redacted:JSON.stringify(prepareConversation(c,{redact:'private'}))};
  })()`);
  assert.equal(pdf.count,2,'This two-slide fixture plus message/attachment headings should paginate without clipping.');assert(pdf.text.indexOf('BEFORE PREVIEW')<pdf.text.indexOf('Slide 1'));assert(pdf.text.indexOf('Slide 2')<pdf.text.indexOf('AFTER PREVIEW'));assert(!pdf.redacted.includes('data:image/'));
  console.log('Uploaded/generated slide previews: ordered full-slide pixels, chunk cleanup, wrong viewer, cancellation, stalled navigation, paginated in-flow PDF and redaction passed.');
}
