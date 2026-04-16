const CONTACT_EMAIL = 'danslang@gmail.com'

function AboutPage() {
  return (
    <div className="py-12 px-6">
      <title>About — Here</title>

      <div className="max-w-3xl mx-auto">

        {/* Heading */}
        <div className="mb-10">
          <h1 className="font-display font-bold text-4xl text-base-content mb-4">
            About Here
          </h1>
        </div>

        {/* About copy */}
        <section className="mb-10">
          <div className="space-y-4 text-lg text-base-content/80 leading-relaxed">
            <p>
              <strong className="font-semibold text-base-content">Here</strong> is a scheduling,
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
        </section>

        <div className="border-t border-base-300" />

        {/* Who's behind Here */}
        <section className="py-10">
          <h2 className="font-display font-semibold text-2xl text-base-content mb-6">
            Who's behind Here
          </h2>
          <div className="space-y-4 text-lg text-base-content/80 leading-relaxed">
            <p>
              Here is built by Daniel Lang, a former high school teacher turned developer. The app
              was designed specifically for City View Community High School in Cedar Rapids, Iowa,
              where traditional Student Information Systems couldn't accommodate the school's
              flexible, individualized schedules. It's a solo project built with care, and if you
              have questions or feedback, you can reach Daniel{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary hover:underline"
              >
                here
              </a>
              .
            </p>
          </div>
        </section>

      </div>
    </div>
  )
}

export default AboutPage
