import { Hero } from './_landing/Hero'
import { PipelineDiagram } from './_landing/PipelineDiagram'
import { BentoGrid } from './_landing/BentoGrid'
import { StackStrip } from './_landing/StackStrip'
import { Footer } from './_landing/Footer'

export default function Landing() {
  return (
    <main className="min-h-screen bg-landing-bg font-sans text-landing-fg antialiased">
      <Hero />
      <PipelineDiagram />
      <BentoGrid />
      <StackStrip />
      <Footer />
    </main>
  )
}
