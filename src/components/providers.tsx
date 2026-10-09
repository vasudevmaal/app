'use client';
import {createContext,useContext,useState,ReactNode} from 'react';
import {X,CheckCircle,AlertCircle} from 'lucide-react';
import type {User,Settings} from '@/lib/types';
import {defaultSettings} from '@/lib/defaults';
const Context=createContext<{user:User|null;settings:Settings;toast:(text:string,error?:boolean)=>void}>({user:null,settings:defaultSettings,toast:()=>{}});
export const useApp=()=>useContext(Context);
export function Providers({children,user,settings}:{children:ReactNode;user:User|null;settings:Settings}){const [notice,setNotice]=useState<{text:string;error:boolean}|null>(null);return <Context.Provider value={{user,settings,toast:(text,error=false)=>{setNotice({text,error});setTimeout(()=>setNotice(null),6000);}}}>{children}{notice&&<div className={'toast '+(notice.error?'error':'')} role="status">{notice.error?<AlertCircle size={20}/>:<CheckCircle size={20}/>}<span>{notice.text}</span><button title="Dismiss notification" onClick={()=>setNotice(null)}><X size={17}/></button></div>}</Context.Provider>;}
