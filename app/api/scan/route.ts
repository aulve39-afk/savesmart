import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  await new Promise(resolve => setTimeout(resolve, 2000))

  const results = [
    {
      is_invoice: true,
      company_name: 'Free Mobile',
      amount: 29.99,
      billing_cycle: 'monthly',
      category: 'telecom',
      details: { data_go: 100, calls: 'illimites', sms: 'illimites' }
    },
    {
      is_invoice: true,
      company_name: 'Netflix',
      amount: 17.99,
      billing_cycle: 'monthly',
      category: 'streaming',
      details: { screens: 4, quality: '4K', downloads: true }
    },
    {
      is_invoice: true,
      company_name: 'EDF',
      amount: 89.00,
      billing_cycle: 'monthly',
      category: 'energie',
      details: { kwh_monthly: 350, type: 'electricite', contract: 'base' }
    },
    {
      is_invoice: true,
      company_name: 'Spotify',
      amount: 10.99,
      billing_cycle: 'monthly',
      category: 'streaming',
      details: { screens: 1, quality: 'standard', downloads: true }
    },
  ]

  const random = results[Math.floor(Math.random() * results.length)]
  return NextResponse.json(random)
}