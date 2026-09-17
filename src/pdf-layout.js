// Original document layout. No HTML or executable artifact markup reaches the PDF engine.
import { platformLogo, platformName, numberedMessages } from './document-identity.js';
const raster = value => typeof value === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value);
export function fontRuns(value, font = 'Roboto') {
  const parts = String(value ?? '').split(/([\u0900-\u097f\uA8E0-\uA8FF][\u0900-\u097f\uA8E0-\uA8FF\u200c\u200d]*|[\u0D00-\u0D7F][\u0D00-\u0D7F\u200c\u200d]*|[\u0B80-\u0BFF][\u0B80-\u0BFF\u200c\u200d]*|[\p{Extended_Pictographic}\p{Regional_Indicator}][\p{Extended_Pictographic}\p{Regional_Indicator}\u200d\uFE0F\uFE0E\u{1F3FB}-\u{1F3FF}]*)/u);
  return parts.filter(Boolean).map(text => ({ text, font: /[\u0900-\u097f\uA8E0-\uA8FF]/.test(text) ? 'Devanagari' : /[\u0D00-\u0D7F]/.test(text) ? 'Malayalam' : /[\u0B80-\u0BFF]/.test(text) ? 'Tamil' : /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(text) ? 'Emoji' : font==='Mono'&&/[^\x00-\xff]/.test(text)?'Roboto':font }));
}
export function pdfDefinition(c, theme = 'light') {
  const dark = theme === 'dark';
  const colors = { ink: dark ? '#edf3ef' : '#233c33', muted: dark ? '#a9bbb2' : '#6b7e74', green: dark ? '#b8dca0' : '#356b50',
    rule: dark ? '#547061' : '#c8d5cc', panel: dark ? '#263f33' : '#f0f4f0', paper: dark ? '#192d24' : '#ffffff',
    user: dark ? '#294a39' : '#edf3e9', assistant: dark ? '#20382c' : '#fafcf9' };
  const content = [], images = {};
  let imageId = 0;
  const text = (value, extra = {}) => ({ text: fontRuns(value), ...extra });
  function imageBlock(image, documentPage = false) {
    if (!raster(image.data)) return text('Image unavailable.', { style: 'note' });
    const key = 'image' + (++imageId); images[key] = image.data;
    return { image: key, fit: [437, documentPage ? 600 : 250], alignment: 'center', margin: [0, 6, 0, 5] };
  }
  function block(b) {
    if (b.type === 'asset') {
      const a = c.assets?.find(item => item.id === b.assetId);
      if (!a || a.status !== 'ready') return text((b.name || 'Attachment') + ' — ' + (a?.error || 'not available'), { style: 'note' });
      if (a.kind === 'image') return [imageBlock(a), text(a.name, { style: 'caption' })];
      const nodes = [text(a.name, { style: 'attachment' })];
      if (a.pages) a.pages.forEach(page => { nodes.push({stack:[imageBlock(page, true), text(page.name, { style: 'caption' })],unbreakable:true}); });
      if (a.blocks) nodes.push(...a.blocks.flatMap(block));
      for (const warning of a.warnings || []) nodes.push(text(warning, { style: 'note' }));
      return nodes;
    }
    if (b.type === 'image') return [imageBlock(b), text(b.name, { style: 'caption' })];
    if (b.type === 'heading') return text(b.text, { style: 'heading', fontSize: b.level <= 2 ? 17 : 13 });
    if (b.type === 'code') {
      const lines = String(b.text || '').replace(/\t/g, '    ').split('\n');
      return [
        // Repeating label stays with the first line instead of being stranded on the previous page.
        { table: { widths: ['*'], headerRows: 1, keepWithHeaderRows: 1, body: [
          [text((b.language || 'code').toUpperCase(), {style:'codeLabel',fillColor:colors.panel})],
          ...lines.map(line => [{ text: fontRuns(line || ' ', 'Mono'), style: 'code', fillColor: colors.panel }])] },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 2, paddingBottom: () => 2 }, margin: [0, 0, 0, 12] }
      ];
    }
    if (b.type === 'table') {
      const width = b.rows.reduce((n, row) => Math.max(n, row.length), 0);
      if (!width) return [];
      // Wide tables are stacked as labelled rows so columns never disappear off-page.
      if (width > 7) return b.rows.slice(1).map(row => ({ stack: row.map((cell,i) => text((b.rows[0][i] || 'Column ' + (i+1)) + ': ' + cell)), margin: [0, 4, 0, 10] }));
      return { table: { headerRows: 1, widths: Array(width).fill('*'), body: b.rows.map((row,i) => Array.from({length:width},(_,j) => text(row[j] || '', { bold: i === 0, fillColor: i === 0 ? colors.panel : colors.paper, margin: [0,2,0,2] }))) },
        layout: { hLineColor: () => colors.rule, vLineColor: () => colors.rule, hLineWidth: () => .5, vLineWidth: () => .5, paddingLeft: () => 7, paddingRight: () => 7, paddingTop: () => 5, paddingBottom: () => 5 }, fontSize: 9, margin: [0, 6, 0, 14] };
    }
    if (b.type === 'list') return { [b.ordered ? 'ol' : 'ul']: b.items.map(item => text(item)), margin: [0, 2, 0, 12] };
    if (b.type === 'quote') return text(b.text, { italics: true, color: colors.muted, margin: [14, 5, 0, 14] });
    return text(b.text || '', { style: b.type === 'attachment-note' ? 'note' : 'body' });
  }
  content.push(text('TERNOTE  /  CONVERSATION', { fontSize: 8, characterSpacing: 1.4, color: colors.green, bold: true, margin: [0, 0, 0, 12] }));
  content.push(text(c.title || 'Conversation', { style: 'title' }));
  const logo = platformLogo(c.platform, dark);
  if (c.platform) content.push({ columns: [
    ...(logo ? [{ svg: logo, width: 22, height: 22, margin: [0, -4, 0, 0] }] : []),
    text(platformName(c.platform) + '  /  ' + c.messages.length + ' messages', { bold: true, fontSize: 10, width: '*' })
  ], columnGap: 8, margin: [0, 0, 0, 8] });
  if (c.platform) content.push(text('Model: ' + (c.model || 'Not exposed by the page') + '    ·    Effort: ' + (c.effort || 'Not exposed by the page'), { style: 'meta' }));
  if (c.exportedAt) content.push(text('Exported ' + c.exportedAt.slice(0,10), { style: 'meta' }));
  if (c.sourceUrl) content.push(text(c.sourceUrl, { style: 'meta', ...( /^https:\/\//.test(c.sourceUrl) ? {link:c.sourceUrl} : {}), margin: [0, 0, 0, 12] }));
  for (const warning of c.capture?.warnings || []) content.push(text(warning, { style: 'note' }));
  numberedMessages(c.messages).forEach(message => {
    let segment = [], continuation = false;
    const isUser = message.role === 'user', isAssistant = message.role === 'assistant';
    function flush() {
      if (!segment.length) return;
      const label = isUser ? 'USER' : isAssistant ? (logo ? '' : platformName(c.platform)) : message.role.toUpperCase();
      const header = { columns: [
        ...(isAssistant && logo ? [{svg:logo,width:17,height:17,margin:[0,-3,0,0]}] : []),
        text((label ? label + '  ' : '') + message.turn + (continuation ? '  ·  CONTINUED' : ''), {style:'speaker',width:'*'})
      ], columnGap: 6 };
      // Each block is a breakable row: long answers/code paginate without clipping.
      content.push({ table: { widths: ['*'], headerRows: 1,
        body: [[header], ...segment.map(node => [{stack: Array.isArray(node) ? node : [node]}])] },
        layout: {
          fillColor: () => isUser ? colors.user : colors.assistant,
          hLineWidth: (i,node) => i === 0 || i === node.table.body.length ? .7 : 0,
          vLineWidth: i => i === 0 ? (isUser ? 2.5 : 1) : .7,
          hLineColor: () => colors.rule, vLineColor: i => i === 0 && isUser ? colors.green : colors.rule,
          paddingLeft: () => 13, paddingRight: () => 13,
          paddingTop: i => i === 0 ? 11 : 2, paddingBottom: () => 4
        }, margin:[0,8,0,6] });
      segment = []; continuation = true;
    }
    for (const b of message.blocks) {
      if (b.type !== 'asset') { segment.push(block(b)); continue; }
      flush();
      const nodes = [block(b)].flat(Infinity);
      if (nodes.length) {
        const asset = c.assets?.find(a => a.id === b.assetId);
        const compact = !asset || asset.status !== 'ready' || asset.kind === 'image';
        const heading = text((isUser?'USER':platformName(c.platform))+' '+message.turn+'  /  ATTACHMENT',{style:'speaker'});
        content.push({table:{widths:['*'],headerRows:1,keepWithHeaderRows:1,
          body:[[heading],...(compact ? [[{stack:nodes}]] : nodes.map(node=>[{stack:[node]}]))]},
          ...(compact ? {unbreakable:true} : {}),
          layout:{hLineWidth:(i,node)=>(i===0||i===node.table.body.length) ? .7 : 0,
            vLineWidth:()=>.7,hLineColor:()=>colors.rule,vLineColor:()=>colors.rule,
            fillColor:()=>colors.panel,paddingLeft:()=>12,paddingRight:()=>12,paddingTop:()=>5,paddingBottom:()=>5},
          margin:[0,6,0,6]});
      }
    }
    flush();
  });
  const last=content.at(-1);
  if(last){const margin=Array.isArray(last.margin)?last.margin:[0,0,0,0];last.margin=[margin[0],margin[1],margin[2],0];}
  return {
    pageSize: 'A4', pageMargins: [52, 50, 52, 52], compress: true,
    info: { title: c.title || 'Conversation', creator: 'Ternote' },
    background: () => ({ canvas: [{ type: 'rect', x: 0, y: 0, w: 595.28, h: 841.89, color: colors.paper }] }),
    defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.25, color: colors.ink },
    styles: {
      title: { fontSize: 25, bold: true, lineHeight: 1.12, margin: [0, 0, 0, 15] },
      meta: { fontSize: 8.5, color: colors.muted, margin: [0,0,0,5] },
      speaker: { fontSize: 9, bold: true, color: colors.green, characterSpacing: .5, margin: [0, 0, 0, 5] },
      body: { margin: [0, 0, 0, 6] },
      heading: { bold: true, margin: [0,12,0,8] },
      codeLabel: { fontSize: 7.5, bold: true, color: colors.muted, margin: [0,5,0,5] },
      code: { fontSize: 8, lineHeight: 1.1 },
      caption: { fontSize: 8, color: colors.muted, alignment: 'center', margin: [0, 0, 0, 12] },
      attachment: { fontSize: 13, bold: true, color: colors.green, margin: [0,15,0,8] },
      note: { fontSize: 8.5, color: colors.muted, margin: [0,4,0,10] }
    },
    footer: (current, total) => ({ columns: [
      { text: 'TERNOTE', fontSize: 7, characterSpacing: 1, color: colors.muted },
      { text: current + ' / ' + total, fontSize: 8, alignment: 'right', color: colors.muted }
    ], margin: [52, 20, 52, 0] }),
    pageBreakBefore: (node, container) => node.headlineLevel === 1 && container.getFollowingNodesOnPage().length === 0,
    content, images
  };
}
