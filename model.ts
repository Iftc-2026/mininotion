export const KEY='mininotion.v1';
export const kinds=['tasks','projects','meetings','contacts','notes'] as const;
export type Kind=typeof kinds[number];
export const statuses=['Запланировано','В работе','Ожидание','Готово'] as const;
export const priorities=['Высокий','Обычный','Низкий'] as const;
export type Entry={id:string;title:string;status?:string;priority?:string;date?:string;time?:string;end?:string;owner?:string;contact?:string;project?:string;place?:string;body?:string;company?:string;position?:string;phone?:string;email?:string;seconds?:number;startedAt?:number|null;createdAt?:string;deletedAt?:string};
export type Database={version:1;profile:{name:string;role:string};theme:'light'|'dark';demoLoaded:boolean}&Record<Kind,Entry[]>;
export const fresh=():Database=>({version:1,profile:{name:'Серик',role:'Моё личное пространство'},theme:'light',demoLoaded:false,tasks:[],projects:[],contacts:[],meetings:[],notes:[]});
export const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const live=(db:Database,kind:Kind)=>db[kind].filter(r=>!r.deletedAt);
export function validate(input:unknown):Database{
 if(!input||typeof input!=='object')throw Error('Ожидался файл резервной копии МиниНоушн.');
 const d=input as Database;if(d.version!==1||!d.profile||typeof d.profile.name!=='string'||d.profile.name.length>200)throw Error('Неподдерживаемый формат резервной копии.');
 const out=fresh();out.profile={name:d.profile.name,role:typeof d.profile.role==='string'?d.profile.role.slice(0,200):''};out.theme=d.theme==='dark'?'dark':'light';out.demoLoaded=!!d.demoLoaded;
 for(const kind of kinds){if(!Array.isArray(d[kind])||d[kind].length>10000)throw Error('Некорректный список записей.');const ids=new Set<string>();out[kind]=d[kind].map(r=>{
  if(!r||typeof r.id!=='string'||!(/^[a-zA-Z0-9_-]{1,80}$/).test(r.id)||ids.has(r.id)||typeof r.title!=='string')throw Error('Некорректная запись.');ids.add(r.id);
  const entry:Entry={id:r.id,title:r.title};
  for(const key of ['status','priority','date','time','end','owner','contact','project','place','body','company','position','phone','email','createdAt','deletedAt'] as const){if(r[key]!=null){if(typeof r[key]!=='string'||r[key]!.length>150000)throw Error('Некорректное поле записи.');entry[key]=r[key];}}
  entry.seconds=Number.isFinite(r.seconds)?Math.max(0,r.seconds!):0;entry.startedAt=Number.isFinite(r.startedAt)&&r.startedAt!>0?r.startedAt:null;
  if(kind==='tasks'){entry.status=statuses.includes(entry.status as typeof statuses[number])?entry.status:statuses[0];entry.priority=priorities.includes(entry.priority as typeof priorities[number])?entry.priority:'Обычный';}
  return entry;
 });}return out;
}
export function readDatabase(storage:Pick<Storage,'getItem'>):{db:Database;error:string|null;raw:string|null}{
 let raw:string|null=null;try{raw=storage.getItem(KEY);return {db:raw?validate(JSON.parse(raw)):fresh(),error:null,raw};}catch{return {db:fresh(),error:'Не удалось прочитать сохранение. Исходные данные оставлены без изменений. Восстановите резервную копию в настройках.',raw};}
}
export function mergeDatabase(current:Database,incoming:Database):Database{const next={...current,profile:incoming.profile,demoLoaded:current.demoLoaded||incoming.demoLoaded};for(const k of kinds){const map=new Map(current[k].map(r=>[r.id,r]));incoming[k].forEach(r=>map.set(r.id,r));next[k]=Array.from(map.values());}return next;}
export function stopTimer(entry:Entry,now=Date.now()):Entry{return {...entry,seconds:(entry.seconds||0)+(entry.startedAt?Math.max(0,Math.floor((now-entry.startedAt)/1000)):0),startedAt:null};}
export function toggleTimer(db:Database,id:string,now=Date.now()):Database{const target=db.tasks.find(r=>r.id===id);if(!target)return db;return {...db,tasks:db.tasks.map(r=>r.id===id?target.startedAt?stopTimer(r,now):{...r,startedAt:now,status:r.status==='Готово'||r.status==='Запланировано'?'В работе':r.status}:r.startedAt?stopTimer(r,now):r)};}
export function complete(db:Database,id:string,done:boolean):Database{return {...db,tasks:db.tasks.map(r=>r.id===id?{...(r.startedAt&&done?stopTimer(r):r),status:done?'Готово':'Запланировано'}:r)};}
export function moveToTrash(db:Database,kind:Kind,id:string):Database{return {...db,[kind]:db[kind].map(r=>r.id===id?{...(r.startedAt?stopTimer(r):r),deletedAt:new Date().toISOString()}:r)};}
export function restore(db:Database,kind:Kind,id:string):Database{return {...db,[kind]:db[kind].map(r=>{if(r.id!==id)return r;const next={...r};delete next.deletedAt;return next;})};}
export function duration(r:Entry,now=Date.now()){const sec=(r.seconds||0)+(r.startedAt?Math.max(0,(now-r.startedAt)/1000):0);return `${Math.floor(sec/3600)}:${String(Math.floor(sec/60)%60).padStart(2,'0')}`;}
export function label(db:Database,kind:Kind,id?:string){return db[kind].find(r=>r.id===id)?.title||'—';}
export function fmtDate(date?:string){return date&&/^\d{4}-\d{2}-\d{2}$/.test(date)?new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}):'Без даты';}
export function csv(db:Database){const cell=(v:unknown)=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};const rows=[['Название','Статус','Приоритет','Срок','Время','Проект','Ответственный','Контакт','Затрачено','Описание'],...live(db,'tasks').map(r=>[r.title,r.status,r.priority,r.date,r.time,label(db,'projects',r.project),r.owner,label(db,'contacts',r.contact),duration(r),r.body])];return rows.map(row=>row.map(cell).join(';')).join('\r\n');}
export function download(content:string,name:string,type='application/json'){const url=URL.createObjectURL(new Blob(['\ufeff',content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
export function addDemo(db:Database):Database{if(db.demoLoaded)return db;const p=crypto.randomUUID(),c=crypto.randomUUID(),date=localDate();return {...db,demoLoaded:true,projects:[...db.projects,{id:p,title:'Пример · Новый проект',status:'В работе',owner:'Я',date,body:'Определить результат, собрать идеи и согласовать первые шаги.'}],contacts:[...db.contacts,{id:c,title:'Пример · Алексей',company:'Команда проекта',position:'Координатор',body:'Замените демонстрационный контакт своими данными.'}],tasks:[...db.tasks,...['Определить следующий шаг','Подготовить материалы','Согласовать план'].map((title,i)=>({id:crypto.randomUUID(),title:'Пример · '+title,status:statuses[i],priority:priorities[i],project:p,contact:c,date,owner:'Я',seconds:0}))],meetings:[...db.meetings,{id:crypto.randomUUID(),title:'Пример · Обсуждение проекта',date,time:'14:00',end:'15:00',contact:c,project:p,place:'Офис / онлайн',body:'Запишите итоги и договорённости.'}],notes:[...db.notes,{id:crypto.randomUUID(),title:'Пример · Мои идеи',project:p,date,body:'Что хочу сделать?\nКакой результат ожидаю?\nС кем нужно обсудить?'}]};}
