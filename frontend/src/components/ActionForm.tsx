import { useState, type FormEvent, type ReactNode } from 'react'

export const field = (form: FormData, name: string) => String(form.get(name) ?? '')
export function ActionForm({ onSend, children, className, label }: {
  onSend: (data: FormData, event: FormEvent<HTMLFormElement>) => Promise<void>
  children?: ReactNode; className?: string; label: string
}) {
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget, event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : undefined)
    setBusy(true)
    setError('')
    try { await onSend(data,event) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Terjadi kesalahan. Coba lagi.') }
    finally { setBusy(false) }
  }
  return <form onSubmit={submit} className={className}>
    <fieldset disabled={busy}>{children}<button className="button" type="submit">{busy ? 'Memproses…' : label}</button></fieldset>
    {error && <p className="error" role="alert">{error}</p>}
  </form>
}
