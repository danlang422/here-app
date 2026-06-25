import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

function LandingPage() {
  const [lightboxSrc, setLightboxSrc] = useState(null)

  useEffect(() => {
    if (!lightboxSrc) return
    const handleKey = (e) => {
      if (e.key === 'Escape') setLightboxSrc(null)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [lightboxSrc])

  return (
    <div>
      <title>Here — Scheduling and attendance for alternative schools</title>

      {/* Hero */}
      <section className="py-20 md:py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-display font-bold text-4xl md:text-5xl text-base-content mb-4 leading-tight">
            Welcome, glad you're <span className="here-wordmark-inline">Here</span>!
          </h1>
          <p className="font-display font-medium text-xl text-base-content/70">
            Scheduling and attendance for schools with unique or unusual schedules.
          </p>
        </div>
      </section>

      <div className="border-t border-base-300" />

      {/* Tour 1: Flexible scheduling — text left, image right */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display font-semibold text-2xl text-base-content mb-4">
                Flexible scheduling for unique schools
              </h2>
              <p className="text-lg text-base-content/80 leading-relaxed">
                Here is built for schools where every student's schedule looks different —
                internships, dual enrollment at community colleges, A/B day rotations, independent
                study. The calendar gives admins a full picture of the week across every activity
                and organization.
              </p>
            </div>
            <div>
              <img
                src="/screenshots/here-admin-calendar-ss.png"
                alt="Admin calendar view showing the week across all activities"
                className="rounded-xl shadow-lg w-full cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightboxSrc('/screenshots/here-admin-calendar-ss.png')}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-base-300" />

      {/* Tour 2: Students — image left, text right */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="relative pb-12">
              <img
                src="/screenshots/here-student-agenda-actions-ss.png"
                alt="Student agenda showing their daily schedule and action buttons"
                className="rounded-xl shadow-lg w-full cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightboxSrc('/screenshots/here-student-agenda-actions-ss.png')}
              />
              <img
                src="/screenshots/here-student-reflection-filled-2-ss.png"
                alt="Student reflection note filled in"
                className="rounded-xl shadow-md w-2/5 absolute bottom-0 right-0 border-2 border-base-100 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightboxSrc('/screenshots/here-student-reflection-filled-2-ss.png')}
              />
            </div>
            <div>
              <h2 className="font-display font-semibold text-2xl text-base-content mb-4">
                Students see their real day
              </h2>
              <p className="text-lg text-base-content/80 leading-relaxed">
                Students get a clean agenda that reflects their actual schedule. They can check in,
                wave to let their advisor know they're on track, or leave a note about what they're
                working on.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-base-300" />

      {/* Tour 3: Teachers — text left, image right */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display font-semibold text-2xl text-base-content mb-4">
                Teachers stay in the loop
              </h2>
              <p className="text-lg text-base-content/80 leading-relaxed">
                Teachers see their day laid out by actual time, not just block labels. The roster
                lets them take attendance with one tap per student — including students arriving
                late or leaving early.
              </p>
            </div>
            <div className="relative pb-12">
              <img
                src="/screenshots/here-teacher-agenda-ss.png"
                alt="Teacher agenda view organized by actual time"
                className="rounded-xl shadow-lg w-full cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightboxSrc('/screenshots/here-teacher-agenda-ss.png')}
              />
              <img
                src="/screenshots/here-teacher-attendance-ss.png"
                alt="Teacher attendance marking view"
                className="rounded-xl shadow-md w-2/5 absolute bottom-0 left-0 border-2 border-base-100 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightboxSrc('/screenshots/here-teacher-attendance-ss.png')}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-base-300" />

      {/* Trust teaser */}
      <section className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display font-semibold text-2xl text-base-content mb-6">
            Built for trust
          </h2>
          <div className="space-y-4 text-lg text-base-content/80 leading-relaxed mb-8">
            <p>
              Here is built with student privacy at its foundation. We don't sell data, don't show
              ads, and don't collect more than we need. Our security practices follow industry
              standards, and our data handling practices comply with FERPA and Iowa's Student Data
              Privacy Act.
            </p>
          </div>
          <Link to="/trust" className="text-primary font-medium hover:underline">
            Read about our privacy practices →
          </Link>
        </div>
      </section>

      {/* Lightbox */}
      {lightboxSrc && (
        <dialog className="modal modal-open" onClick={() => setLightboxSrc(null)}>
          <div className="modal-box max-w-5xl bg-transparent shadow-none p-0">
            <img
              src={lightboxSrc}
              alt="Screenshot enlarged"
              className="w-full rounded-xl shadow-2xl"
            />
          </div>
        </dialog>
      )}
    </div>
  )
}

export default LandingPage
