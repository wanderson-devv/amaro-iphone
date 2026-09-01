import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import argon2 from 'argon2'
import Fastify from 'fastify'
import pg from 'pg'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: { sub: string; email: string; name: string }
  }
}

const app = Fastify({ logger: true })
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
})

await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') ?? true, credentials: true })
await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'change-this-in-production' })

async function requireAuth(request: any, reply: any) {
  try { await request.jwtVerify() } catch { return reply.code(401).send({ error: 'Nao autorizado' }) }
}

app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

// Auth
app.post<{ Body: { name?: string; email: string; password: string } }>('/v1/auth/register', async (request, reply) => {
  const { name, email, password } = request.body
  if (!email || !password || password.length < 6) return reply.code(400).send({ error: 'Email e senha (min 6) obrigatorios.' })
  const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email])
  if (exists.rows.length) return reply.code(409).send({ error: 'Email ja cadastrado.' })
  const hash = await argon2.hash(password)
  const result = await pool.query('INSERT INTO users(name, email, password_hash, role) VALUES($1, $2, $3, $4) RETURNING uuid, name, email', [name || email.split('@')[0], email, hash, 'admin'])
  const user = result.rows[0]
  const token = await reply.jwtSign({ sub: user.uuid, email: user.email, name: user.name })
  return { token, user: { uuid: user.uuid, name: user.name, email: user.email } }
})

app.post<{ Body: { email: string; password: string } }>('/v1/auth/login', async (request, reply) => {
  const { email, password } = request.body
  const result = await pool.query('SELECT uuid, name, email, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL', [email])
  const user = result.rows[0]
  if (!user || !(await argon2.verify(user.password_hash, password))) return reply.code(401).send({ error: 'Credenciais invalidas.' })
  const token = await reply.jwtSign({ sub: user.uuid, email: user.email, name: user.name })
  return { token, user: { uuid: user.uuid, name: user.name, email: user.email } }
})

app.get('/v1/auth/me', { preHandler: requireAuth }, async (request) => {
  return { uuid: request.user.sub, name: request.user.name, email: request.user.email }
})

// Customers
app.get('/v1/customers', { preHandler: requireAuth }, async () => {
  const result = await pool.query('SELECT * FROM customers WHERE deleted_at IS NULL ORDER BY created_at DESC')
  return result.rows.map(mapCustomer)
})

app.post<{ Body: { name: string; document?: string; phone?: string; email?: string; notes?: string } }>('/v1/customers', { preHandler: requireAuth }, async (request) => {
  const { name, document, phone, email, notes } = request.body
  const result = await pool.query('INSERT INTO customers(name, document, phone, email, notes, created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [name, document, phone, email, notes, request.user.sub])
  return mapCustomer(result.rows[0])
})

app.put<{ Params: { uuid: string }; Body: { name?: string; document?: string; phone?: string; email?: string; notes?: string } }>('/v1/customers/:uuid', { preHandler: requireAuth }, async (request) => {
  const { uuid } = request.params; const { name, document, phone, email, notes } = request.body
  const result = await pool.query('UPDATE customers SET name=COALESCE($1,name), document=COALESCE($2,document), phone=COALESCE($3,phone), email=COALESCE($4,email), notes=COALESCE($5,notes), updated_at=NOW() WHERE uuid=$6 AND deleted_at IS NULL RETURNING *', [name, document, phone, email, notes, uuid])
  if (!result.rows.length) throw new Error('Cliente nao encontrado.')
  return mapCustomer(result.rows[0])
})

app.delete<{ Params: { uuid: string } }>('/v1/customers/:uuid', { preHandler: requireAuth }, async (request) => {
  await pool.query("UPDATE customers SET deleted_at=NOW() WHERE uuid=$1", [request.params.uuid])
  return { ok: true }
})

// Products
app.get('/v1/products', { preHandler: requireAuth }, async () => {
  const result = await pool.query('SELECT * FROM products WHERE deleted_at IS NULL ORDER BY created_at DESC')
  return result.rows.map(mapProduct)
})

app.post<{ Body: { code: string; sku?: string; barcode?: string; name: string; category?: string; cost: number; salePrice: number; minStock: number; unit: string } }>('/v1/products', { preHandler: requireAuth }, async (request) => {
  const p = request.body
  const result = await pool.query('INSERT INTO products(code,sku,barcode,name,category,cost,sale_price,min_stock,unit,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *', [p.code, p.sku, p.barcode, p.name, p.category, p.cost, p.salePrice, p.minStock, p.unit, request.user.sub])
  return mapProduct(result.rows[0])
})

app.put<{ Params: { uuid: string }; Body: any }>('/v1/products/:uuid', { preHandler: requireAuth }, async (request) => {
  const { uuid } = request.params; const p = request.body
  const result = await pool.query('UPDATE products SET code=COALESCE($1,code), sku=COALESCE($2,sku), barcode=COALESCE($3,barcode), name=COALESCE($4,name), category=COALESCE($5,category), cost=COALESCE($6,cost), sale_price=COALESCE($7,sale_price), min_stock=COALESCE($8,min_stock), unit=COALESCE($9,unit), updated_at=NOW() WHERE uuid=$10 AND deleted_at IS NULL RETURNING *', [p.code, p.sku, p.barcode, p.name, p.category, p.cost, p.salePrice, p.minStock, p.unit, uuid])
  if (!result.rows.length) throw new Error('Produto nao encontrado.')
  return mapProduct(result.rows[0])
})

app.delete<{ Params: { uuid: string } }>('/v1/products/:uuid', { preHandler: requireAuth }, async (request) => {
  await pool.query("UPDATE products SET deleted_at=NOW() WHERE uuid=$1", [request.params.uuid])
  return { ok: true }
})

app.post<{ Params: { uuid: string }; Body: { quantity: number; reason: string } }>('/v1/products/:uuid/stock', { preHandler: requireAuth }, async (request) => {
  const { uuid } = request.params; const { quantity, reason } = request.body
  const result = await pool.query('UPDATE products SET stock_qty = stock_qty + $1, updated_at=NOW() WHERE uuid=$2 AND deleted_at IS NULL RETURNING *', [quantity, uuid])
  if (!result.rows.length) throw new Error('Produto nao encontrado.')
  await pool.query('INSERT INTO stock_movements(product_uuid, type, quantity, previous_qty, resulting_qty, reason, created_by) VALUES($1,$2,$3,$4,$5,$6,$7)', [uuid, quantity > 0 ? 'entry' : 'adjustment', quantity, result.rows[0].stock_qty - quantity, result.rows[0].stock_qty, reason, request.user.sub])
  return mapProduct(result.rows[0])
})

// Sales
app.get('/v1/sales', { preHandler: requireAuth }, async () => {
  const result = await pool.query('SELECT * FROM sales WHERE deleted_at IS NULL ORDER BY created_at DESC')
  return result.rows.map(mapSale)
})

app.get<{ Params: { uuid: string } }>('/v1/sales/:uuid', { preHandler: requireAuth }, async (request) => {
  const result = await pool.query('SELECT * FROM sales WHERE uuid=$1', [request.params.uuid])
  if (!result.rows.length) throw new Error('Venda nao encontrada.')
  return mapSale(result.rows[0])
})

app.post<{ Body: { items: Array<{ productUuid: string; quantity: number }>; customerUuid?: string; discount: number; surcharge: number; paymentMethod: string } }>('/v1/sales', { preHandler: requireAuth }, async (request) => {
  const { items, customerUuid, discount, surcharge, paymentMethod } = request.body
  if (!items?.length) throw new Error('Adicione pelo menos um item.')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const seq = await client.query('SELECT COALESCE(MAX(number),0)+1 as next FROM sales')
    const saleNumber = seq.rows[0].next
    let subtotal = 0
    const saleItems = []
    for (const item of items) {
      const pRes = await client.query('SELECT * FROM products WHERE uuid=$1 AND deleted_at IS NULL FOR UPDATE', [item.productUuid])
      const product = pRes.rows[0]
      if (!product) throw new Error('Produto nao encontrado.')
      if (product.stock_qty < item.quantity) throw new Error(`Estoque insuficiente: ${product.name}.`)
      const total = product.sale_price * item.quantity
      subtotal += total
      saleItems.push({ productUuid: item.productUuid, name: product.name, quantity: item.quantity, unitPrice: product.sale_price, unitCost: product.cost, total })
      await client.query('UPDATE products SET stock_qty = stock_qty - $1, updated_at=NOW() WHERE uuid=$2', [item.quantity, item.productUuid])
      await client.query('INSERT INTO stock_movements(product_uuid, type, quantity, previous_qty, resulting_qty, reference_type, reference_uuid, created_by) VALUES($1,\'sale\',$2,$3,$4,\'sale\',NULL,$5)', [item.productUuid, -item.quantity, product.stock_qty, product.stock_qty - item.quantity, request.user.sub])
    }
    const total = Math.max(0, subtotal - (discount || 0) + (surcharge || 0))
    const saleResult = await client.query('INSERT INTO sales(number, customer_uuid, items, subtotal, discount, surcharge, total, payment_method, status, created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,\'completed\',$9) RETURNING *', [saleNumber, customerUuid, JSON.stringify(saleItems), subtotal, discount || 0, surcharge || 0, total, paymentMethod, request.user.sub])
    await client.query('INSERT INTO cash_movements(type, amount, payment_method, reference_uuid, description, created_by) VALUES(\'sale\',$1,$2,$3,$4,$5)', [total, paymentMethod, saleResult.rows[0].uuid, `Venda #${saleNumber}`, request.user.sub])
    await client.query('COMMIT')
    return mapSale(saleResult.rows[0])
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
})

// Service Orders
app.get('/v1/service-orders', { preHandler: requireAuth }, async () => {
  const result = await pool.query('SELECT * FROM service_orders WHERE deleted_at IS NULL ORDER BY created_at DESC')
  return result.rows.map(mapServiceOrder)
})

app.get<{ Params: { uuid: string } }>('/v1/service-orders/:uuid', { preHandler: requireAuth }, async (request) => {
  const result = await pool.query('SELECT * FROM service_orders WHERE uuid=$1', [request.params.uuid])
  if (!result.rows.length) throw new Error('OS nao encontrada.')
  return mapServiceOrder(result.rows[0])
})

app.post<{ Body: { customerUuid: string; equipment: string; brand?: string; model?: string; reportedIssue: string; expectedDelivery?: string; technician?: string } }>('/v1/service-orders', { preHandler: requireAuth }, async (request) => {
  const b = request.body
  const seq = await pool.query('SELECT COALESCE(MAX(number),0)+1 as next FROM service_orders')
  const result = await pool.query('INSERT INTO service_orders(number, customer_uuid, equipment, brand, model, reported_issue, expected_delivery, technician, status, warranty_days, created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,\'Entrada\',90,$9) RETURNING *', [seq.rows[0].next, b.customerUuid, b.equipment, b.brand, b.model, b.reportedIssue, b.expectedDelivery, b.technician, request.user.sub])
  return mapServiceOrder(result.rows[0])
})

app.put<{ Params: { uuid: string }; Body: { status: string } }>('/v1/service-orders/:uuid/status', { preHandler: requireAuth }, async (request) => {
  const result = await pool.query('UPDATE service_orders SET status=$1, updated_at=NOW() WHERE uuid=$2 AND deleted_at IS NULL RETURNING *', [request.body.status, request.params.uuid])
  if (!result.rows.length) throw new Error('OS nao encontrada.')
  return mapServiceOrder(result.rows[0])
})

app.post<{ Params: { uuid: string }; Body: { productUuid: string; quantity: number } }>('/v1/service-orders/:uuid/parts', { preHandler: requireAuth }, async (request) => {
  const { uuid } = request.params; const { productUuid, quantity } = request.body
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const oRes = await client.query('SELECT * FROM service_orders WHERE uuid=$1 AND deleted_at IS NULL FOR UPDATE', [uuid])
    const order = oRes.rows[0]; if (!order) throw new Error('OS nao encontrada.')
    const pRes = await client.query('SELECT * FROM products WHERE uuid=$1 AND deleted_at IS NULL FOR UPDATE', [productUuid])
    const product = pRes.rows[0]; if (!product) throw new Error('Produto nao encontrado.')
    if (product.stock_qty < quantity) throw new Error('Estoque insuficiente.')
    const item = { productUuid, name: product.name, quantity, unitPrice: product.sale_price, total: product.sale_price * quantity }
    const currentItems = order.items || []
    const newTotal = currentItems.reduce((s: number, i: any) => s + i.total, 0) + item.total + (order.labor || 0) - (order.discount || 0)
    await client.query('UPDATE service_orders SET items = items || $1::jsonb, total=$2, updated_at=NOW() WHERE uuid=$3', [JSON.stringify([item]), newTotal, uuid])
    await client.query('UPDATE products SET stock_qty = stock_qty - $1, updated_at=NOW() WHERE uuid=$2', [quantity, productUuid])
    await client.query('INSERT INTO stock_movements(product_uuid, type, quantity, previous_qty, resulting_qty, reference_type, reference_uuid, created_by) VALUES($1,\'service_order\',$2,$3,$4,\'service_order\',$5,$6)', [productUuid, -quantity, product.stock_qty, product.stock_qty - quantity, uuid, request.user.sub])
    await client.query('COMMIT')
    const updated = await client.query('SELECT * FROM service_orders WHERE uuid=$1', [uuid])
    return mapServiceOrder(updated.rows[0])
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
})

// Financial
app.get('/v1/financial', { preHandler: requireAuth }, async () => {
  const result = await pool.query('SELECT * FROM financial_entries WHERE deleted_at IS NULL ORDER BY due_date ASC')
  return result.rows.map(mapFinancial)
})

app.post<{ Body: { type: string; description: string; amount: number; dueDate: string; customerUuid?: string; supplierName?: string; notes?: string } }>('/v1/financial', { preHandler: requireAuth }, async (request) => {
  const b = request.body
  const result = await pool.query('INSERT INTO financial_entries(type, description, amount, due_date, customer_uuid, supplier_name, notes, created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [b.type, b.description, b.amount, b.dueDate, b.customerUuid, b.supplierName, b.notes, request.user.sub])
  return mapFinancial(result.rows[0])
})

app.post<{ Params: { uuid: string }; Body: { amount: number; paymentMethod: string } }>('/v1/financial/:uuid/pay', { preHandler: requireAuth }, async (request) => {
  const { amount, paymentMethod } = request.body
  const result = await pool.query('UPDATE financial_entries SET paid_amount = paid_amount + $1, payment_method=$2, status=CASE WHEN paid_amount + $1 >= amount THEN \'paid\' ELSE \'partial\' END, paid_date=CASE WHEN paid_amount + $1 >= amount THEN NOW() ELSE paid_date END, updated_at=NOW() WHERE uuid=$3 AND deleted_at IS NULL RETURNING *', [amount, paymentMethod, request.params.uuid])
  if (!result.rows.length) throw new Error('Conta nao encontrada.')
  return mapFinancial(result.rows[0])
})

app.delete<{ Params: { uuid: string } }>('/v1/financial/:uuid', { preHandler: requireAuth }, async (request) => {
  await pool.query("UPDATE financial_entries SET deleted_at=NOW() WHERE uuid=$1", [request.params.uuid])
  return { ok: true }
})

// Suppliers
app.get('/v1/suppliers', { preHandler: requireAuth }, async () => {
  const result = await pool.query('SELECT * FROM suppliers WHERE deleted_at IS NULL ORDER BY created_at DESC')
  return result.rows.map(mapSupplier)
})

app.post<{ Body: { name: string; document?: string; phone?: string; email?: string; address?: string; notes?: string } }>('/v1/suppliers', { preHandler: requireAuth }, async (request) => {
  const b = request.body
  const result = await pool.query('INSERT INTO suppliers(name, document, phone, email, address, notes, created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [b.name, b.document, b.phone, b.email, b.address, b.notes, request.user.sub])
  return mapSupplier(result.rows[0])
})

app.delete<{ Params: { uuid: string } }>('/v1/suppliers/:uuid', { preHandler: requireAuth }, async (request) => {
  await pool.query("UPDATE suppliers SET deleted_at=NOW() WHERE uuid=$1", [request.params.uuid])
  return { ok: true }
})

// Purchase Orders
app.get('/v1/purchase-orders', { preHandler: requireAuth }, async () => {
  const result = await pool.query('SELECT * FROM purchase_orders WHERE deleted_at IS NULL ORDER BY created_at DESC')
  return result.rows.map(mapPurchaseOrder)
})

app.get<{ Params: { uuid: string } }>('/v1/purchase-orders/:uuid', { preHandler: requireAuth }, async (request) => {
  const result = await pool.query('SELECT * FROM purchase_orders WHERE uuid=$1', [request.params.uuid])
  if (!result.rows.length) throw new Error('Pedido nao encontrado.')
  return mapPurchaseOrder(result.rows[0])
})

app.post<{ Body: { supplierUuid: string; supplierName: string; items: Array<{ productUuid: string; name: string; quantity: number; unitCost: number }>; expectedDelivery?: string; notes?: string } }>('/v1/purchase-orders', { preHandler: requireAuth }, async (request) => {
  const b = request.body
  const items = b.items.map((i) => ({ ...i, total: i.quantity * i.unitCost, receivedQty: 0 }))
  const total = items.reduce((s, i) => s + i.total, 0)
  const seq = await pool.query('SELECT COALESCE(MAX(number),0)+1 as next FROM purchase_orders')
  const result = await pool.query('INSERT INTO purchase_orders(number, supplier_uuid, supplier_name, status, items, total, expected_delivery, notes, created_by) VALUES($1,$2,$3,\'draft\',$4,$5,$6,$7,$8) RETURNING *', [seq.rows[0].next, b.supplierUuid, b.supplierName, JSON.stringify(items), total, b.expectedDelivery, b.notes, request.user.sub])
  return mapPurchaseOrder(result.rows[0])
})

app.put<{ Params: { uuid: string }; Body: { status: string } }>('/v1/purchase-orders/:uuid/status', { preHandler: requireAuth }, async (request) => {
  const result = await pool.query('UPDATE purchase_orders SET status=$1, updated_at=NOW() WHERE uuid=$2 AND deleted_at IS NULL RETURNING *', [request.body.status, request.params.uuid])
  if (!result.rows.length) throw new Error('Pedido nao encontrado.')
  return mapPurchaseOrder(result.rows[0])
})

app.post<{ Params: { uuid: string }; Body: { productUuid: string; quantity: number } }>('/v1/purchase-orders/:uuid/receive', { preHandler: requireAuth }, async (request) => {
  const { uuid } = request.params; const { productUuid, quantity } = request.body
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const oRes = await client.query('SELECT * FROM purchase_orders WHERE uuid=$1 AND deleted_at IS NULL FOR UPDATE', [uuid])
    const order = oRes.rows[0]; if (!order) throw new Error('Pedido nao encontrado.')
    const items = order.items
    const idx = items.findIndex((i: any) => i.productUuid === productUuid)
    if (idx === -1) throw new Error('Item nao encontrado.')
    items[idx].receivedQty = (items[idx].receivedQty || 0) + quantity
    if (items[idx].receivedQty > items[idx].quantity) throw new Error('Quantidade excede o pedido.')
    const allReceived = items.every((i: any) => i.receivedQty >= i.quantity)
    const newStatus = allReceived ? 'received' : items.some((i: any) => i.receivedQty > 0) ? 'partial' : order.status
    await client.query('UPDATE purchase_orders SET items=$1, status=$2, updated_at=NOW() WHERE uuid=$3', [JSON.stringify(items), newStatus, uuid])
    const pRes = await client.query('UPDATE products SET stock_qty = stock_qty + $1, updated_at=NOW() WHERE uuid=$2 RETURNING *', [quantity, productUuid])
    if (pRes.rows.length) {
      await client.query('INSERT INTO stock_movements(product_uuid, type, quantity, previous_qty, resulting_qty, reference_type, reference_uuid, created_by) VALUES($1,\'entry\',$2,$3,$4,\'purchase_order\',$5,$6)', [productUuid, quantity, pRes.rows[0].stock_qty - quantity, pRes.rows[0].stock_qty, uuid, request.user.sub])
    }
    await client.query('COMMIT')
    const updated = await client.query('SELECT * FROM purchase_orders WHERE uuid=$1', [uuid])
    return mapPurchaseOrder(updated.rows[0])
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
})

// Audit
app.get('/v1/audit', { preHandler: requireAuth }, async () => {
  const result = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200')
  return result.rows.map((r) => ({ uuid: r.uuid, entityType: r.entity_type, entityUuid: r.entity_uuid, action: r.action, previousValue: r.previous_value, newValue: r.new_value, createdAt: r.created_at }))
})

// Mapping helpers
function mapCustomer(r: any) { return { uuid: r.uuid, name: r.name, document: r.document, phone: r.phone, email: r.email, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at, createdBy: r.created_by, updatedBy: r.updated_by, syncStatus: 'synced' } }
function mapProduct(r: any) { return { uuid: r.uuid, code: r.code, sku: r.sku, barcode: r.barcode, name: r.name, category: r.category, cost: Number(r.cost), salePrice: Number(r.sale_price), stockQty: Number(r.stock_qty), minStock: Number(r.min_stock), unit: r.unit, createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at, createdBy: r.created_by, updatedBy: r.updated_by, syncStatus: 'synced' } }
function mapSale(r: any) { return { uuid: r.uuid, number: r.number, customerUuid: r.customer_uuid, items: r.items, subtotal: Number(r.subtotal), discount: Number(r.discount), surcharge: Number(r.surcharge), total: Number(r.total), paymentMethod: r.payment_method, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at, createdBy: r.created_by, updatedBy: r.updated_by, syncStatus: 'synced' } }
function mapServiceOrder(r: any) { return { uuid: r.uuid, number: r.number, customerUuid: r.customer_uuid, equipment: r.equipment, brand: r.brand, model: r.model, reportedIssue: r.reported_issue, diagnosis: r.diagnosis, status: r.status, technician: r.technician, expectedDelivery: r.expected_delivery, labor: Number(r.labor || 0), discount: Number(r.discount || 0), total: Number(r.total || 0), items: r.items || [], warrantyDays: r.warranty_days, createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at, createdBy: r.created_by, updatedBy: r.updated_by, syncStatus: 'synced' } }
function mapFinancial(r: any) { return { uuid: r.uuid, type: r.type, status: r.status, description: r.description, amount: Number(r.amount), paidAmount: Number(r.paid_amount), dueDate: r.due_date, paidDate: r.paid_date, paymentMethod: r.payment_method, customerUuid: r.customer_uuid, supplierName: r.supplier_name, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at, createdBy: r.created_by, updatedBy: r.updated_by, syncStatus: 'synced' } }
function mapSupplier(r: any) { return { uuid: r.uuid, name: r.name, document: r.document, phone: r.phone, email: r.email, address: r.address, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at, createdBy: r.created_by, updatedBy: r.updated_by, syncStatus: 'synced' } }
function mapPurchaseOrder(r: any) { return { uuid: r.uuid, number: r.number, supplierUuid: r.supplier_uuid, supplierName: r.supplier_name, status: r.status, items: r.items, total: Number(r.total), expectedDelivery: r.expected_delivery, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at, createdBy: r.created_by, updatedBy: r.updated_by, syncStatus: 'synced' } }

await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
