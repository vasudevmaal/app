export default function Loading(){return <main className="main-width loading-grid" aria-label="Loading styles">{Array.from({length:8},(_,i)=><div className="skeleton" key={i}/>)}</main>;}
