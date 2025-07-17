'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function InvitePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const [message, setMessage] = useState('Verifying invitation...')
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!token) {
      setMessage('Invalid invitation link.')
      return
    }

    const verifyInvite = async () => {
      try {
        const res = await fetch('/api/activate-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const data = await res.json()

        if (res.ok) {
          setMessage('Invitation accepted! Redirecting to login in ')
          setCount(10)

          const countdown = setInterval(() => {
            setCount((prev) => {
              if (prev === null || prev <= 1) {
                clearInterval(countdown)
                return 0
              }
              return prev - 1
            })
          }, 1000)

          setTimeout(() => router.push('/login'), 5000)
        } else {
          setMessage(data.error || 'Activation failed.')
        }
      } catch (err) {
        setMessage('Something went wrong. Please try again later.')
      }
    }

    verifyInvite()
  }, [token, router])

  return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-bold">
        {message}
        {count !== null ? `${count}...` : ''}
      </h2>
    </div>
  )
}
