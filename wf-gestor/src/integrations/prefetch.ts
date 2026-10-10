import { ALL_ORDERS_SINCE, fetchAmazonSales, type AmazonSalesState } from './amazonSales'
import { FINANCE_SINCE, fetchAmazonFinance, fetchAmazonListings } from './amazonFinance'
import { cacheSet } from './cache'

export async function prefetchCoreData() {
  void fetchAmazonSales(ALL_ORDERS_SINCE)
    .then(({ sales, detail }) => {
      const next: AmazonSalesState = { status: 'live', message: detail, sales, updatedAt: Date.now() }
      cacheSet(`sales:${ALL_ORDERS_SINCE}`, next)
    })
    .catch(() => {})

  void fetchAmazonFinance(FINANCE_SINCE)
    .then(({ finance }) => cacheSet(`finance:${FINANCE_SINCE}`, finance))
    .catch(() => {})

  void fetchAmazonListings()
    .then((next) => {
      if (next.status === 'live') cacheSet('listings', next)
    })
    .catch(() => {})
}
