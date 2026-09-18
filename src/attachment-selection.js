export function attachmentType(asset) {
  if (asset.kind==='image') return 'image';
  const type=asset.sourceKind || (asset.kind==='artifact' ? asset.name?.match(/\.([a-z0-9]+)$/i)?.[1] : asset.kind);
  return /^[a-z0-9]{1,12}$/i.test(type||'') ? type.toLowerCase() : 'other';
}
export function detectedAttachmentTypes(assets=[]) {
  const counts=new Map();
  for(const asset of assets) { const type=attachmentType(asset); counts.set(type,(counts.get(type)||0)+1); }
  return [...counts].sort(([a],[b])=>a.localeCompare(b));
}
