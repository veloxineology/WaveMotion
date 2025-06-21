"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Mic,
  MicOff,
  Settings,
  AudioWaveformIcon as Waveform,
  BarChart3,
  Circle,
  Waves,
  Maximize2,
  Minimize2,
  Sparkles,
  Moon,
  Zap,
  Music,
  Flame,
  Snowflake,
  ChevronUp,
  ChevronDown,
  Flower2,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type VisualizerType =
  | "waveform"
  | "bars"
  | "circular"
  | "centerWave"
  | "pulseWave"
  | "mirrorWave"
  | "fluidMotion"
  | "vortex"
type ColorScheme = "monochrome" | "gradient-purple" | "gradient-blue" | "gradient-green" | "gradient-red" | "rainbow"

interface Preset {
  id: string
  name: string
  icon: React.ReactNode
  visualizerType: VisualizerType
  colorScheme: ColorScheme
  sensitivity: number
  trailEffect: number
  description: string
}

export default function AudioVisualizer() {
  const [isListening, setIsListening] = useState(false)
  const [sensitivity, setSensitivity] = useState(1.5)
  const [visualizerType, setVisualizerType] = useState<VisualizerType>("centerWave")
  const [colorScheme, setColorScheme] = useState<ColorScheme>("monochrome")
  const [landscapeMode, setLandscapeMode] = useState(false)
  const [trailEffect, setTrailEffect] = useState(0.3)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [lastTapTime, setLastTapTime] = useState(0)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [showFullscreenControls, setShowFullscreenControls] = useState(false)
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null)
  const [particleCount, setParticleCount] = useState(100)
  const [timeScale, setTimeScale] = useState(1.0)
  const [isLoading, setIsLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number>(0)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const previousDataRef = useRef<Uint8Array | null>(null)
  const timeRef = useRef<number>(0)
  const particlesRef = useRef<
    Array<{
      x: number
      y: number
      size: number
      color: string
      vx: number
      vy: number
      life: number
      maxLife: number
    }>
  >([])

  const currentVisualizerTypeRef = useRef<VisualizerType>(visualizerType)

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)

    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [])

  // Define presets
  const presets: Preset[] = [
    {
      id: "center-mono",
      name: "Center Mono",
      icon: <Music size={16} />,
      visualizerType: "centerWave",
      colorScheme: "monochrome",
      sensitivity: 1.5,
      trailEffect: 0.3,
      description: "Classic center waveform with monochrome style",
    },
    {
      id: "neon-pulse",
      name: "Neon Pulse",
      icon: <Zap size={16} />,
      visualizerType: "pulseWave",
      colorScheme: "gradient-purple",
      sensitivity: 1.8,
      trailEffect: 0.6,
      description: "Vibrant purple pulse with high trail effect",
    },
    {
      id: "mirror-chill",
      name: "Mirror Chill",
      icon: <Moon size={16} />,
      visualizerType: "mirrorWave",
      colorScheme: "gradient-blue",
      sensitivity: 1.3,
      trailEffect: 0.5,
      description: "Relaxing blue mirror wave visualization",
    },
    {
      id: "frequency-fire",
      name: "Frequency Fire",
      icon: <Flame size={16} />,
      visualizerType: "bars",
      colorScheme: "gradient-red",
      sensitivity: 2.0,
      trailEffect: 0.2,
      description: "High-energy red frequency bars",
    },
    {
      id: "cosmic-circle",
      name: "Cosmic Circle",
      icon: <Sparkles size={16} />,
      visualizerType: "circular",
      colorScheme: "gradient-purple",
      sensitivity: 1.7,
      trailEffect: 0.1,
      description: "Cosmic circular visualization with purple gradient",
    },
    {
      id: "zen-wave",
      name: "Zen Wave",
      icon: <Snowflake size={16} />,
      visualizerType: "waveform",
      colorScheme: "gradient-green",
      sensitivity: 1.2,
      trailEffect: 0.0,
      description: "Calm green waveform for relaxation",
    },
    {
      id: "fluid-rainbow",
      name: "Fluid Rainbow",
      icon: <Flower2 size={16} />,
      visualizerType: "fluidMotion",
      colorScheme: "rainbow",
      sensitivity: 2.0,
      trailEffect: 0.8,
      description: "Fluid psychedelic visualization with rainbow colors",
    },
    {
      id: "cosmic-vortex",
      name: "Cosmic Vortex",
      icon: <Circle size={16} />,
      visualizerType: "vortex",
      colorScheme: "gradient-purple",
      sensitivity: 1.8,
      trailEffect: 0.7,
      description: "Spiral vortex with particle effects",
    },
  ]

  // Initialize audio context and analyzer
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
      if (!!document.fullscreenElement) {
        // Show controls briefly when entering fullscreen
        handleMouseMove()
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  // Check if current settings match a preset
  useEffect(() => {
    const matchingPreset = presets.find(
      (preset) =>
        preset.visualizerType === visualizerType &&
        preset.colorScheme === colorScheme &&
        Math.abs(preset.sensitivity - sensitivity) < 0.1 &&
        Math.abs(preset.trailEffect - trailEffect) < 0.1,
    )

    setActivePreset(matchingPreset?.id || null)
  }, [visualizerType, colorScheme, sensitivity, trailEffect])

  // Initialize particles for milkdrop visualization
  useEffect(() => {
    if (visualizerType === "fluidMotion" || visualizerType === "vortex") {
      initializeParticles()
    }
  }, [visualizerType, particleCount])

  useEffect(() => {
    currentVisualizerTypeRef.current = visualizerType
  }, [visualizerType])

  const initializeParticles = () => {
    const particles = []
    const colors = ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#4b0082", "#9400d3"]

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 5 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 0.002,
        vy: (Math.random() - 0.5) * 0.002,
        life: Math.random() * 100 + 50,
        maxLife: 150,
      })
    }

    particlesRef.current = particles
  }

  const startListening = async () => {
    try {
      // If we already have a stream, reuse it
      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
      }

      // Initialize audio context if not already done
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }

      // Create analyzer node
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 2048

      // Create source from microphone stream
      sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current)
      sourceRef.current.connect(analyserRef.current)

      // Create data array for analyzer
      const bufferLength = analyserRef.current.frequencyBinCount
      dataArrayRef.current = new Uint8Array(bufferLength)
      previousDataRef.current = new Uint8Array(bufferLength)

      setIsListening(true)
      draw()
    } catch (error) {
      console.error("Error accessing microphone:", error)
      alert("Could not access microphone. Please check permissions.")
    }
  }

  const stopListening = () => {
    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    // Note: We're not stopping the stream tracks here anymore
    // to allow for quick resumption

    setIsListening(false)
  }

  const toggleListening = (e?: React.MouseEvent | React.TouchEvent) => {
    // Stop propagation to prevent double-tap from triggering
    if (e) {
      e.stopPropagation()
    }

    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  const getGradient = (ctx: CanvasRenderingContext2D, height: number) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height)

    if (colorScheme === "monochrome") {
      gradient.addColorStop(0, "#ffffff")
      gradient.addColorStop(1, "#ffffff")
      return gradient
    }

    if (colorScheme === "rainbow") {
      gradient.addColorStop(0, "#ff0000") // Red
      gradient.addColorStop(0.17, "#ff7f00") // Orange
      gradient.addColorStop(0.33, "#ffff00") // Yellow
      gradient.addColorStop(0.5, "#00ff00") // Green
      gradient.addColorStop(0.67, "#0000ff") // Blue
      gradient.addColorStop(0.83, "#4b0082") // Indigo
      gradient.addColorStop(1, "#9400d3") // Violet
      return gradient
    }

    if (colorScheme === "gradient-purple") {
      gradient.addColorStop(0, "#9333ea")
      gradient.addColorStop(0.5, "#7e22ce")
      gradient.addColorStop(1, "#4c1d95")
    } else if (colorScheme === "gradient-blue") {
      gradient.addColorStop(0, "#2563eb")
      gradient.addColorStop(0.5, "#1d4ed8")
      gradient.addColorStop(1, "#1e40af")
    } else if (colorScheme === "gradient-green") {
      gradient.addColorStop(0, "#10b981")
      gradient.addColorStop(0.5, "#059669")
      gradient.addColorStop(1, "#047857")
    } else if (colorScheme === "gradient-red") {
      gradient.addColorStop(0, "#ef4444")
      gradient.addColorStop(0.5, "#dc2626")
      gradient.addColorStop(1, "#b91c1c")
    }

    return gradient
  }

  const getRainbowColor = (position: number) => {
    // Position should be between 0 and 1
    const hue = position * 360
    return `hsl(${hue}, 100%, 50%)`
  }

  const drawWaveform = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!analyserRef.current || !dataArrayRef.current) return

    analyserRef.current.getByteTimeDomainData(dataArrayRef.current)

    ctx.lineWidth = 2
    ctx.strokeStyle = getGradient(ctx, height)
    ctx.beginPath()

    const sliceWidth = width / dataArrayRef.current.length
    let x = 0

    for (let i = 0; i < dataArrayRef.current.length; i++) {
      const v = (dataArrayRef.current[i] / 128.0) * sensitivity
      const y = (v * height) / 2

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      x += sliceWidth
    }

    ctx.lineTo(width, height / 2)
    ctx.stroke()
  }

  const drawBars = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!analyserRef.current || !dataArrayRef.current) return

    analyserRef.current.getByteFrequencyData(dataArrayRef.current)

    const barWidth = width / (dataArrayRef.current.length / 4)
    let x = 0

    ctx.fillStyle = getGradient(ctx, height)

    for (let i = 0; i < dataArrayRef.current.length; i += 4) {
      const barHeight = dataArrayRef.current[i] * sensitivity
      ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight)
      x += barWidth
    }
  }

  const drawCircular = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!analyserRef.current || !dataArrayRef.current) return

    analyserRef.current.getByteFrequencyData(dataArrayRef.current)

    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 4

    ctx.strokeStyle = getGradient(ctx, height)
    ctx.lineWidth = 2

    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
    ctx.stroke()

    const barCount = 180
    const angleStep = (2 * Math.PI) / barCount

    for (let i = 0; i < barCount; i++) {
      const sampleIndex = Math.floor((i * dataArrayRef.current.length) / barCount)
      const value = dataArrayRef.current[sampleIndex] * sensitivity

      const barHeight = (value / 256) * radius

      const angle = i * angleStep

      const x1 = centerX + Math.cos(angle) * radius
      const y1 = centerY + Math.sin(angle) * radius
      const x2 = centerX + Math.cos(angle) * (radius + barHeight)
      const y2 = centerY + Math.sin(angle) * (radius + barHeight)

      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
  }

  // Center wave visualization
  const drawCenterWave = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!analyserRef.current || !dataArrayRef.current) return

    analyserRef.current.getByteTimeDomainData(dataArrayRef.current)

    // Apply trail effect by not fully clearing the canvas
    ctx.fillStyle = "rgba(0, 0, 0, " + (1 - trailEffect) + ")"
    ctx.fillRect(0, 0, width, height)

    const centerY = height / 2

    // Draw the center line
    ctx.beginPath()
    ctx.strokeStyle = colorScheme === "monochrome" ? "#ffffff" : getGradient(ctx, height)
    ctx.lineWidth = 1
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()

    // Draw the waveform
    ctx.beginPath()
    ctx.strokeStyle = colorScheme === "monochrome" ? "#ffffff" : getGradient(ctx, height)
    ctx.lineWidth = 2

    // Only use the middle portion of the data for a more focused waveform
    const startPoint = Math.floor(dataArrayRef.current.length * 0.4)
    const endPoint = Math.floor(dataArrayRef.current.length * 0.6)
    const usableDataLength = endPoint - startPoint

    // Scale to fit the width
    const sliceWidth = width / usableDataLength

    let x = 0
    for (let i = startPoint; i < endPoint; i++) {
      const v = (dataArrayRef.current[i] / 128.0) * sensitivity
      const y = centerY + ((v - 1) * height) / 4

      if (i === startPoint) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      x += sliceWidth
    }

    ctx.stroke()
  }

  // Pulse wave visualization (inspired by the horizontal line with pulse)
  const drawPulseWave = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!analyserRef.current || !dataArrayRef.current || !previousDataRef.current) return

    analyserRef.current.getByteFrequencyData(dataArrayRef.current)

    // Apply trail effect
    ctx.fillStyle = "rgba(0, 0, 0, " + (1 - trailEffect) + ")"
    ctx.fillRect(0, 0, width, height)

    const centerY = height / 2

    // Calculate the average frequency value for pulse intensity
    let sum = 0
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i]
    }
    const avgFrequency = sum / dataArrayRef.current.length

    // Smooth transition between frames
    if (previousDataRef.current) {
      for (let i = 0; i < dataArrayRef.current.length; i++) {
        previousDataRef.current[i] = previousDataRef.current[i] * 0.7 + dataArrayRef.current[i] * 0.3
      }
    } else {
      previousDataRef.current = new Uint8Array(dataArrayRef.current)
    }

    // Draw the center line
    ctx.beginPath()
    ctx.strokeStyle = colorScheme === "monochrome" ? "#ffffff" : getGradient(ctx, height)
    ctx.lineWidth = 1
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()

    // Draw the pulse
    ctx.beginPath()
    ctx.strokeStyle = colorScheme === "monochrome" ? "#ffffff" : getGradient(ctx, height)
    ctx.lineWidth = 2

    // Start at left edge
    ctx.moveTo(0, centerY)

    // Draw flat line to pulse start
    const pulseStartX = width * 0.4
    ctx.lineTo(pulseStartX, centerY)

    // Draw the pulse
    const pulseWidth = width * 0.2 // 20% of width
    const pulsePoints = 40
    const pointWidth = pulseWidth / pulsePoints

    for (let i = 0; i < pulsePoints; i++) {
      const x = pulseStartX + i * pointWidth
      const idx = Math.floor((i * previousDataRef.current.length) / pulsePoints)
      const normalized = (previousDataRef.current[idx] / 255) * sensitivity
      const amplitude = normalized * height * 0.2 // 20% of height

      // Create a sine-like wave for the pulse
      const y = centerY + Math.sin((i / pulsePoints) * Math.PI * 2) * amplitude
      ctx.lineTo(x, y)
    }

    // Draw flat line to end
    ctx.lineTo(width, centerY)
    ctx.stroke()
  }

  // Mirror wave visualization
  const drawMirrorWave = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!analyserRef.current || !dataArrayRef.current) return

    analyserRef.current.getByteFrequencyData(dataArrayRef.current)

    // Apply trail effect
    ctx.fillStyle = "rgba(0, 0, 0, " + (1 - trailEffect) + ")"
    ctx.fillRect(0, 0, width, height)

    const centerY = height / 2

    // Draw the waveform
    ctx.beginPath()
    ctx.strokeStyle = colorScheme === "monochrome" ? "#ffffff" : getGradient(ctx, height)
    ctx.lineWidth = 2

    // Use a subset of the frequency data for a cleaner wave
    const startIdx = Math.floor(dataArrayRef.current.length * 0.1)
    const endIdx = Math.floor(dataArrayRef.current.length * 0.3)
    const dataPoints = endIdx - startIdx

    const sliceWidth = width / dataPoints
    let x = 0

    // Draw the top wave
    for (let i = startIdx; i < endIdx; i++) {
      const normalized = (dataArrayRef.current[i] / 255) * sensitivity
      const y = centerY - normalized * (height / 4)

      if (i === startIdx) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      x += sliceWidth
    }

    // Mirror and draw the bottom wave (in reverse)
    x -= sliceWidth // Move back one step

    for (let i = endIdx - 1; i >= startIdx; i--) {
      const normalized = (dataArrayRef.current[i] / 255) * sensitivity
      const y = centerY + normalized * (height / 4)

      ctx.lineTo(x, y)
      x -= sliceWidth
    }

    // Close the path to create a solid shape
    ctx.closePath()

    // Fill with a subtle gradient
    if (colorScheme === "monochrome") {
      ctx.strokeStyle = "#ffffff"
      ctx.stroke()
    } else {
      const gradient = ctx.createLinearGradient(0, centerY - height / 4, 0, centerY + height / 4)
      if (colorScheme === "gradient-purple") {
        gradient.addColorStop(0, "rgba(147, 51, 234, 0.7)")
        gradient.addColorStop(1, "rgba(76, 29, 149, 0.7)")
      } else if (colorScheme === "gradient-blue") {
        gradient.addColorStop(0, "rgba(37, 99, 235, 0.7)")
        gradient.addColorStop(1, "rgba(30, 64, 175, 0.7)")
      } else if (colorScheme === "gradient-green") {
        gradient.addColorStop(0, "rgba(16, 185, 129, 0.7)")
        gradient.addColorStop(1, "rgba(4, 120, 87, 0.7)")
      } else if (colorScheme === "gradient-red") {
        gradient.addColorStop(0, "rgba(239, 68, 68, 0.7)")
        gradient.addColorStop(1, "rgba(185, 28, 28, 0.7)")
      } else if (colorScheme === "rainbow") {
        gradient.addColorStop(0, "rgba(255, 0, 0, 0.7)")
        gradient.addColorStop(0.2, "rgba(255, 165, 0, 0.7)")
        gradient.addColorStop(0.4, "rgba(255, 255, 0, 0.7)")
        gradient.addColorStop(0.6, "rgba(0, 128, 0, 0.7)")
        gradient.addColorStop(0.8, "rgba(0, 0, 255, 0.7)")
        gradient.addColorStop(1, "rgba(75, 0, 130, 0.7)")
      }
      ctx.fillStyle = gradient
      ctx.fill()
      ctx.strokeStyle = "#ffffff"
      ctx.stroke()
    }
  }

  // Fluid motion visualization
  const drawFluidMotion = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!analyserRef.current || !dataArrayRef.current) return

    analyserRef.current.getByteFrequencyData(dataArrayRef.current)

    // Apply trail effect
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - trailEffect})`
    ctx.fillRect(0, 0, width, height)

    // Calculate average frequency for intensity
    let sum = 0
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i]
    }
    const avgFrequency = sum / dataArrayRef.current.length
    const intensity = (avgFrequency / 255) * sensitivity

    // Update time
    timeRef.current += 0.01 * timeScale

    // Draw fluid effect
    const centerX = width / 2
    const centerY = height / 2
    const maxRadius = Math.min(width, height) * 0.4

    // Draw multiple layers of fluid-like shapes
    for (let layer = 1; layer <= 5; layer++) {
      const layerRadius = maxRadius * (layer / 5)
      const points = 100
      const angleStep = (2 * Math.PI) / points

      ctx.beginPath()

      // Create a closed shape with wavy edges
      for (let i = 0; i <= points; i++) {
        const angle = i * angleStep
        const baseX = centerX + Math.cos(angle) * layerRadius
        const baseY = centerY + Math.sin(angle) * layerRadius

        // Add wave distortion based on time and audio
        const distortion =
          Math.sin(angle * 3 + timeRef.current) * intensity * 30 +
          Math.cos(angle * 5 - timeRef.current * 0.7) * intensity * 20

        const x = baseX + Math.cos(angle) * distortion
        const y = baseY + Math.sin(angle) * distortion

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }

      ctx.closePath()

      // Fill with gradient or color
      if (colorScheme === "rainbow") {
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius)
        gradient.addColorStop(0, `hsla(${(timeRef.current * 20) % 360}, 100%, 50%, 0.3)`)
        gradient.addColorStop(layer / 5, `hsla(${(timeRef.current * 20 + 60 * layer) % 360}, 100%, 50%, 0.3)`)
        gradient.addColorStop(1, `hsla(${(timeRef.current * 20 + 120) % 360}, 100%, 50%, 0.1)`)
        ctx.fillStyle = gradient
      } else {
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius)
        if (colorScheme === "gradient-purple") {
          gradient.addColorStop(0, "rgba(147, 51, 234, 0.3)")
          gradient.addColorStop(layer / 5, "rgba(126, 34, 206, 0.3)")
          gradient.addColorStop(1, "rgba(76, 29, 149, 0.1)")
        } else if (colorScheme === "gradient-blue") {
          gradient.addColorStop(0, "rgba(37, 99, 235, 0.3)")
          gradient.addColorStop(layer / 5, "rgba(29, 78, 216, 0.3)")
          gradient.addColorStop(1, "rgba(30, 64, 175, 0.1)")
        } else if (colorScheme === "gradient-green") {
          gradient.addColorStop(0, "rgba(16, 185, 129, 0.3)")
          gradient.addColorStop(layer / 5, "rgba(5, 150, 105, 0.3)")
          gradient.addColorStop(1, "rgba(4, 120, 87, 0.1)")
        } else if (colorScheme === "gradient-red") {
          gradient.addColorStop(0, "rgba(239, 68, 68, 0.3)")
          gradient.addColorStop(layer / 5, "rgba(220, 38, 38, 0.3)")
          gradient.addColorStop(1, "rgba(185, 28, 28, 0.1)")
        } else {
          gradient.addColorStop(0, "rgba(255, 255, 255, 0.3)")
          gradient.addColorStop(layer / 5, "rgba(200, 200, 200, 0.3)")
          gradient.addColorStop(1, "rgba(150, 150, 150, 0.1)")
        }
        ctx.fillStyle = gradient
      }

      ctx.fill()
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"
      ctx.stroke()
    }

    // Add particles for extra effect
    if (particlesRef.current.length > 0) {
      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i]

        // Update particle position based on audio
        const freqIndex = Math.floor((i / particlesRef.current.length) * dataArrayRef.current.length)
        const freqValue = dataArrayRef.current[freqIndex] / 255

        p.x += p.vx * (1 + freqValue * 5)
        p.y += p.vy * (1 + freqValue * 5)

        // Wrap around edges
        if (p.x < 0) p.x = 1
        if (p.x > 1) p.x = 0
        if (p.y < 0) p.y = 1
        if (p.y > 1) p.y = 0

        // Draw particle
        const particleX = p.x * width
        const particleY = p.y * height
        const particleSize = p.size * (0.5 + freqValue)

        ctx.beginPath()
        ctx.arc(particleX, particleY, particleSize, 0, Math.PI * 2)

        if (colorScheme === "rainbow") {
          ctx.fillStyle = `hsla(${(timeRef.current * 50 + i * 10) % 360}, 100%, 50%, 0.7)`
        } else if (colorScheme === "monochrome") {
          ctx.fillStyle = "rgba(255, 255, 255, 0.7)"
        } else {
          ctx.fillStyle = p.color
        }

        ctx.fill()
      }
    }
  }

  // Vortex visualization
  const drawVortex = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!analyserRef.current || !dataArrayRef.current) return

    analyserRef.current.getByteFrequencyData(dataArrayRef.current)

    // Apply trail effect
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - trailEffect})`
    ctx.fillRect(0, 0, width, height)

    // Calculate average frequency for intensity
    let sum = 0
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i]
    }
    const avgFrequency = sum / dataArrayRef.current.length
    const intensity = (avgFrequency / 255) * sensitivity

    // Update time
    timeRef.current += 0.01 * timeScale

    const centerX = width / 2
    const centerY = height / 2

    // Draw spiral vortex
    const maxRadius = Math.min(width, height) * 0.45
    const spiralCount = 4
    const rotations = 3 + intensity * 2

    for (let s = 0; s < spiralCount; s++) {
      ctx.beginPath()

      const spiralOffset = (s / spiralCount) * Math.PI * 2
      const spiralColor =
        colorScheme === "rainbow"
          ? `hsla(${(timeRef.current * 30 + s * 90) % 360}, 100%, 50%, 0.7)`
          : colorScheme === "monochrome"
            ? "rgba(255, 255, 255, 0.7)"
            : getGradient(ctx, height).toString()

      ctx.strokeStyle = spiralColor
      ctx.lineWidth = 2 + intensity * 3

      // Draw spiral
      for (let i = 0; i < 500; i++) {
        const t = i / 100
        const angle = spiralOffset + t * Math.PI * 2 * rotations
        const radius = t * maxRadius

        // Add wave distortion based on audio
        const freqIndex = Math.floor((i / 500) * dataArrayRef.current.length)
        const freqValue = dataArrayRef.current[freqIndex] / 255
        const distortion = Math.sin(t * 10 + timeRef.current) * freqValue * 20

        const x = centerX + Math.cos(angle) * (radius + distortion)
        const y = centerY + Math.sin(angle) * (radius + distortion)

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }

      ctx.stroke()
    }

    // Add particles flowing along the spiral
    if (particlesRef.current.length > 0) {
      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i]

        // Update particle life
        p.life -= 1
        if (p.life <= 0) {
          // Reset particle
          p.life = p.maxLife
          p.x = 0.5
          p.y = 0.5
          p.size = Math.random() * 5 + 2
        }

        // Calculate particle position along spiral
        const t = 1 - p.life / p.maxLife
        const angle = t * Math.PI * 2 * rotations
        const radius = t * maxRadius

        // Add some randomness
        const freqIndex = Math.floor((i / particlesRef.current.length) * dataArrayRef.current.length)
        const freqValue = dataArrayRef.current[freqIndex] / 255

        p.x = (centerX + Math.cos(angle) * radius) / width
        p.y = (centerY + Math.sin(angle) * radius) / height

        // Draw particle
        const particleX = p.x * width
        const particleY = p.y * height
        const particleSize = p.size * (0.5 + freqValue)

        ctx.beginPath()
        ctx.arc(particleX, particleY, particleSize, 0, Math.PI * 2)

        if (colorScheme === "rainbow") {
          ctx.fillStyle = `hsla(${(timeRef.current * 50 + i * 10) % 360}, 100%, 50%, 0.7)`
        } else if (colorScheme === "monochrome") {
          ctx.fillStyle = "rgba(255, 255, 255, 0.7)"
        } else {
          ctx.fillStyle = p.color
        }

        ctx.fill()
      }
    }
  }

  const draw = () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx) return

    // Set canvas dimensions to match its display size
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight

    const width = canvas.width
    const height = canvas.height

    // Clear canvas (only fully clear for non-trail visualizations)
    if (
      visualizerType !== "centerWave" &&
      visualizerType !== "pulseWave" &&
      visualizerType !== "mirrorWave" &&
      visualizerType !== "fluidMotion" &&
      visualizerType !== "vortex"
    ) {
      ctx.clearRect(0, 0, width, height)
    }

    // Draw based on selected visualizer type
    if (!analyserRef.current || !dataArrayRef.current) {
      // If analyzer is not available, show a placeholder or message
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = "#ffffff"
      ctx.font = "16px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("Start listening to see visualization", width / 2, height / 2)
    } else {
      // Draw the selected visualization - use the ref instead of state
      const currentType = currentVisualizerTypeRef.current

      if (currentType === "waveform") {
        drawWaveform(ctx, width, height)
      } else if (currentType === "bars") {
        drawBars(ctx, width, height)
      } else if (currentType === "circular") {
        drawCircular(ctx, width, height)
      } else if (currentType === "centerWave") {
        drawCenterWave(ctx, width, height)
      } else if (currentType === "pulseWave") {
        drawPulseWave(ctx, width, height)
      } else if (currentType === "mirrorWave") {
        drawMirrorWave(ctx, width, height)
      } else if (currentType === "fluidMotion") {
        drawFluidMotion(ctx, width, height)
      } else if (currentType === "vortex") {
        drawVortex(ctx, width, height)
      }
    }

    // Continue animation loop
    animationRef.current = requestAnimationFrame(draw)
  }

  const applyPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return

    // Only show loading if we're currently listening
    if (isListening) {
      setIsLoading(true)

      // First stop listening
      stopListening()

      // Use setTimeout to ensure state updates have time to process
      setTimeout(() => {
        // Update all the settings
        setVisualizerType(preset.visualizerType)
        setColorScheme(preset.colorScheme)
        setSensitivity(preset.sensitivity)
        setTrailEffect(preset.trailEffect)
        setActivePreset(presetId)

        // Wait a bit longer to ensure the state has updated
        setTimeout(() => {
          // Start listening again with the new settings
          startListening()
            .then(() => {
              setIsLoading(false)
            })
            .catch((error) => {
              console.error("Error restarting audio:", error)
              setIsLoading(false)
            })
        }, 500)
      }, 800)
    } else {
      // If not listening, just change the settings without loading state
      setVisualizerType(preset.visualizerType)
      setColorScheme(preset.colorScheme)
      setSensitivity(preset.sensitivity)
      setTrailEffect(preset.trailEffect)
      setActivePreset(presetId)
    }
  }

  // Add this new function to handle visualization type changes
  const handleVisualizerTypeChange = (value: VisualizerType) => {
    // Only show loading if we're currently listening
    if (isListening) {
      setIsLoading(true)

      // First stop listening
      stopListening()

      // Use setTimeout to ensure state updates have time to process
      setTimeout(() => {
        // Update the visualizer type
        setVisualizerType(value)

        // Wait a bit longer to ensure the state has updated
        setTimeout(() => {
          // Start listening again with the new visualization type
          startListening()
            .then(() => {
              setIsLoading(false)
            })
            .catch((error) => {
              console.error("Error restarting audio:", error)
              setIsLoading(false)
            })
        }, 500)
      }, 800)
    } else {
      // If not listening, just change the type without loading state
      setVisualizerType(value)
    }
  }

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
    } else {
      document.exitFullscreen()
    }
  }, [])

  // Handle double tap
  const handleTap = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      // Prevent default behavior for touch events to avoid Safari's built-in double-tap zoom
      if ("touches" in e) {
        e.preventDefault()
      }

      const now = Date.now()
      const timeSinceLastTap = now - lastTapTime

      if (timeSinceLastTap < 300) {
        // Double tap threshold
        toggleFullscreen()
      }

      setLastTapTime(now)
    },
    [lastTapTime, toggleFullscreen],
  )

  // Handle mouse movement to show controls in fullscreen
  const handleMouseMove = useCallback(() => {
    if (!isFullscreen) return

    setShowFullscreenControls(true)

    // Clear any existing timeout
    if (controlsTimeout) {
      clearTimeout(controlsTimeout)
    }

    // Set a new timeout to hide controls after 3 seconds
    const timeout = setTimeout(() => {
      setShowFullscreenControls(false)
    }, 3000)

    setControlsTimeout(timeout)
  }, [isFullscreen, controlsTimeout])

  // Toggle fullscreen controls
  const toggleFullscreenControls = useCallback(() => {
    setShowFullscreenControls(!showFullscreenControls)

    // Clear any existing timeout when manually toggling
    if (controlsTimeout) {
      clearTimeout(controlsTimeout)
      setControlsTimeout(null)
    }
  }, [showFullscreenControls, controlsTimeout])

  // Add specific handling for iOS Safari touch events
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Prevent default behavior for touchstart to avoid Safari's double-tap zoom
    const preventDefaultTouch = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault()
      }
    }

    container.addEventListener("touchstart", preventDefaultTouch, { passive: false })

    return () => {
      container.removeEventListener("touchstart", preventDefaultTouch)
    }
  }, [])

  return (
    <div className="flex flex-col items-center space-y-6 font-['Quicksand',_sans-serif]">
      {!isFullscreen && (
        <>
          <div className="flex flex-wrap items-center justify-between w-full gap-4 mb-4">
            <div className={`flex ${isMobile ? "flex-col w-full" : "items-center"} gap-4`}>
              <Button
                onClick={toggleListening}
                variant={isListening ? "destructive" : "default"}
                size={isMobile ? "default" : "lg"}
                className={`gap-2 ${isMobile ? "w-full" : ""}`}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                {isListening ? "Stop Listening" : "Start Listening"}
              </Button>

              <Select
                value={visualizerType}
                onValueChange={(value) => handleVisualizerTypeChange(value as VisualizerType)}
              >
                <SelectTrigger className={isMobile ? "w-full" : "w-[180px]"}>
                  <SelectValue placeholder="Visualizer Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="centerWave">
                    <div className="flex items-center gap-2">
                      <Waveform size={16} />
                      <span>Center Wave</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="pulseWave">
                    <div className="flex items-center gap-2">
                      <Waves size={16} />
                      <span>Pulse Wave</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="mirrorWave">
                    <div className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M3 12h18M7 8c1.5 0 3 4 3 4s1.5 4 3 4 3-4 3-4 1.5-4 3-4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>Mirror Wave</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="waveform">
                    <div className="flex items-center gap-2">
                      <Waveform size={16} />
                      <span>Classic Wave</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="bars">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={16} />
                      <span>Frequency Bars</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="circular">
                    <div className="flex items-center gap-2">
                      <Circle size={16} />
                      <span>Circular</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="fluidMotion">
                    <div className="flex items-center gap-2">
                      <Flower2 size={16} />
                      <span>Fluid Motion</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="vortex">
                    <div className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M12 12C12 12 16 8 16 4M12 12C12 12 8 8 4 8M12 12C12 12 16 16 16 20M12 12C12 12 8 16 4 16"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>Vortex</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={`flex items-center gap-2 ${isMobile ? "w-full justify-between mt-2" : ""}`}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings size={18} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <h3 className="font-medium">Settings</h3>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="sensitivity" className="text-sm">
                          Sensitivity: {sensitivity.toFixed(1)}
                        </label>
                      </div>
                      <Slider
                        id="sensitivity"
                        min={0.5}
                        max={3}
                        step={0.1}
                        value={[sensitivity]}
                        onValueChange={(value) => setSensitivity(value[0])}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="trail" className="text-sm">
                          Trail Effect: {(trailEffect * 100).toFixed(0)}%
                        </label>
                      </div>
                      <Slider
                        id="trail"
                        min={0}
                        max={0.95}
                        step={0.05}
                        value={[trailEffect]}
                        onValueChange={(value) => setTrailEffect(value[0])}
                      />
                    </div>

                    {(visualizerType === "fluidMotion" || visualizerType === "vortex") && (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="timeScale" className="text-sm">
                              Speed: {timeScale.toFixed(1)}x
                            </label>
                          </div>
                          <Slider
                            id="timeScale"
                            min={0.1}
                            max={3.0}
                            step={0.1}
                            value={[timeScale]}
                            onValueChange={(value) => setTimeScale(value[0])}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="particles" className="text-sm">
                              Particles: {particleCount}
                            </label>
                          </div>
                          <Slider
                            id="particles"
                            min={0}
                            max={300}
                            step={10}
                            value={[particleCount]}
                            onValueChange={(value) => setParticleCount(value[0])}
                          />
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm">Color Scheme</label>
                      <Select value={colorScheme} onValueChange={(value) => setColorScheme(value as ColorScheme)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select color scheme" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monochrome">Monochrome</SelectItem>
                          <SelectItem value="gradient-purple">Purple Gradient</SelectItem>
                          <SelectItem value="gradient-blue">Blue Gradient</SelectItem>
                          <SelectItem value="gradient-green">Green Gradient</SelectItem>
                          <SelectItem value="gradient-red">Red Gradient</SelectItem>
                          <SelectItem value="rainbow">Rainbow</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setLandscapeMode(!landscapeMode)}
                className="relative"
                aria-label="Toggle landscape mode"
              >
                <span className={`transform transition-transform ${landscapeMode ? "rotate-90" : "rotate-0"}`}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m2 8 20 0" />
                  </svg>
                </span>
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={toggleFullscreen}
                className="relative"
                aria-label="Toggle fullscreen mode"
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </Button>
            </div>
          </div>

          {/* Presets Section */}
          <div className="w-full">
            <h3 className="text-sm font-medium mb-2 text-gray-300">Presets</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.id}
                  variant={activePreset === preset.id ? "default" : "outline"}
                  className={`flex flex-col items-center justify-center h-24 p-2 text-xs gap-1 ${
                    activePreset === preset.id ? "border-2 border-primary" : ""
                  }`}
                  onClick={() => applyPreset(preset.id)}
                >
                  <div className="text-lg mb-1">{preset.icon}</div>
                  <span className="font-medium text-center w-full break-words">{preset.name}</span>
                  <span className="text-[10px] text-gray-400 text-center w-full line-clamp-2 break-words">
                    {preset.description}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </>
      )}

      <div
        ref={containerRef}
        className={cn(
          "relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-gray-800 transition-all duration-300",
          landscapeMode ? "transform rotate-90 h-[80vw] -mx-[calc(40vw-40%)]" : "",
          isFullscreen ? "border-0 rounded-none" : "",
        )}
        onClick={handleTap}
        onTouchStart={handleTap}
        onTouchEnd={(e) => e.preventDefault()} // Prevent ghost clicks
        onMouseMove={handleMouseMove}
        style={{ touchAction: "manipulation" }} // Disable browser handling of gestures
      >
        <canvas ref={canvasRef} className="w-full h-full" />

        {!isListening && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
            <Button
              size={isMobile ? "default" : "lg"}
              onClick={(e) => toggleListening(e)}
              className="gap-2 text-lg"
              onTouchStart={(e) => {
                e.stopPropagation()
              }}
            >
              <Mic size={24} />
              Start Listening
            </Button>
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
            <div className="w-16 h-16 border-4 border-t-primary border-opacity-50 rounded-full animate-spin mb-4"></div>
            <p className="text-lg font-medium text-white">Upgrading experience...</p>
          </div>
        )}

        {/* Fullscreen Controls */}
        {isFullscreen && showFullscreenControls && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-300">
            <div className="flex flex-col gap-4 max-w-4xl mx-auto">
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white"
                  onClick={toggleFullscreenControls}
                >
                  <ChevronDown size={20} />
                </Button>
              </div>

              {/* Presets in fullscreen */}
              <div className={`grid ${isMobile ? "grid-cols-2" : "grid-cols-4 md:grid-cols-8"} gap-2`}>
                {presets.map((preset) => (
                  <Button
                    key={preset.id}
                    variant={activePreset === preset.id ? "default" : "outline"}
                    size="sm"
                    className={`flex items-center gap-1 h-auto py-1 ${
                      activePreset === preset.id ? "bg-white/20" : "bg-black/40"
                    }`}
                    onClick={() => applyPreset(preset.id)}
                  >
                    <div>{preset.icon}</div>
                    <span className="text-xs">{preset.name}</span>
                  </Button>
                ))}
              </div>

              {/* Minimal settings in fullscreen */}
              <div className={`flex ${isMobile ? "flex-col" : "items-center"} gap-4 justify-between flex-wrap`}>
                <div className={`flex ${isMobile ? "w-full justify-between" : ""} items-center gap-2`}>
                  <Button
                    onClick={(e) => toggleListening(e)}
                    variant={isListening ? "destructive" : "default"}
                    size="sm"
                    className="gap-1"
                  >
                    {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                    {isListening ? "Stop" : "Start"}
                  </Button>

                  <Select
                    value={visualizerType}
                    onValueChange={(value) => handleVisualizerTypeChange(value as VisualizerType)}
                  >
                    <SelectTrigger className={isMobile ? "w-[120px]" : "w-[140px]"} style={{ height: "32px" }}>
                      <SelectValue placeholder="Visualizer Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="centerWave">Center Wave</SelectItem>
                      <SelectItem value="pulseWave">Pulse Wave</SelectItem>
                      <SelectItem value="mirrorWave">Mirror Wave</SelectItem>
                      <SelectItem value="waveform">Classic Wave</SelectItem>
                      <SelectItem value="bars">Frequency Bars</SelectItem>
                      <SelectItem value="circular">Circular</SelectItem>
                      <SelectItem value="fluidMotion">Fluid Motion</SelectItem>
                      <SelectItem value="vortex">Vortex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className={`flex ${isMobile ? "flex-col w-full" : "items-center"} gap-4 flex-wrap`}>
                  <div className="flex flex-col gap-1 w-full sm:w-32">
                    <label className="text-xs text-white/70">Sensitivity</label>
                    <Slider
                      min={0.5}
                      max={3}
                      step={0.1}
                      value={[sensitivity]}
                      onValueChange={(value) => setSensitivity(value[0])}
                    />
                  </div>

                  <div className="flex flex-col gap-1 w-full sm:w-32">
                    <label className="text-xs text-white/70">Trail Effect</label>
                    <Slider
                      min={0}
                      max={0.95}
                      step={0.05}
                      value={[trailEffect]}
                      onValueChange={(value) => setTrailEffect(value[0])}
                    />
                  </div>

                  <Select value={colorScheme} onValueChange={(value) => setColorScheme(value as ColorScheme)}>
                    <SelectTrigger className={isMobile ? "w-full" : "w-[140px]"} style={{ height: "32px" }}>
                      <SelectValue placeholder="Color Scheme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monochrome">Monochrome</SelectItem>
                      <SelectItem value="gradient-purple">Purple</SelectItem>
                      <SelectItem value="gradient-blue">Blue</SelectItem>
                      <SelectItem value="gradient-green">Green</SelectItem>
                      <SelectItem value="gradient-red">Red</SelectItem>
                      <SelectItem value="rainbow">Rainbow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}

        {isFullscreen && !showFullscreenControls && (
          <>
            <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
              {activePreset ? presets.find((p) => p.id === activePreset)?.name : visualizerType}
            </div>

            <div className="absolute bottom-4 left-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/50 hover:text-white bg-black/30 hover:bg-black/50 rounded-full h-8 w-8 p-0"
                onClick={toggleFullscreenControls}
              >
                <ChevronUp size={16} />
              </Button>
            </div>
          </>
        )}

        {isFullscreen && (
          <div className="absolute top-4 left-4 text-white/70 font-medium">Double-tap to exit fullscreen</div>
        )}
      </div>

      {!isFullscreen && (
        <p className="text-center text-sm text-gray-400 mt-2">Double-tap the visualizer to toggle fullscreen</p>
      )}

      {landscapeMode && (
        <p className="text-center text-sm text-gray-400 mt-4 italic">
          Rotate your device for the best landscape experience
        </p>
      )}
    </div>
  )
}
