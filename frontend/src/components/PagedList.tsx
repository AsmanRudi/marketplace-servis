import { useId, useRef, useState, type ReactNode } from 'react'

/** Pagination of an already authorized API result; filtering is done by the caller. */
export function PagedList<T>({ items, children, className, label, resetKey = '', size = 6 }: {
  items:readonly T[]; children:(item:T,index:number) => ReactNode; className?:string;
  label:string; resetKey?:string; size?:number;
}) {
  const [selection,setSelection] = useState({ key:resetKey,page:1 })
  if (selection.key !== resetKey) setSelection({ key:resetKey,page:1 })
  const id = useId()
  const top = useRef<HTMLDivElement>(null)
  const pages = Math.max(1,Math.ceil(items.length/size))
  const page = Math.min(selection.key === resetKey ? selection.page : 1,pages)
  const offset = (page-1)*size
  function change(next:number) {
    setSelection({ key:resetKey,page:Math.max(1,Math.min(pages,next)) })
    top.current?.focus({ preventScroll:true })
    top.current?.scrollIntoView({ block:'start',behavior:'instant' })
  }
  if (!items.length) return null
  const numbers = [...new Set([1,page-1,page,page+1,pages])].filter(n => n>0&&n<=pages).sort((a,b)=>a-b)
  return <div className="paged-list">
    <div ref={top} id={id} tabIndex={-1} role="group" aria-label={label} className={className}>
      {items.slice(offset,offset+size).map((item,index) => children(item,offset+index))}
    </div>
    <nav className="pagination" aria-label={'Halaman '+label}>
      <p role="status">{offset+1}–{Math.min(offset+size,items.length)} dari {items.length}</p>
      {pages>1 && <div className="pagination-controls">
        <button type="button" disabled={page===1} onClick={() => change(page-1)} aria-controls={id} aria-label="Halaman sebelumnya">←</button>
        {numbers.map((n,index) => <span className="pagination-number" key={n}>
          {index>0 && n>numbers[index-1]+1 && <span aria-hidden="true">…</span>}
          <button type="button" aria-label={'Halaman '+n} aria-current={page===n?'page':undefined} aria-controls={id} onClick={() => change(n)}>{n}</button>
        </span>)}
        <button type="button" disabled={page===pages} onClick={() => change(page+1)} aria-controls={id} aria-label="Halaman berikutnya">→</button>
      </div>}
    </nav>
  </div>
}
