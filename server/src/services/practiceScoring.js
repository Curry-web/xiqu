import fs from 'node:fs/promises'

const PCM_MAX = 32768
const PITCH_FRAME_SIZE = 1024
const PITCH_HOP_SIZE = 320
const MIN_PITCH_HZ = 80
const MAX_PITCH_HZ = 800
const MAX_CONTOUR_POINTS = 700
const TIMBRE_FREQUENCIES = [150, 200, 250, 320, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000]

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function median(values) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function trimmedMean(values, trimRatio = 0.1) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const trim = Math.min(Math.floor(sorted.length * trimRatio), Math.floor((sorted.length - 1) / 2))
  const kept = sorted.slice(trim, sorted.length - trim)
  return kept.reduce((sum, value) => sum + value, 0) / kept.length
}

function upperTrimmedMean(values, trimRatio = 0.2) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const keepCount = Math.max(1, Math.ceil(sorted.length * (1 - trimRatio)))
  const kept = sorted.slice(0, keepCount)
  return kept.reduce((sum, value) => sum + value, 0) / kept.length
}

function readWavChunks(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('转码后的文件不是有效 wav 格式。')
  }

  let offset = 12
  let format
  let data

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    const start = offset + 8
    const end = Math.min(start + size, buffer.length)

    if (id === 'fmt ') {
      format = {
        audioFormat: buffer.readUInt16LE(start),
        channels: buffer.readUInt16LE(start + 2),
        sampleRate: buffer.readUInt32LE(start + 4),
        bitsPerSample: buffer.readUInt16LE(start + 14),
      }
    }

    if (id === 'data') data = buffer.subarray(start, end)
    offset = end + (size % 2)
  }

  if (!format || !data) throw new Error('转码后的 wav 缺少音频数据。')
  if (format.audioFormat !== 1 || format.bitsPerSample !== 16 || format.channels !== 1) {
    throw new Error('本地练功分析需要 16 位单声道 wav。')
  }

  return { format, data }
}

function toSamples(data) {
  const samples = new Float64Array(Math.floor(data.length / 2))
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = data.readInt16LE(index * 2) / PCM_MAX
  }
  return samples
}

function estimatePitch(samples, offset, sampleRate, rms) {
  if (rms < 0.006) return null

  const minLag = Math.max(2, Math.floor(sampleRate / MAX_PITCH_HZ))
  const maxLag = Math.min(Math.floor(sampleRate / MIN_PITCH_HZ), PITCH_FRAME_SIZE - 2)
  const analysisLength = PITCH_FRAME_SIZE - maxLag
  const difference = new Float64Array(maxLag + 1)
  const normalizedDifference = new Float64Array(maxLag + 1)

  for (let lag = 1; lag <= maxLag; lag += 1) {
    let sum = 0
    for (let index = 0; index < analysisLength; index += 1) {
      const delta = samples[offset + index] - samples[offset + index + lag]
      sum += delta * delta
    }
    difference[lag] = sum
  }

  normalizedDifference[0] = 1
  let runningSum = 0
  for (let lag = 1; lag <= maxLag; lag += 1) {
    runningSum += difference[lag]
    normalizedDifference[lag] = runningSum > 0 ? difference[lag] * lag / runningSum : 1
  }

  let candidate = -1
  for (let lag = minLag; lag < maxLag; lag += 1) {
    if (normalizedDifference[lag] < 0.16) {
      candidate = lag
      while (candidate + 1 <= maxLag && normalizedDifference[candidate + 1] < normalizedDifference[candidate]) {
        candidate += 1
      }
      break
    }
  }

  if (candidate < 0) {
    let bestValue = Number.POSITIVE_INFINITY
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      if (normalizedDifference[lag] < bestValue) {
        bestValue = normalizedDifference[lag]
        candidate = lag
      }
    }
  }

  const confidence = 1 - normalizedDifference[candidate]
  if (confidence < 0.55) return null

  const left = normalizedDifference[Math.max(minLag, candidate - 1)]
  const center = normalizedDifference[candidate]
  const right = normalizedDifference[Math.min(maxLag, candidate + 1)]
  const denominator = left - 2 * center + right
  const adjustment = Math.abs(denominator) > 1e-9 ? 0.5 * (left - right) / denominator : 0
  const refinedLag = candidate + clamp(adjustment, -0.5, 0.5)
  const frequency = sampleRate / refinedLag

  if (!Number.isFinite(frequency) || frequency < MIN_PITCH_HZ || frequency > MAX_PITCH_HZ) return null

  return {
    cents: 6900 + 1200 * Math.log2(frequency / 440),
    confidence,
  }
}

function stabilizePitchContour(points) {
  if (points.length === 0) return points

  const octaveAdjusted = points.map((point) => ({ ...point }))
  for (let index = 1; index < octaveAdjusted.length; index += 1) {
    const current = octaveAdjusted[index]
    const previous = octaveAdjusted[index - 1]
    if (current.frameIndex - previous.frameIndex > 2) continue

    const alternatives = [current.cents - 1200, current.cents, current.cents + 1200]
    const closest = alternatives.reduce((best, value) => (
      Math.abs(value - previous.cents) < Math.abs(best - previous.cents) ? value : best
    ), current.cents)

    if (Math.abs(closest - previous.cents) + 350 < Math.abs(current.cents - previous.cents)) {
      current.cents = closest
    }
  }

  return octaveAdjusted.map((point, index) => {
    const nearby = []
    for (let cursor = Math.max(0, index - 2); cursor <= Math.min(octaveAdjusted.length - 1, index + 2); cursor += 1) {
      if (Math.abs(octaveAdjusted[cursor].frameIndex - point.frameIndex) <= 3) {
        nearby.push(octaveAdjusted[cursor].cents)
      }
    }
    return { ...point, cents: median(nearby) }
  })
}

function compressContour(points) {
  if (points.length <= MAX_CONTOUR_POINTS) return points
  const compressed = []
  const bucketSize = points.length / MAX_CONTOUR_POINTS

  for (let bucket = 0; bucket < MAX_CONTOUR_POINTS; bucket += 1) {
    const start = Math.floor(bucket * bucketSize)
    const end = Math.max(start + 1, Math.floor((bucket + 1) * bucketSize))
    const slice = points.slice(start, Math.min(points.length, end))
    compressed.push({
      frameIndex: Math.round(slice.reduce((sum, point) => sum + point.frameIndex, 0) / slice.length),
      time: slice.reduce((sum, point) => sum + point.time, 0) / slice.length,
      cents: median(slice.map((point) => point.cents)),
      confidence: slice.reduce((sum, point) => sum + point.confidence, 0) / slice.length,
      rms: slice.reduce((sum, point) => sum + point.rms, 0) / slice.length,
    })
  }

  return compressed
}

function goertzelPower(samples, offset, sampleRate, frequency) {
  const coefficient = 2 * Math.cos(2 * Math.PI * frequency / sampleRate)
  let previous = 0
  let previousPrevious = 0

  for (let index = 0; index < PITCH_FRAME_SIZE; index += 1) {
    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (PITCH_FRAME_SIZE - 1))
    const current = samples[offset + index] * window + coefficient * previous - previousPrevious
    previousPrevious = previous
    previous = current
  }

  return Math.max(0, previousPrevious * previousPrevious + previous * previous - coefficient * previous * previousPrevious)
}

function extractTimbreFrame(samples, offset, sampleRate) {
  const powers = TIMBRE_FREQUENCIES.map((frequency) => goertzelPower(samples, offset, sampleRate, frequency))
  const totalPower = powers.reduce((sum, power) => sum + power, 0)
  if (totalPower <= 1e-12) return null

  let centroid = 0
  let lowPower = 0
  let middlePower = 0
  let highPower = 0
  for (let index = 0; index < powers.length; index += 1) {
    const frequency = TIMBRE_FREQUENCIES[index]
    const power = powers[index]
    centroid += frequency * power
    if (frequency < 630) lowPower += power
    else if (frequency < 2000) middlePower += power
    else highPower += power
  }

  return {
    centroidHz: centroid / totalPower,
    brightness: highPower / totalPower,
    resonance: middlePower / Math.max(lowPower + middlePower, 1e-12),
  }
}

function summarizeTimbre(frames) {
  if (frames.length === 0) return { centroidHz: 0, brightness: 0, resonance: 0 }
  return {
    centroidHz: median(frames.map((frame) => frame.centroidHz)),
    brightness: median(frames.map((frame) => frame.brightness)),
    resonance: median(frames.map((frame) => frame.resonance)),
  }
}

function analyzeVibrato(points) {
  if (points.length < 30) return { rateHz: 0, extentCents: 0, coverage: 0 }

  const residuals = points.map((point, index) => {
    const local = []
    for (let cursor = Math.max(0, index - 10); cursor <= Math.min(points.length - 1, index + 10); cursor += 1) {
      if (Math.abs(points[cursor].time - point.time) <= 0.24) local.push(points[cursor].cents)
    }
    return point.cents - median(local)
  })

  const candidates = []
  let segmentStart = 0
  for (let index = 1; index <= points.length; index += 1) {
    const segmentEnded = index === points.length || points[index].frameIndex - points[index - 1].frameIndex > 2
    if (!segmentEnded) continue

    const segmentLength = index - segmentStart
    if (segmentLength >= 24) {
      const segmentResiduals = residuals.slice(segmentStart, index)
      let crossings = 0
      let previousSign = 0
      for (const residual of segmentResiduals) {
        const sign = residual >= 7 ? 1 : residual <= -7 ? -1 : 0
        if (sign !== 0 && previousSign !== 0 && sign !== previousSign) crossings += 1
        if (sign !== 0) previousSign = sign
      }

      const duration = Math.max(points[index - 1].time - points[segmentStart].time, 0.02)
      const rateHz = crossings / (2 * duration)
      const extentCents = 2 * Math.sqrt(
        segmentResiduals.reduce((sum, residual) => sum + residual * residual, 0) / segmentResiduals.length,
      )
      if (rateHz >= 3 && rateHz <= 9 && extentCents >= 12 && extentCents <= 260) {
        candidates.push({ rateHz, extentCents, length: segmentLength })
      }
    }
    segmentStart = index
  }

  const coveredPoints = candidates.reduce((sum, candidate) => sum + candidate.length, 0)
  return {
    rateHz: candidates.length > 0 ? median(candidates.map((candidate) => candidate.rateHz)) : 0,
    extentCents: candidates.length > 0 ? median(candidates.map((candidate) => candidate.extentCents)) : 0,
    coverage: coveredPoints / points.length,
  }
}

function resampleEnvelope(envelope, targetLength = 160) {
  if (envelope.length === 0) return []
  const active = envelope.filter((value) => value >= 0.006)
  const baseline = Math.max(median(active), 0.006)
  const result = []

  for (let bucket = 0; bucket < targetLength; bucket += 1) {
    const start = Math.floor(bucket * envelope.length / targetLength)
    const end = Math.max(start + 1, Math.floor((bucket + 1) * envelope.length / targetLength))
    const slice = envelope.slice(start, Math.min(envelope.length, end))
    const rms = slice.reduce((sum, value) => sum + value, 0) / slice.length
    result.push(20 * Math.log10(Math.max(rms, 0.001) / baseline))
  }

  return result
}

function scoreRelativeDifference(reference, attempt, tolerance) {
  if (reference <= 0 && attempt <= 0) return 100
  if (reference <= 0 || attempt <= 0) return 35
  return clamp(100 - Math.abs(attempt - reference) / tolerance * 100)
}

function compareVibrato(reference, attempt, contourScore) {
  const rateScore = scoreRelativeDifference(reference.rateHz, attempt.rateHz, 2.5)
  const extentScore = scoreRelativeDifference(reference.extentCents, attempt.extentCents, 80)
  const coverageScore = scoreRelativeDifference(reference.coverage, attempt.coverage, 0.35)
  const vibratoSimilarity = clamp(rateScore * 0.35 + extentScore * 0.4 + coverageScore * 0.25)
  return {
    rateScore: Math.round(rateScore),
    extentScore: Math.round(extentScore),
    coverageScore: Math.round(coverageScore),
    vibratoSimilarity: Math.round(vibratoSimilarity),
    ornamentScore: Math.round(clamp(vibratoSimilarity * 0.68 + contourScore * 0.32)),
  }
}

function compareTimbre(reference, attempt) {
  const centroidScore = reference.centroidHz > 0 && attempt.centroidHz > 0
    ? clamp(100 - Math.abs(Math.log2(attempt.centroidHz / reference.centroidHz)) * 70)
    : 35
  const brightnessScore = scoreRelativeDifference(reference.brightness, attempt.brightness, 0.18)
  const resonanceScore = scoreRelativeDifference(reference.resonance, attempt.resonance, 0.22)
  return {
    centroidScore: Math.round(centroidScore),
    brightnessScore: Math.round(brightnessScore),
    resonanceScore: Math.round(resonanceScore),
    timbreScore: Math.round(clamp(centroidScore * 0.42 + brightnessScore * 0.25 + resonanceScore * 0.33)),
  }
}

function compareEnvelopes(reference, attempt) {
  const length = Math.min(reference.length, attempt.length)
  if (length === 0) return 0
  const errors = []
  for (let index = 0; index < length; index += 1) errors.push(Math.abs(reference[index] - attempt[index]))
  return Math.round(clamp(100 - upperTrimmedMean(errors, 0.15) * 12))
}

async function extractPitchContour(wavPath) {
  const buffer = await fs.readFile(wavPath)
  const { format, data } = readWavChunks(buffer)
  const samples = toSamples(data)
  const points = []
  const rmsEnvelope = []
  const timbreFrames = []
  let totalFrames = 0

  for (let offset = 0; offset + PITCH_FRAME_SIZE <= samples.length; offset += PITCH_HOP_SIZE) {
    totalFrames += 1
    let squareSum = 0
    for (let index = 0; index < PITCH_FRAME_SIZE; index += 1) {
      squareSum += samples[offset + index] * samples[offset + index]
    }
    const rms = Math.sqrt(squareSum / PITCH_FRAME_SIZE)
    rmsEnvelope.push(rms)
    if (rms >= 0.008 && totalFrames % 4 === 0) {
      const timbreFrame = extractTimbreFrame(samples, offset, format.sampleRate)
      if (timbreFrame) timbreFrames.push(timbreFrame)
    }
    const pitch = estimatePitch(samples, offset, format.sampleRate, rms)
    if (!pitch) continue

    points.push({
      frameIndex: totalFrames - 1,
      time: offset / format.sampleRate,
      cents: pitch.cents,
      confidence: pitch.confidence,
      rms,
    })
  }

  const stabilizedPoints = stabilizePitchContour(points)
  const contour = compressContour(stabilizedPoints)
  return {
    contour,
    totalFrames,
    voicedRatio: totalFrames > 0 ? points.length / totalFrames : 0,
    durationSeconds: samples.length / format.sampleRate,
    pitchConfidence: median(points.map((point) => point.confidence)),
    vibrato: analyzeVibrato(stabilizedPoints),
    timbre: summarizeTimbre(timbreFrames),
    envelope: resampleEnvelope(rmsEnvelope),
  }
}

function alignContours(reference, attempt) {
  const rows = reference.length + 1
  const columns = attempt.length + 1
  const costs = new Float64Array(rows * columns)
  const directions = new Uint8Array(rows * columns)
  costs.fill(Number.POSITIVE_INFINITY)
  costs[0] = 0
  const bandRadius = Math.max(24, Math.ceil(Math.max(reference.length, attempt.length) * 0.22))

  for (let row = 1; row < rows; row += 1) {
    const expectedColumn = Math.round(row * attempt.length / reference.length)
    const firstColumn = Math.max(1, expectedColumn - bandRadius)
    const lastColumn = Math.min(attempt.length, expectedColumn + bandRadius)
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const index = row * columns + column
      const pitchDistance = Math.min(Math.abs(reference[row - 1].cents - attempt[column - 1].cents), 900) / 900
      const diagonal = costs[(row - 1) * columns + column - 1]
      const vertical = costs[(row - 1) * columns + column] + 0.14
      const horizontal = costs[row * columns + column - 1] + 0.14

      if (diagonal <= vertical && diagonal <= horizontal) {
        costs[index] = pitchDistance + diagonal
        directions[index] = 0
      } else if (vertical <= horizontal) {
        costs[index] = pitchDistance + vertical
        directions[index] = 1
      } else {
        costs[index] = pitchDistance + horizontal
        directions[index] = 2
      }
    }
  }

  const path = []
  let row = reference.length
  let column = attempt.length
  while (row > 0 && column > 0) {
    path.push([row - 1, column - 1])
    const direction = directions[row * columns + column]
    if (direction === 0) {
      row -= 1
      column -= 1
    } else if (direction === 1) {
      row -= 1
    } else {
      column -= 1
    }
  }

  path.reverse()
  return path
}

function scorePitchAccuracy(meanErrorCents) {
  if (meanErrorCents <= 25) return 100 - meanErrorCents * 0.4
  if (meanErrorCents <= 100) return 90 - (meanErrorCents - 25) * (40 / 75)
  return 50 - (meanErrorCents - 100) * 0.25
}

export async function compareSingingWavs(referenceWavPath, attemptWavPath) {
  const [reference, attempt] = await Promise.all([
    extractPitchContour(referenceWavPath),
    extractPitchContour(attemptWavPath),
  ])

  if (reference.contour.length < 12) {
    throw new Error('示范唱段中未检测到足够稳定的旋律音高，请更换参考片段。')
  }
  if (attempt.contour.length < 12) {
    throw new Error('录音中未检测到足够稳定的演唱音高，请靠近麦克风并完整唱完示范片段。')
  }

  const path = alignContours(reference.contour, attempt.contour)
  const absoluteErrors = []
  const signedErrors = []
  const intervalErrors = []
  let diagonalSteps = 0

  for (const [referenceIndex, attemptIndex] of path) {
    const error = attempt.contour[attemptIndex].cents - reference.contour[referenceIndex].cents
    signedErrors.push(error)
    absoluteErrors.push(Math.abs(error))
  }

  for (let index = 1; index < path.length; index += 1) {
    const [previousReference, previousAttempt] = path[index - 1]
    const [currentReference, currentAttempt] = path[index]
    if (currentReference === previousReference + 1 && currentAttempt === previousAttempt + 1) {
      diagonalSteps += 1
      const referenceInterval = reference.contour[currentReference].cents - reference.contour[previousReference].cents
      const attemptInterval = attempt.contour[currentAttempt].cents - attempt.contour[previousAttempt].cents
      intervalErrors.push(Math.min(Math.abs(attemptInterval - referenceInterval), 600))
    }
  }

  const meanPitchErrorCents = upperTrimmedMean(absoluteErrors)
  const averagePitchOffsetCents = median(signedErrors)
  const meanContourErrorCents = trimmedMean(intervalErrors)
  const pitchScore = Math.round(clamp(scorePitchAccuracy(meanPitchErrorCents)))
  const contourScore = Math.round(clamp(100 - meanContourErrorCents / 3))
  const melodyScore = Math.round(clamp(pitchScore * 0.72 + contourScore * 0.28))

  const durationRatio = Math.min(reference.durationSeconds, attempt.durationSeconds)
    / Math.max(reference.durationSeconds, attempt.durationSeconds)
  const voiceRatioDifference = Math.abs(reference.voicedRatio - attempt.voicedRatio)
    / Math.max(reference.voicedRatio, 0.1)
  const durationSimilarity = clamp(durationRatio * 100)
  const voicedSimilarity = clamp(100 - voiceRatioDifference * 100)
  const warpSimilarity = clamp(diagonalSteps / Math.max(path.length - 1, 1) * 100)
  const rhythmScore = Math.round(clamp(
    durationSimilarity * 0.45 + voicedSimilarity * 0.25 + warpSimilarity * 0.3,
  ))
  const vibratoComparison = compareVibrato(reference.vibrato, attempt.vibrato, contourScore)
  const timbreComparison = compareTimbre(reference.timbre, attempt.timbre)
  const dynamicsScore = compareEnvelopes(reference.envelope, attempt.envelope)
  const periodicityScore = reference.pitchConfidence > 0
    ? clamp(attempt.pitchConfidence / reference.pitchConfidence * 100)
    : clamp(attempt.pitchConfidence * 100)
  const breathScore = Math.round(clamp(
    periodicityScore * 0.35 + voicedSimilarity * 0.25 + dynamicsScore * 0.4,
  ))

  return {
    pitchScore,
    contourScore,
    melodyScore,
    rhythmScore,
    ornamentScore: vibratoComparison.ornamentScore,
    vibratoScore: vibratoComparison.vibratoSimilarity,
    vibratoRateScore: vibratoComparison.rateScore,
    vibratoExtentScore: vibratoComparison.extentScore,
    timbreScore: timbreComparison.timbreScore,
    timbreCentroidScore: timbreComparison.centroidScore,
    timbreBrightnessScore: timbreComparison.brightnessScore,
    resonanceScore: timbreComparison.resonanceScore,
    dynamicsScore,
    breathScore,
    periodicityScore: Math.round(periodicityScore),
    referenceVibratoRateHz: Number(reference.vibrato.rateHz.toFixed(2)),
    attemptVibratoRateHz: Number(attempt.vibrato.rateHz.toFixed(2)),
    referenceVibratoExtentCents: Math.round(reference.vibrato.extentCents),
    attemptVibratoExtentCents: Math.round(attempt.vibrato.extentCents),
    meanPitchErrorCents: Math.round(meanPitchErrorCents),
    averagePitchOffsetCents: Math.round(averagePitchOffsetCents),
    meanContourErrorCents: Math.round(meanContourErrorCents),
    durationSimilarity: Math.round(durationSimilarity),
    voicedSimilarity: Math.round(voicedSimilarity),
    warpSimilarity: Math.round(warpSimilarity),
    matchedFrames: path.length,
    referenceVoicedRatio: Number(reference.voicedRatio.toFixed(3)),
    attemptVoicedRatio: Number(attempt.voicedRatio.toFixed(3)),
  }
}

export async function analyzePracticeWav(wavPath) {
  const buffer = await fs.readFile(wavPath)
  const { format, data } = readWavChunks(buffer)
  const frameCount = Math.floor(data.length / 2)
  const durationSeconds = frameCount / format.sampleRate
  const windowSize = Math.max(1, Math.round(format.sampleRate / 10))
  let sumSquares = 0
  let peak = 0
  let clippedFrames = 0
  let activeWindows = 0
  let windowSquares = 0
  let windowFrames = 0

  for (let frame = 0; frame < frameCount; frame += 1) {
    const normalized = data.readInt16LE(frame * 2) / PCM_MAX
    const absolute = Math.abs(normalized)
    const square = normalized * normalized
    sumSquares += square
    windowSquares += square
    windowFrames += 1
    peak = Math.max(peak, absolute)
    if (absolute >= 0.985) clippedFrames += 1

    if (windowFrames >= windowSize || frame === frameCount - 1) {
      const rms = Math.sqrt(windowSquares / Math.max(windowFrames, 1))
      if (rms >= 0.012) activeWindows += 1
      windowSquares = 0
      windowFrames = 0
    }
  }

  const totalWindows = Math.max(1, Math.ceil(frameCount / windowSize))
  const rms = Math.sqrt(sumSquares / Math.max(frameCount, 1))
  const activeRatio = activeWindows / totalWindows
  const clippingRatio = clippedFrames / Math.max(frameCount, 1)
  const durationScore = clamp(((durationSeconds - 1.5) / 4.5) * 100)
  const activityScore = clamp((activeRatio / 0.55) * 100)
  const levelScore = rms < 0.008
    ? clamp((rms / 0.008) * 45)
    : rms <= 0.28
      ? 100
      : clamp(100 - ((rms - 0.28) / 0.2) * 70)
  const clippingScore = clamp(100 - clippingRatio * 2500)
  const audioQualityScore = Math.round(
    durationScore * 0.25 + activityScore * 0.35 + levelScore * 0.25 + clippingScore * 0.15,
  )

  const notices = []
  if (durationSeconds < 5) notices.push('录音不足 5 秒，建议完整唱完一小句后再提交。')
  if (activeRatio < 0.3) notices.push('有效发声比例偏低，请靠近麦克风并减少前后静音。')
  if (rms < 0.008) notices.push('录音音量偏低，请检查麦克风输入音量。')
  if (clippingRatio > 0.01) notices.push('录音存在爆音风险，建议降低输入音量或稍微远离麦克风。')

  return {
    durationSeconds: Number(durationSeconds.toFixed(1)),
    activeRatio: Number(activeRatio.toFixed(3)),
    rms: Number(rms.toFixed(4)),
    peak: Number(peak.toFixed(4)),
    clippingRatio: Number(clippingRatio.toFixed(4)),
    durationScore: Math.round(durationScore),
    activityScore: Math.round(activityScore),
    levelScore: Math.round(levelScore),
    clippingScore: Math.round(clippingScore),
    audioQualityScore,
    notices,
  }
}

export function combinePracticeScore(tencentScore, analysis, comparison) {
  if (!comparison) {
    const practiceScore = Math.round(clamp(tencentScore * 0.85 + analysis.audioQualityScore * 0.15))
    return {
      algorithmVersion: 'practice-v1',
      practiceScore,
      audioQualityScore: analysis.audioQualityScore,
      formula: '练功综合分 = 腾讯云唱词分 × 85% + 录音质量分 × 15%',
      feedback: [`腾讯云唱词评测 ${Math.round(tencentScore)} 分。`, ...analysis.notices].join(' '),
    }
  }

  const breathQualityScore = Math.round(clamp(
    comparison.breathScore * 0.55 + analysis.audioQualityScore * 0.45,
  ))
  const practiceScore = Math.round(clamp(
    tencentScore * 0.1
      + comparison.melodyScore * 0.3
      + comparison.rhythmScore * 0.2
      + comparison.ornamentScore * 0.2
      + comparison.timbreScore * 0.1
      + breathQualityScore * 0.1,
  ))
  const feedback = [
    `唱词识别参考 ${Math.round(tencentScore)} 分，音准旋律 ${comparison.melodyScore} 分，板眼拖腔 ${comparison.rhythmScore} 分。`,
    `颤音转音 ${comparison.ornamentScore} 分，音色共鸣 ${comparison.timbreScore} 分，气息录音 ${breathQualityScore} 分。`,
  ]

  if (comparison.averagePitchOffsetCents >= 35) {
    feedback.push(`整体音高比示范偏高约 ${comparison.averagePitchOffsetCents} 音分，可稍微向下调整。`)
  } else if (comparison.averagePitchOffsetCents <= -35) {
    feedback.push(`整体音高比示范偏低约 ${Math.abs(comparison.averagePitchOffsetCents)} 音分，可稍微向上调整。`)
  } else {
    feedback.push('整体音区与示范较接近。')
  }

  if (comparison.contourScore < 65) feedback.push('旋律走向差异较大，建议逐句跟唱示范中的转音和腔尾。')
  if (comparison.rhythmScore < 65) feedback.push('句长或停顿与示范差异较大，建议先跟着示范节拍慢唱。')
  if (comparison.ornamentScore < 65) feedback.push('颤音幅度或转音细节与示范有差异，可重点模仿长腔中的波动速度和收腔。')
  if (comparison.timbreScore < 60) feedback.push('声音明亮度或中频共鸣与示范差异较大；该项会受设备和伴奏影响，仅作辅助参考。')
  if (breathQualityScore < 65) feedback.push('气息连续性或录音稳定性偏弱，建议减少无计划断气并保持麦克风距离。')
  feedback.push(...analysis.notices)

  return {
    algorithmVersion: 'practice-v4-opera-acoustic',
    practiceScore,
    audioQualityScore: analysis.audioQualityScore,
    breathQualityScore,
    formula: '综合分 = 唱词识别参考 × 10% + 音准旋律 × 30% + 板眼拖腔 × 20% + 颤音转音 × 20% + 音色共鸣 × 10% + 气息录音 × 10%',
    feedback: feedback.join(' '),
  }
}
