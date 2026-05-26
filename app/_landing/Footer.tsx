export function Footer() {
  return (
    <footer className="bg-landing-bg">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-10 sm:px-8">
        <span className="text-xs text-landing-subtle">
          © 2026 Gayoung Dan · Melbourne, AU
        </span>
        <div className="flex items-center gap-5 text-xs">
          <a
            href="https://github.com/Gyoungd/job-engine-web"
            target="_blank"
            rel="noopener noreferrer"
            className="text-landing-secondary transition-colors hover:text-landing-primary"
          >
            GitHub
          </a>
          <a
            href="mailto:gayoung.dan.data@gmail.com"
            className="text-landing-secondary transition-colors hover:text-landing-primary"
          >
            gayoung.dan.data@gmail.com
          </a>
        </div>
      </div>
    </footer>
  )
}
