const PDF_PATH = '/documents/here-privacy-data-sheet.pdf'

function TrustPage() {
  return (
    <div className="py-12 px-6">
      <title>Trust &amp; Privacy — Here</title>

      <div className="max-w-3xl mx-auto">

        {/* Hero */}
        <div className="mb-10">
          <h1 className="font-display font-bold text-4xl text-base-content mb-4">
            Trust &amp; Privacy
          </h1>
          <p className="text-lg text-base-content/70 leading-relaxed">
            Here is built with student privacy at its foundation.
          </p>
        </div>

        <div className="border-t border-base-300" />

        {/* Built for schools */}
        <section className="py-8">
          <h2 className="font-display font-semibold text-xl text-base-content mb-3">
            Built for schools, not advertisers
          </h2>
          <p className="text-base text-base-content/80 leading-relaxed">
            Here doesn't display advertising and doesn't sell, rent, or share student data with
            marketers or advertisers. Student data is used exclusively for scheduling, attendance,
            and the engagement features described in the app. We have no commercial interest in
            student data beyond providing the service schools pay for.
          </p>
        </section>

        <div className="border-t border-base-300" />

        {/* Minimal data collection */}
        <section className="py-8">
          <h2 className="font-display font-semibold text-xl text-base-content mb-3">
            Minimal data collection
          </h2>
          <p className="text-base text-base-content/80 leading-relaxed">
            We collect only what's needed to make the app work: names, email addresses, schedule
            information, attendance records, and — for students enrolled in off-campus internships
            — location coordinates at the moment of check-in. We don't collect Social Security
            numbers, medical records, disciplinary records, browsing history, or behavioral
            profiles.
          </p>
        </section>

        <div className="border-t border-base-300" />

        {/* Your data stays yours */}
        <section className="py-8">
          <h2 className="font-display font-semibold text-xl text-base-content mb-3">
            Your data stays yours
          </h2>
          <p className="text-base text-base-content/80 leading-relaxed">
            The school retains full ownership of all student records stored in Here. Schools can
            export all their data at any time, and we'll delete it at their request. Individual
            students can view and edit their own content (status updates, comments) at any time
            through the app.
          </p>
        </section>

        <div className="border-t border-base-300" />

        {/* Security */}
        <section className="py-8">
          <h2 className="font-display font-semibold text-xl text-base-content mb-3">
            Security
          </h2>
          <p className="text-base text-base-content/80 leading-relaxed">
            All data is encrypted in transit (HTTPS/TLS) and at rest (AES-256, handled by our
            infrastructure provider Supabase). Database access is governed by Row Level Security
            policies that enforce permissions at the query level — so students can only see their
            own records, teachers can only see records for their assigned activities, and so on.
            These are structural protections, not just UI-level restrictions.
          </p>
        </section>

        <div className="border-t border-base-300" />

        {/* Compliance */}
        <section className="py-8">
          <h2 className="font-display font-semibold text-xl text-base-content mb-4">
            Compliance
          </h2>
          <ul className="space-y-4">
            <li>
              <p className="text-base text-base-content/80 leading-relaxed">
                <strong className="font-semibold text-base-content">FERPA</strong> — Family
                Educational Rights and Privacy Act. Here operates as a "school official" under
                FERPA's school official exception, with a Data Processing Agreement in place with
                partnering schools.
              </p>
            </li>
            <li>
              <p className="text-base text-base-content/80 leading-relaxed">
                <strong className="font-semibold text-base-content">Iowa Student Data Privacy
                Act</strong> — Iowa Code § 279.71. Here complies with Iowa's specific requirements
                for operators of online services designed for K–12 school purposes.
              </p>
            </li>
            <li>
              <p className="text-base text-base-content/80 leading-relaxed">
                <strong className="font-semibold text-base-content">COPPA</strong> — Children's
                Online Privacy Protection Rule. Here is designed for high school use; if used with
                students under 13, the school acts as the consenting party consistent with FTC
                guidance.
              </p>
            </li>
          </ul>
        </section>

        <div className="border-t border-base-300" />

        {/* Full documentation */}
        <section className="py-8">
          <h2 className="font-display font-semibold text-xl text-base-content mb-3">
            Full documentation
          </h2>
          <p className="text-base text-base-content/80 leading-relaxed mb-6">
            For a detailed accounting of Here's data practices — including a complete list of data
            collected, third-party service providers, security protocols, breach notification
            procedures, and retention policies — see our Privacy Data Sheet.
          </p>
          <a
            href={PDF_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Download Privacy Data Sheet (PDF)
          </a>
        </section>

      </div>
    </div>
  )
}

export default TrustPage
