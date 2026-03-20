'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSubscriptions, removeSubscription, type Subscription } from './store'

const categoryLabel: Record<string, string> = {
  streaming: 'Streaming',
  telecom: 'Télécom',
  energie: 'Énergie',
  assurance: 'Assurance',
  saas: 'SaaS',
  other: 'Autre',
}

const cycleLabel: Record<string, string> = {
  monthly: '/mois',
  yearly: '/an',
  quarterly: '/trimestre',
  one_time: '',
  unknown: '',
}

export default function Home() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const router = useRouter()

  useEffect(() => {
    setSubscriptions(getSubscriptions())
  }, [])

  const handleRemove = (id: string) => {
    removeSubscription(id)
    setSubscriptions(getSubscriptions())
  }

  const total