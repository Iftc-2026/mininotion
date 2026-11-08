import {kinds,validate,type Database,type Entry} from './model';
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/** Three-way reconciliation preserves independent edits; conflicting records get a copy. */
export function reconcile(base:Database,local:Database,remote:Database):{db:Database;conflicts:number}{
 let conflicts=0;const out=validate(remote);
 for(const kind of kinds){const b=new Map(base[kind].map(r=>[r.id,r])),l=new Map(local[kind].map(r=>[r.id,r])),r=new Map(remote[kind].map(r=>[r.id,r]));const result:Entry[]=[];
  for(const id of new Set([...b.keys(),...l.keys(),...r.keys()])){
   const before=b.get(id),mine=l.get(id),theirs=r.get(id);if(!mine){if(theirs)result.push(theirs);continue;}if(!theirs){result.push(mine);continue;}if(same(mine,before)){result.push(theirs);continue;}if(same(theirs,before)||same(mine,theirs)){result.push(mine);continue;}
   let conflict=false;const merged={...theirs} as Record<string,unknown>;const myFields=mine as unknown as Record<string,unknown>,oldFields=(before||{}) as Record<string,unknown>,theirFields=theirs as unknown as Record<string,unknown>;
   for(const key of new Set([...Object.keys(oldFields),...Object.keys(myFields)])){if(key==='id'||same(myFields[key],oldFields[key]))continue;if(!same(theirFields[key],oldFields[key])&&!same(theirFields[key],myFields[key]))conflict=true;if(myFields[key]===undefined)delete merged[key];else merged[key]=myFields[key];}
   result.push(merged as Entry);if(conflict){conflicts++;result.push({...theirs,id:crypto.randomUUID(),title:theirs.title+' · копия при конфликте'});}
  }out[kind]=result;
 }
 out.profile={...remote.profile};for(const key of ['name','role'] as const)if(local.profile[key]!==base.profile[key])out.profile[key]=local.profile[key];out.theme=local.theme!==base.theme?local.theme:remote.theme;out.demoLoaded=local.demoLoaded||remote.demoLoaded;return {db:out,conflicts};
}
