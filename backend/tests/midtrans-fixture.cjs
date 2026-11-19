const { readFileSync } = require('node:fs')
const originalFetch = globalThis.fetch
const snap = new Map()
globalThis.fetch = async (input, options) => {
  const url = new URL(input)
  if (url.hostname === 'app.sandbox.midtrans.com') {
    const { transaction_details: order } = JSON.parse(options.body)
    snap.set(order.order_id,order.gross_amount)
    return Response.json({ redirect_url:'https://app.sandbox.midtrans.com/snap/v4/redirection/test-fixture' })
  }
  if (url.hostname === 'api.sandbox.midtrans.com') {
    const id = url.pathname.split('/')[2]
    if (!snap.has(id)) return Response.json({ status_code:'404' },{ status:404 })
    const simulated = JSON.parse(readFileSync(process.env.TEST_MIDTRANS_STATE,'utf8'))
    return Response.json({
      order_id:id, status_code:'200', currency:'IDR',
      gross_amount:(snap.get(id) + (simulated.offset ?? 0)).toFixed(2),
      transaction_status:simulated.status, fraud_status:'accept',
    })
  }
  return originalFetch(input,options)
}

