/* 纯数据行为：排序、选择与原表搜索；不修改政策快照。 */
(() => {
 'use strict';
 const data=window.SUZHOU_COMPARE,book=window.SUZHOU_WORKBOOK;if(!data||!book)return;
 const byId=new Map(data.amounts.map(r=>[r.id,r])),byRegion=new Map(data.regions.map(r=>[r.id,r]));
 const normalize=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('zh-CN');
 const sourceRows=book.sheets.flatMap((sheet,sheetIndex)=>sheet.rows.map(row=>({sheet,sheetIndex,row,search:normalize(sheet.name+' '+row.index+' '+row.cells.map(c=>c.address+' '+c.display+' '+(c.formula||'')).join(' '))})));
 const view=id=>data.views.find(v=>v.id===id)||data.views[0];
 function ranked(id){return view(id).ids.map(id=>byId.get(id)).filter(r=>r&&typeof r.max==='number'&&Number.isFinite(r.max)).slice().sort((a,b)=>a.max-b.max||byRegion.get(a.regionId).order-byRegion.get(b.regionId).order);}
 function missing(id){return view(id).ids.map(id=>byId.get(id)).filter(r=>r&&r.max===null);}
 function separate(id){return view(id).separate.map(id=>byId.get(id));}
 function select(ids,id){if(!byRegion.has(id))return {ids:[...ids],rejected:true};const next=new Set(ids);if(next.has(id))next.delete(id);else{if(next.size>=4)return {ids:[...ids],rejected:true};next.add(id);}return {ids:data.regions.filter(r=>next.has(r.id)).map(r=>r.id),rejected:false};}
 function search(query){const q=normalize(query.trim());return q?sourceRows.filter(r=>r.search.includes(q)):[];}
 function regionRecord(regionId,category){return data.amounts.find(r=>r.regionId===regionId&&r.category===category)||null;}
 window.SUZHOU_MODEL={view,ranked,missing,separate,select,search,regionRecord,region:id=>byRegion.get(id),record:id=>byId.get(id),normalize};
})();
