export function redactToken(token:string|undefined):string{if(!token)return '(未设置)';if(token.length<=8)return '***';return token.slice(0,4)+'…'+token.slice(-4)}
export function redactHost(value:string|undefined):string|undefined{if(!value)return value;try{const u=new URL(value);return u.hostname+(u.port?':'+u.port:'')}catch{return '[无效代理地址]'}}
