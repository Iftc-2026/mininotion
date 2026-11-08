const COOKIE='__Host-mn_session',MAX_BODY=1800000,MAX_DB=1500000;
const tables=[
 'CREATE TABLE IF NOT EXISTS mn_users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL,recovery_hash TEXT NOT NULL,created INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS mn_sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL)',
 'CREATE INDEX IF NOT EXISTS mn_sessions_user ON mn_sessions(user_id)',
 'CREATE TABLE IF NOT EXISTS mn_workspaces(user_id TEXT PRIMARY KEY,db TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS mn_history(user_id TEXT NOT NULL,revision INTEGER NOT NULL,db TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(user_id,revision))',
 'CREATE TABLE IF NOT EXISTS mn_rates(id TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL)'
];
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin',...headers}});
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const hash=async text=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))));
export async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256)));}
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0;};
const cookie=(token,maxAge=2592000)=>`${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
const blank=name=>({version:1,profile:{name,role:''},theme:'light',demoLoaded:false,tasks:[],projects:[],meetings:[],contacts:[],notes:[]});
export function validWorkspace(d){if(!d||d.version!==1||!d.profile||typeof d.profile.name!=='string'||d.profile.name.length>200||typeof d.profile.role!=='string'||d.profile.role.length>200)throw Error('Некорректный профиль.');for(const kind of ['tasks','projects','meetings','contacts','notes']){if(!Array.isArray(d[kind])||d[kind].length>10000)throw Error('Некорректные записи.');const ids=new Set();for(const r of d[kind]){if(!r||typeof r.id!=='string'||!(/^[a-zA-Z0-9_-]{1,80}$/).test(r.id)||ids.has(r.id)||typeof r.title!=='string'||r.title.length>150000)throw Error('Некорректная запись.');ids.add(r.id);for(const field of ['status','priority','date','time','end','owner','contact','project','place','body','company','position','phone','email','createdAt','deletedAt'])if(r[field]!=null&&(typeof r[field]!=='string'||r[field].length>150000))throw Error('Некорректное поле записи.');if(r.seconds!=null&&(!Number.isFinite(r.seconds)||r.seconds<0))throw Error('Некорректное время.');if(r.startedAt!=null&&!Number.isFinite(r.startedAt))throw Error('Некорректный таймер.');if(r.checklist!=null&&(!Array.isArray(r.checklist)||r.checklist.length>200||r.checklist.some(c=>!c||typeof c.id!=='string'||typeof c.text!=='string'||c.text.length>1000||typeof c.done!=='boolean')))throw Error('Некорректный чек-лист.');}}return d;}
async function body(request){if(Number(request.headers.get('content-length')||0)>MAX_BODY)throw Error('Слишком большой запрос.');const reader=request.body?.getReader();if(!reader)return {};let total=0;const chunks=[];for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>MAX_BODY){await reader.cancel();throw Error('Слишком большой запрос.');}chunks.push(value);}const bytes=new Uint8Array(total);let p=0;for(const chunk of chunks){bytes.set(chunk,p);p+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));}
async function rate(db,request,scope,limit,windowSeconds){const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/windowSeconds),id=await hash(`${scope}|${request.headers.get('CF-Connecting-IP')||'local'}|${bucket}`);await db.prepare('INSERT INTO mn_rates(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1').bind(id,now+windowSeconds*2).run();const row=await db.prepare('SELECT count FROM mn_rates WHERE id=?').bind(id).first();return row.count<=limit;}
async function session(db,request){const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-mn_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!token)return null;return db.prepare('SELECT u.id,u.username FROM mn_users u JOIN mn_sessions s ON s.user_id=u.id WHERE s.hash=? AND s.expires>?').bind(await hash(token),Date.now()).first();}
async function startSession(db,user){const token=random();await db.prepare('INSERT INTO mn_sessions(hash,user_id,expires) VALUES(?,?,?)').bind(await hash(token),user.id,Date.now()+2592000000).run();return cookie(token);}
async function workspace(db,user){const row=await db.prepare('SELECT db,revision,updated FROM mn_workspaces WHERE user_id=?').bind(user.id).first();return {db:JSON.parse(row.db),revision:row.revision,updated:row.updated};}
export async function api(request,env){
 const path=new URL(request.url).pathname.replace(/\/$/,'');if(!env.DB)return json({error:'Облачная база ещё не подключена.'},503);
 if(!['GET','POST','PUT'].includes(request.method))return json({error:'Метод не поддерживается.'},405);
 if(request.method!=='GET'&&(request.headers.get('Origin')!==new URL(request.url).origin||!request.headers.get('Content-Type')?.startsWith('application/json')))return json({error:'Запрос отклонён.'},403);
 await env.DB.batch(tables.map(sql=>env.DB.prepare(sql)));
 if(path==='/api/session'&&request.method==='GET')return json({user:await session(env.DB,request)});
 if(['/api/signup','/api/login','/api/recover'].includes(path)&&request.method==='POST'){
  if(!await rate(env.DB,request,path,path==='/api/signup'?5:15,900))return json({error:'Слишком много попыток. Повторите через 15 минут.'},429,{'Retry-After':'900'});
  let input;try{input=await body(request);}catch{return json({error:'Не удалось прочитать форму.'},400);}
  const username=typeof input.username==='string'?input.username.trim().toLowerCase():'';const password=input.password;
  if(!/^[a-z0-9_.-]{3,64}$/.test(username)||typeof password!=='string'||password.length>256)return json({error:'Логин: 3–64 латинских буквы, цифры, точка, дефис или подчёркивание.'},400);
  let user=await env.DB.prepare('SELECT * FROM mn_users WHERE username=?').bind(username).first();
  if(path==='/api/signup'){
   if(password.length<12)return json({error:'Пароль должен содержать не менее 12 символов.'},400);
   if(user)return json({error:'Этот логин уже занят.'},409);
   const id=crypto.randomUUID(),salt=random(),recovery=random(),password_hash=await passwordHash(password,salt),now=Date.now();
   try{await env.DB.batch([env.DB.prepare('INSERT INTO mn_users(id,username,salt,password_hash,recovery_hash,created) VALUES(?,?,?,?,?,?)').bind(id,username,salt,password_hash,await hash(recovery),now),env.DB.prepare('INSERT INTO mn_workspaces(user_id,db,revision,updated) VALUES(?,?,0,?)').bind(id,JSON.stringify(blank(String(input.name||username).slice(0,80))),now)]);}catch{return json({error:'Не удалось создать аккаунт. Попробуйте другой логин.'},409);}
   user={id,username};return json({user,recovery,...await workspace(env.DB,user)},201,{'Set-Cookie':await startSession(env.DB,user)});
  }
  if(path==='/api/recover'){
   if(password.length<12||typeof input.recovery!=='string'||!user||!equal(user.recovery_hash,await hash(input.recovery.trim())))return json({error:'Проверьте логин, код восстановления и новый пароль (от 12 символов).'},401);
   const salt=random(),recovery=random();await env.DB.batch([env.DB.prepare('UPDATE mn_users SET salt=?,password_hash=?,recovery_hash=? WHERE id=?').bind(salt,await passwordHash(password,salt),await hash(recovery),user.id),env.DB.prepare('DELETE FROM mn_sessions WHERE user_id=?').bind(user.id)]);
   return json({user:{id:user.id,username},recovery,...await workspace(env.DB,user)},200,{'Set-Cookie':await startSession(env.DB,user)});
  }
  const calculated=await passwordHash(password,user?.salt||'mininotion-dummy-salt-for-timing');if(!user||!equal(calculated,user.password_hash))return json({error:'Неверный логин или пароль.'},401);
  await env.DB.batch([env.DB.prepare('DELETE FROM mn_sessions WHERE expires<?').bind(Date.now()),env.DB.prepare('DELETE FROM mn_rates WHERE expires<?').bind(Math.floor(Date.now()/1000))]);
  return json({user:{id:user.id,username},...await workspace(env.DB,user)},200,{'Set-Cookie':await startSession(env.DB,user)});
 }
 const user=await session(env.DB,request);if(!user)return json({error:'Войдите в аккаунт.'},401);
 if(path==='/api/logout'&&request.method==='POST'){const token=request.headers.get('Cookie')?.match(/__Host-mn_session=([a-f0-9]{64})/)?.[1];if(token)await env.DB.prepare('DELETE FROM mn_sessions WHERE hash=?').bind(await hash(token)).run();return json({ok:true},200,{'Set-Cookie':cookie('',0)});}
 if(path==='/api/workspace'&&request.method==='GET')return json(await workspace(env.DB,user));
 if(path==='/api/workspace'&&request.method==='PUT'){
  if(!await rate(env.DB,request,'write:'+user.id,120,60))return json({error:'Слишком частые изменения. Синхронизация повторится.'},429);
  let input,text;try{input=await body(request);text=JSON.stringify(validWorkspace(input.db));}catch(e){return json({error:e.message||'Некорректные данные.'},400);}
  if(new TextEncoder().encode(text).length>MAX_DB)return json({error:'Объём записей превышает 1,5 МБ. Сохраните копию и сократите большие заметки.'},413);
  const current=await workspace(env.DB,user);if(!Number.isInteger(input.revision)||input.revision!==current.revision)return json(current,409);
  await env.DB.prepare('INSERT OR IGNORE INTO mn_history(user_id,revision,db,created) VALUES(?,?,?,?)').bind(user.id,current.revision,JSON.stringify(current.db),Date.now()).run();
  const result=await env.DB.prepare('UPDATE mn_workspaces SET db=?,revision=revision+1,updated=? WHERE user_id=? AND revision=?').bind(text,Date.now(),user.id,input.revision).run();
  if(!result.meta.changes)return json(await workspace(env.DB,user),409);
  await env.DB.prepare('DELETE FROM mn_history WHERE user_id=? AND revision<?').bind(user.id,current.revision-19).run();
  return json({db:input.db,revision:input.revision+1,updated:Date.now()});
 }
 return json({error:'Не найдено.'},404);
}
export default {async fetch(request,env){if(!new URL(request.url).pathname.startsWith('/api/'))return env.ASSETS.fetch(request);try{return await api(request,env);}catch{return json({error:'Облачное хранилище временно недоступно. Изменения остаются на устройстве.'},503);}}};
