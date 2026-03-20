import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  await new Promise(resolve => setTimeout(resolve, 2000))

  const results = [
    { is_invoice: true, company_name: 'Netflix', amount: 17.99, billing_cycle: 'monthly', category: 'streaming' },
    { is_invoice: true, company_name: 'Free Mobile', amount: 29.99, billing_cycle: 'monthly', category: 'telecom' },
    { is_invoice: true, company_name: 'EDF', amount: 89.00, billing_cycle: 'monthly', category: 'energie' },
    { is_invoice: true, company_name: 'Spotify', amount: 10.99, billing_cycle: 'monthly', category: 'streaming' },
    { is_invoice: true, company_name: 'Amazon Prime', amount: 6.99, billing_cycle: 'monthly', category: 'streaming' },
  ]

  const random = results[Math.floor(Math.random() * results.length)]
  return NextResponse.json(random)
}