declare module 'pg' { export class Pool {constructor(options:{connectionString:string});query(sql:string,params?:unknown[]):Promise<{rows:any[]}>;} }
