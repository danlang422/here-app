import { Link } from 'react-router-dom'

const PDF_PATH = '/documents/here-privacy-data-sheet.pdf'
const CONTACT_EMAIL = 'danslang@gmail.com'

function PublicLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-base-100">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}

function Header() {
  return (
    <header className="bg-base-100 border-b border-base-300 py-3 px-4 md:py-4 md:px-6">
      <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
        <Link to="/" className="here-wordmark">Here</Link>
        <nav className="flex items-center gap-3 flex-wrap">
          <Link to="/about" className="text-sm font-medium text-base-content/70 hover:text-base-content transition-colors">
            About
          </Link>
          <Link to="/trust" className="text-sm font-medium text-base-content/70 hover:text-base-content transition-colors">
            Trust
          </Link>
          <Link to="/login" className="btn btn-primary btn-sm">
            Log in
          </Link>
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="bg-base-200 py-8 px-6">
      <div className="max-w-5xl mx-auto">
        <p className="font-display font-semibold text-base-content/80 mb-2">Here</p>
        <p className="text-sm text-base-content/60 mb-4">Scheduling and attendance for alternative schools</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-base-content/60 mb-6">
          <Link to="/trust" className="hover:text-base-content transition-colors">
            Trust &amp; privacy
          </Link>
          <span aria-hidden="true">·</span>
          <a
            href={PDF_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-base-content transition-colors"
          >
            Privacy data sheet (PDF)
          </a>
          <span aria-hidden="true">·</span>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="hover:text-base-content transition-colors"
          >
            Contact
          </a>
        </nav>
        <p className="text-xs text-base-content/40">&copy; 2026 Daniel Lang</p>
      </div>
    </footer>
  )
}

export default PublicLayout
