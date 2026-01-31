import { Suspense } from 'react'
import AgendaClient from './AgendaClient'
import { getStudentSchedule } from './actions'

export default async function StudentAgendaPage() {
  // Get today's date in local timezone (not UTC)
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const today = `${year}-${month}-${day}`
  
  const initialSections = await getStudentSchedule(today)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f9fafb',
        padding: '40px 20px',
      }}
    >
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto 30px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#1f2937',
            margin: '0 0 8px 0',
          }}
        >
          you're <span className="here">here</span>
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: '#6b7280',
            margin: '0',
          }}
        >
          Track your schedule and stay connected
        </p>
      </div>

      <Suspense fallback={<LoadingState />}>
        <AgendaClient initialSections={initialSections} initialDate={today} />
      </Suspense>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
      Loading your agenda...
    </div>
  )
}
