import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareConversation} from '../src/exporters.js';
import {detectedAttachmentTypes} from '../src/attachment-selection.js';
const assets=[{id:'i',kind:'image'},{id:'p',kind:'pptx'},{id:'t',kind:'artifact',sourceKind:'txt'},{id:'d',kind:'docx',status:'unavailable'}];
const conversation={messages:[{role:'user',blocks:[{type:'paragraph',text:'before'},...assets.map(a=>({type:'asset',assetId:a.id})),{type:'paragraph',text:'after'}]},{role:'assistant',blocks:[{type:'paragraph',text:'answer'}]}],assets};
test('attachment types include unavailable files, keeping images separate',()=>{
  assert.deepEqual(detectedAttachmentTypes(assets),[['docx',1],['image',1],['pptx',1],['txt',1]]);
});
test('type filters preserve flow and do not mutate captured content',()=>{
  const c=prepareConversation(conversation,{attachmentTypes:['pptx','txt'],includeImages:false});
  assert.deepEqual(c.assets.map(a=>a.id),['p','t']);
  assert.deepEqual(c.messages[0].blocks.map(b=>b.text||b.assetId),['before','p','t','after']);
  assert.equal(conversation.messages[0].blocks.length,6);
});
test('empty type selection removes documents but leaves images independently selectable',()=>{
  assert.deepEqual(prepareConversation(conversation,{attachmentTypes:[]}).assets.map(a=>a.id),['i']);
  assert(!prepareConversation(conversation,{attachmentTypes:[],includeImages:false}).assets);
  assert(!prepareConversation(conversation,{range:'selected',selected:[1]}).assets);
  assert.equal(prepareConversation(conversation).assets.length,4);
});
test('PPTX text is redacted and embedded pixels are omitted independently of image selection',()=>{
  const source={messages:[{role:'user',blocks:[{type:'asset',assetId:'deck'}]}],assets:[{id:'deck',kind:'pptx',status:'ready',blocks:[{type:'paragraph',text:'private text'},{type:'image',data:'data:image/png;base64,AAAA',preventUpscale:true}]}]};
  const cleaned=prepareConversation(source,{redact:'private',includeImages:false});
  assert.equal(cleaned.assets[0].blocks[0].text,'[redacted] text');
  assert.equal(cleaned.assets[0].blocks[1].type,'attachment-note');
  assert.equal(source.assets[0].blocks[1].type,'image');
});
