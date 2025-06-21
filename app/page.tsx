import AudioVisualizer from "@/components/audio-visualizer"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 bg-black font-quicksand">
      <div className="w-full max-w-5xl">
        <h1 className="text-4xl font-pacifico text-center mb-8 text-white">Ambient Vibes by Kaushik S</h1>
        <AudioVisualizer />
      </div>
    </main>
  )
}
