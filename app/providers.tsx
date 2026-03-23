import TopProgressBar from './components/TopProgressBar'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopProgressBar />
      {children}
    </>
  )
}
