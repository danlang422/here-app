import { Link } from 'react-router-dom'

function LandingPage() {
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

      {/* About */}
      <section className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display font-semibold text-2xl text-base-content mb-6">
            About Here
          </h2>
          <div className="space-y-4 text-lg text-base-content/80 leading-relaxed">
            <p>
              <span className="here-wordmark-inline">Here</span> is a scheduling,
              attendance tracking, and engagement app designed for schools with unique or unusual
              schedules.
            </p>
            <p>
              Traditional Student Information Systems like Infinite Campus or PowerSchool were
              designed with traditional school schedules in mind, meaning all students and staff
              adhere to a fixed set of blocks or periods. This makes taking attendance easy from an
              administrative perspective: a student is either present or absent for each of the
              fixed periods. But it doesn't work well for students who engage in more unique
              activities — things like internships or external courses.
            </p>
            <p>
              Here attempts to bridge that gap, accommodating highly unique, flexible schedules for
              individual students while "rolling up" attendance data in a way that maps cleanly to
              blocks or periods.
            </p>
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
    </div>
  )
}

export default LandingPage
