import type { DetailKind } from "@/shared/content-types";

export function DetailPage({ kind, data, loading, error, onBack, onOpenStudent }: { kind:DetailKind; data:Record<string,unknown>|null; loading:boolean; error:boolean; onBack:()=>void; onOpenStudent?:(classId:string,id:string)=>void }) {
  return <section className="data-page detail-page"><button className="back-to-more" onClick={onBack}>‹ Back</button>{loading?<div className="screen-state">Loading real TeacherLyft detail…</div>:error||!data?<div className="screen-state error-panel">This detail is unavailable.</div>:<DetailBody kind={kind} data={data} onOpenStudent={onOpenStudent}/>}</section>;
}

function DetailBody({kind,data,onOpenStudent}:{kind:DetailKind;data:Record<string,unknown>;onOpenStudent?: (classId:string,id:string)=>void}) {
  const primary=record(data[kind])||record(data[kind==="library"?"concept":kind==="curriculum"?"textbook":kind]);
  const title=text(primary?.name)||text(primary?.title)||text(record(data.student)?.name)||`${label(kind)} detail`;
  return <><header className="page-header"><p className="section-kicker">{label(kind)}</p><h1>{title}</h1>{text(primary?.className)&&<p>{text(primary?.className)}</p>}</header><ObjectSection title="Overview" value={primary}/>{sectionEntries(data).map(([key,value])=>key!==kind&&key!=="concept"&&key!=="textbook"?<ValueSection key={key} name={key} value={value} classId={text(record(data.class)?.id)} onOpenStudent={onOpenStudent}/>:null)}{["assignment","draft"].includes(kind)&&<div className="web-only-panel"><strong>Editing action — web-only</strong><span>{kind==="draft"?"Answer-key authoring and assignment setup":"Grading edits and advanced assignment configuration"} remain in the full workstation.</span></div>}{kind==="curriculum"&&<div className="web-only-panel"><strong>Editing actions — web-only</strong><span>File upload, organization changes, and deletion remain in the full workstation.</span></div>}{kind==="library"&&<div className="web-only-panel"><strong>Editing actions — web-only</strong><span>Resource upload, summary generation, and deletion remain in the full workstation.</span></div>}</>;
}

function ValueSection({name,value,classId,onOpenStudent}:{name:string;value:unknown;classId:string|null;onOpenStudent?: (classId:string,id:string)=>void}) {
  if(value===null||value===undefined)return null;
  if(Array.isArray(value))return <section className="detail-section"><h2>{label(name)}</h2>{value.length?<div className="detail-list">{value.map((item,index)=>{const row=record(item);const studentId=text(row?.id)||text(row?.studentId);return <button className="detail-row" key={studentId||index} disabled={!classId||!studentId||name!=="students"} onClick={()=>classId&&studentId&&onOpenStudent?.(classId,studentId)}><ObjectFields value={row}/></button>})}</div>:<p className="inline-empty">No {label(name).toLowerCase()} yet.</p>}</section>;
  return <ObjectSection title={label(name)} value={record(value)}/>;
}
function ObjectSection({title,value}:{title:string;value:Record<string,unknown>|null}) { if(!value)return null;return <section className="detail-section"><h2>{title}</h2><dl className="detail-grid"><ObjectFields value={value}/></dl>{Object.entries(value).filter(([,item])=>Array.isArray(item)).map(([key,item])=><ValueSection key={key} name={key} value={item} classId={null}/>)}</section> }
function ObjectFields({value}:{value:Record<string,unknown>|null}) { if(!value)return null;return <>{Object.entries(value).filter(([,v])=>primitive(v)).map(([key,v])=><div className="detail-field" key={key}><dt>{label(key)}</dt><dd>{display(v)}</dd></div>)}</> }
function sectionEntries(data:Record<string,unknown>){return Object.entries(data).filter(([,v])=>v!==null&&v!==undefined)}
function primitive(value:unknown){return ["string","number","boolean"].includes(typeof value)||value===null}
function display(value:unknown){if(value===null||value==="")return "—";if(typeof value==="boolean")return value?"Yes":"No";return String(value)}
function record(value:unknown):Record<string,unknown>|null{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null}
function text(value:unknown){return typeof value==="string"&&value?value:null}
function label(value:string){return value.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/_/g," ").replace(/^./,c=>c.toUpperCase())}
