// Unreleased draft. Injection boundary: no module dependencies or chat text is returned.
export async function probeConversation(config, options={}) {
  if(location.protocol!=='https:'||location.hostname!==config.host)throw new Error('The conversation page changed.');
  const rootSelectors=config.selectors.join(',');
  function roots(){
    for(const selector of config.selectors){
      const nodes=[...document.querySelectorAll(selector)].filter(n=>n.getClientRects().length&&!n.closest('[hidden],[aria-hidden="true"]'));
      const set=new Set(nodes),out=nodes.filter(n=>{for(let p=n.parentElement;p;p=p.parentElement)if(set.has(p))return false;return true;});
      if(out.length)return out;
    }return [];
  }
  function role(el){return config.user.some(s=>el.matches(s))?'user':config.assistant.some(s=>el.matches(s))?'assistant':'unknown';}
  function sourceId(el){
    for(let n=el;n&&n!==document.body;n=n.parentElement)for(const attr of ['data-message-id','data-turn-id','id']){
      const value=n.getAttribute(attr);
      if(value&&(n===el||n.matches('article,[data-message-id],[data-turn-id]')))return 'stable:'+attr+':'+value+':'+role(el);
    }return null;
  }
  let state=globalThis.__personalExportProbeState;
  if(!state||state.url!==location.origin+location.pathname){
    state?.observer.disconnect();clearTimeout(state?.timer);
    state={documentId:crypto.randomUUID(),url:location.origin+location.pathname,changed:new Set(),tailIds:new Set(),unknownChange:false};
    state.observer=new MutationObserver(changes=>{
      for(const change of changes){
        const node=change.target.nodeType===Node.ELEMENT_NODE?change.target:change.target.parentElement;
        if(node?.closest('button,[data-personal-exporter],textarea,input,[contenteditable="true"]'))continue;
        const message=node?.closest(rootSelectors);
        if(message){const id=sourceId(message);id?state.changed.add(id):state.unknownChange=true;}
        if(change.type==='childList')for(const removed of change.removedNodes)if(removed.nodeType===Node.ELEMENT_NODE){
          const removedMessages=removed.matches(rootSelectors)?[removed]:[...removed.querySelectorAll(rootSelectors)];
          for(const m of removedMessages){const id=sourceId(m);if(id)state.changed.add(id);else state.unknownChange=true;}
        }
      }
    });
    state.observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['src','href','data-message-id','data-turn-id']});
    globalThis.__personalExportProbeState=state;
  }
  clearTimeout(state.timer);
  state.timer=setTimeout(()=>{state.observer.disconnect();if(globalThis.__personalExportProbeState===state)delete globalThis.__personalExportProbeState;delete globalThis.__personalExportProbe;},30*60*1000);
  const nodes=roots();
  let scroller=document.scrollingElement;
  for(let p=nodes[0]?.parentElement;p&&p!==document.body;p=p.parentElement)if(p.scrollHeight>p.clientHeight+2&&/(auto|scroll)/.test(getComputedStyle(p).overflowY)){scroller=p;break;}
  const last=nodes.at(-1),atBottom=scroller.scrollTop>=scroller.scrollHeight-scroller.clientHeight-4;
  const scrollerTop=scroller===document.scrollingElement?0:scroller.getBoundingClientRect().top;
  const lastBottom=last?last.getBoundingClientRect().bottom-scrollerTop+scroller.scrollTop:0;
  const tailAnchored=!!last&&(atBottom||lastBottom>=scroller.scrollHeight-240);
  function text(n){
    if(n.nodeType===Node.TEXT_NODE)return n.textContent;
    if(n.nodeType!==Node.ELEMENT_NODE||n.matches('script,style,noscript,textarea,input,select,nav,[hidden],[aria-hidden="true"],[contenteditable="true"]'))return '';
    if(n.tagName==='BUTTON'&&!/\.[a-z0-9]{1,10}\b/i.test(n.textContent))return [...n.querySelectorAll('img')].map(text).join('');
    if(n.tagName==='IMG'){let src=n.currentSrc||n.src;try{const u=new URL(src,location.href);src=u.protocol==='data:'?'inline-image:'+src.length:u.origin+u.pathname;}catch{}return '[image:'+src+':'+n.alt+']';}
    return [...n.childNodes].map(text).join(n.tagName==='BR'?'\n':'');
  }
  const tail=[];
  for(const node of nodes.slice(-5)){
    const normalized=role(node)+'\n'+text(node).replace(/\s+/g,' ').trim();
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized));
    tail.push({id:sourceId(node),hash:[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')});
  }
  let olderChanged=state.unknownChange||[...state.changed].some(id=>!state.tailIds.has(id));
  if(options.reset){state.changed.clear();state.unknownChange=false;state.tailIds=new Set(tail.map(t=>t.id).filter(Boolean));olderChanged=false;}
  globalThis.__personalExportProbe=()=>probeConversation(config,{reset:true});
  return {url:state.url,documentId:state.documentId,tail,tailAnchored,renderedCount:nodes.length,olderChanged,
    streaming:!!document.querySelector('button[data-testid="stop-button"],button[aria-label="Stop generating"],[data-is-streaming="true"]')};
}
export function stopProbe(){
  const state=globalThis.__personalExportProbeState;state?.observer.disconnect();clearTimeout(state?.timer);
  delete globalThis.__personalExportProbeState;delete globalThis.__personalExportProbe;
}
