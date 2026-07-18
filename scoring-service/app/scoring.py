from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import librosa
import numpy as np
from scipy.ndimage import median_filter


SAMPLE_RATE = 16000
FRAME_LENGTH = 2048
HOP_LENGTH = 320
MIN_PITCH_HZ = 70.0
MAX_PITCH_HZ = 900.0
MAX_CONTOUR_POINTS = 700


def clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return float(min(maximum, max(minimum, value)))


def rounded(value: float) -> int:
    return int(round(clamp(float(value))))


def safe_median(values: np.ndarray) -> float:
    finite = np.asarray(values, dtype=np.float64)
    finite = finite[np.isfinite(finite)]
    return float(np.median(finite)) if finite.size else 0.0


def trimmed_mean(values: np.ndarray, upper_trim: float = 0.2) -> float:
    finite = np.sort(np.asarray(values, dtype=np.float64)[np.isfinite(values)])
    if finite.size == 0:
        return 0.0
    keep = max(1, int(np.ceil(finite.size * (1.0 - upper_trim))))
    return float(np.mean(finite[:keep]))


def resample_vector(values: np.ndarray, target_length: int = 160) -> np.ndarray:
    values = np.asarray(values, dtype=np.float64)
    if values.size == 0:
        return np.zeros(target_length, dtype=np.float64)
    source = np.linspace(0.0, 1.0, values.size)
    target = np.linspace(0.0, 1.0, target_length)
    return np.interp(target, source, values)


def load_audio(path: Path) -> np.ndarray:
    audio, _ = librosa.load(path, sr=SAMPLE_RATE, mono=True)
    if audio.size < SAMPLE_RATE:
        raise ValueError("音频不足 1 秒，无法进行有效评分")
    audio = np.nan_to_num(audio.astype(np.float32), copy=False)
    peak = float(np.max(np.abs(audio)))
    if peak > 1.0:
        audio = audio / peak
    return audio


def analyze_audio_quality(audio: np.ndarray) -> dict:
    duration = audio.size / SAMPLE_RATE
    rms_frames = librosa.feature.rms(
        y=audio,
        frame_length=FRAME_LENGTH,
        hop_length=HOP_LENGTH,
        center=True,
    )[0]
    rms = float(np.sqrt(np.mean(np.square(audio))))
    peak = float(np.max(np.abs(audio)))
    active_threshold = max(0.006, safe_median(rms_frames) * 0.42)
    active_ratio = float(np.mean(rms_frames >= active_threshold))
    clipping_ratio = float(np.mean(np.abs(audio) >= 0.985))

    duration_score = clamp(duration / 10.0 * 100.0) if duration < 10 else clamp(100 - (duration - 35) * 1.2)
    activity_score = clamp(active_ratio / 0.65 * 100.0)
    level_score = clamp(100.0 - abs(20 * np.log10(max(rms, 1e-6)) + 20.0) * 3.5)
    clipping_score = clamp(100.0 - clipping_ratio * 4000.0)
    quality_score = rounded(
        duration_score * 0.2 + activity_score * 0.35 + level_score * 0.25 + clipping_score * 0.2
    )

    notices: list[str] = []
    if duration < 5:
        notices.append("录音不足 5 秒，建议完整唱完一句后再评分。")
    if active_ratio < 0.3:
        notices.append("有效演唱比例偏低，请减少前后静音并靠近麦克风。")
    if rms < 0.008:
        notices.append("录音音量偏低，请检查麦克风输入。")
    if clipping_ratio > 0.01:
        notices.append("录音有爆音风险，请降低输入音量。")

    return {
        "durationSeconds": round(duration, 1),
        "activeRatio": round(active_ratio, 3),
        "rms": round(rms, 4),
        "peak": round(peak, 4),
        "clippingRatio": round(clipping_ratio, 4),
        "durationScore": rounded(duration_score),
        "activityScore": rounded(activity_score),
        "levelScore": rounded(level_score),
        "clippingScore": rounded(clipping_score),
        "audioQualityScore": quality_score,
        "notices": notices,
    }


@dataclass
class AcousticFeatures:
    pitch_cents: np.ndarray
    voiced_probability: np.ndarray
    voiced_ratio: float
    duration: float
    vibrato_rate: float
    vibrato_extent: float
    vibrato_coverage: float
    centroid: float
    brightness: float
    resonance: float
    mfcc: np.ndarray
    envelope: np.ndarray


def compress(values: np.ndarray, limit: int = MAX_CONTOUR_POINTS) -> np.ndarray:
    if values.size <= limit:
        return values
    return resample_vector(values, limit)


def interpolate_voiced(f0: np.ndarray, voiced: np.ndarray) -> np.ndarray:
    indices = np.arange(f0.size)
    valid = voiced & np.isfinite(f0)
    if np.count_nonzero(valid) < 12:
        raise ValueError("没有检测到足够稳定的演唱音高，请靠近麦克风并完整唱完示范唱句")
    first, last = indices[valid][0], indices[valid][-1]
    return np.interp(indices[first : last + 1], indices[valid], f0[valid])


def vibrato_features(cents: np.ndarray) -> tuple[float, float, float]:
    if cents.size < 64:
        return 0.0, 0.0, 0.0
    frame_rate = SAMPLE_RATE / HOP_LENGTH
    window_size = 64
    step = 32
    candidates: list[tuple[float, float]] = []
    covered = 0

    for start in range(0, cents.size - window_size + 1, step):
        window = cents[start : start + window_size]
        baseline = median_filter(window, size=21, mode="nearest")
        residual = window - baseline
        tapered = (residual - np.mean(residual)) * np.hanning(window_size)
        power = np.square(np.abs(np.fft.rfft(tapered)))
        frequencies = np.fft.rfftfreq(window_size, d=1.0 / frame_rate)
        band = (frequencies >= 3.0) & (frequencies <= 9.0)
        band_power = float(np.sum(power[band]))
        total_power = float(np.sum(power[1:])) + 1e-12
        if band_power / total_power < 0.32:
            continue
        band_indices = np.flatnonzero(band)
        dominant_index = band_indices[int(np.argmax(power[band]))]
        rate = float(frequencies[dominant_index])
        extent = 2.0 * float(np.sqrt(np.mean(np.square(residual))))
        if 12.0 <= extent <= 260.0:
            candidates.append((rate, extent))
            covered += window_size

    if not candidates:
        return 0.0, 0.0, 0.0
    return (
        float(np.median([item[0] for item in candidates])),
        float(np.median([item[1] for item in candidates])),
        min(1.0, covered / cents.size),
    )


def extract_features(audio: np.ndarray) -> AcousticFeatures:
    trimmed, _ = librosa.effects.trim(audio, top_db=36, frame_length=FRAME_LENGTH, hop_length=HOP_LENGTH)
    if trimmed.size < SAMPLE_RATE:
        trimmed = audio
    harmonic = librosa.effects.harmonic(trimmed, margin=2.0)
    f0, voiced, probability = librosa.pyin(
        harmonic,
        fmin=MIN_PITCH_HZ,
        fmax=MAX_PITCH_HZ,
        sr=SAMPLE_RATE,
        frame_length=FRAME_LENGTH,
        hop_length=HOP_LENGTH,
        center=True,
    )
    pitch_hz = interpolate_voiced(f0, voiced)
    full_pitch_cents = median_filter(librosa.hz_to_midi(pitch_hz) * 100.0, size=5, mode="nearest")
    vibrato_rate, vibrato_extent, vibrato_coverage = vibrato_features(full_pitch_cents)
    pitch_cents = compress(full_pitch_cents)

    spectrum = np.abs(librosa.stft(harmonic, n_fft=FRAME_LENGTH, hop_length=HOP_LENGTH))
    power = np.square(spectrum)
    frequencies = librosa.fft_frequencies(sr=SAMPLE_RATE, n_fft=FRAME_LENGTH)
    total_power = float(np.sum(power)) + 1e-12
    centroid = safe_median(librosa.feature.spectral_centroid(S=spectrum, sr=SAMPLE_RATE)[0])
    brightness = float(np.sum(power[frequencies >= 2000])) / total_power
    middle = float(np.sum(power[(frequencies >= 630) & (frequencies < 2000)]))
    low_middle = float(np.sum(power[frequencies < 2000])) + 1e-12
    resonance = middle / low_middle
    mfcc = np.median(librosa.feature.mfcc(y=harmonic, sr=SAMPLE_RATE, n_mfcc=13), axis=1)

    rms = librosa.feature.rms(
        y=trimmed,
        frame_length=FRAME_LENGTH,
        hop_length=HOP_LENGTH,
        center=True,
    )[0]
    baseline = max(safe_median(rms[rms >= 0.006]), 0.006)
    envelope = resample_vector(20.0 * np.log10(np.maximum(rms, 0.001) / baseline))

    finite_probability = probability[np.isfinite(probability)]
    return AcousticFeatures(
        pitch_cents=pitch_cents,
        voiced_probability=finite_probability,
        voiced_ratio=float(np.mean(voiced)),
        duration=trimmed.size / SAMPLE_RATE,
        vibrato_rate=vibrato_rate,
        vibrato_extent=vibrato_extent,
        vibrato_coverage=vibrato_coverage,
        centroid=centroid,
        brightness=brightness,
        resonance=resonance,
        mfcc=mfcc,
        envelope=envelope,
    )


@lru_cache(maxsize=16)
def extract_reference_features(path_value: str, modified_ns: int) -> AcousticFeatures:
    del modified_ns
    return extract_features(load_audio(Path(path_value)))


def relative_score(reference: float, attempt: float, tolerance: float) -> float:
    if reference <= 0 and attempt <= 0:
        return 100.0
    if reference <= 0 or attempt <= 0:
        return 35.0
    return clamp(100.0 - abs(attempt - reference) / tolerance * 100.0)


def cosine_score(reference: np.ndarray, attempt: np.ndarray) -> float:
    reference = reference - np.mean(reference)
    attempt = attempt - np.mean(attempt)
    denominator = float(np.linalg.norm(reference) * np.linalg.norm(attempt))
    if denominator <= 1e-9:
        return 35.0
    return clamp((float(np.dot(reference, attempt)) / denominator + 1.0) * 50.0)


def score_pitch_error(error_cents: float) -> float:
    if error_cents <= 25:
        return 100.0 - error_cents * 0.4
    if error_cents <= 100:
        return 90.0 - (error_cents - 25.0) * (40.0 / 75.0)
    return 50.0 - (error_cents - 100.0) * 0.25


def compare_features(reference: AcousticFeatures, attempt: AcousticFeatures) -> dict:
    ref = reference.pitch_cents
    att = attempt.pitch_cents
    raw_distance = att[None, :] - ref[:, None]
    octave_folded_distance = np.abs((raw_distance + 600.0) % 1200.0 - 600.0)
    cost = octave_folded_distance / 600.0
    _, path = librosa.sequence.dtw(C=cost, backtrack=True, global_constraints=True, band_rad=0.22)
    path = path[::-1]
    ref_indices = path[:, 0]
    att_indices = path[:, 1]
    raw_errors = att[att_indices] - ref[ref_indices]
    signed_errors = (raw_errors + 600.0) % 1200.0 - 600.0
    pitch_offset = safe_median(signed_errors)
    residual_errors = np.abs(signed_errors - pitch_offset)
    local_pitch_error = trimmed_mean(residual_errors)
    mean_pitch_error = local_pitch_error * 0.75 + abs(pitch_offset) * 0.25

    diagonal = (np.diff(ref_indices) == 1) & (np.diff(att_indices) == 1)
    if np.any(diagonal):
        ref_intervals = np.diff(ref)[ref_indices[:-1][diagonal]]
        att_intervals = np.diff(att)[att_indices[:-1][diagonal]]
        contour_error = trimmed_mean(np.minimum(np.abs(att_intervals - ref_intervals), 600.0), 0.1)
    else:
        contour_error = 600.0

    pitch_score = rounded(score_pitch_error(mean_pitch_error))
    contour_score = rounded(100.0 - contour_error / 3.0)
    melody_score = rounded(pitch_score * 0.72 + contour_score * 0.28)
    duration_similarity = clamp(min(reference.duration, attempt.duration) / max(reference.duration, attempt.duration) * 100.0)
    voiced_similarity = clamp(100.0 - abs(reference.voiced_ratio - attempt.voiced_ratio) / max(reference.voiced_ratio, 0.1) * 100.0)
    warp_similarity = clamp(float(np.mean(diagonal)) * 100.0) if diagonal.size else 0.0
    rhythm_score = rounded(duration_similarity * 0.45 + voiced_similarity * 0.25 + warp_similarity * 0.30)

    vibrato_rate_score = relative_score(reference.vibrato_rate, attempt.vibrato_rate, 2.5)
    vibrato_extent_score = relative_score(reference.vibrato_extent, attempt.vibrato_extent, 80.0)
    vibrato_coverage_score = relative_score(reference.vibrato_coverage, attempt.vibrato_coverage, 0.35)
    if reference.vibrato_rate <= 0:
        vibrato_score = 100 if attempt.vibrato_rate <= 0 else 45
        ornament_score = contour_score
    else:
        vibrato_score = rounded(vibrato_rate_score * 0.35 + vibrato_extent_score * 0.40 + vibrato_coverage_score * 0.25)
        ornament_score = rounded(vibrato_score * 0.68 + contour_score * 0.32)

    centroid_score = clamp(100.0 - abs(np.log2(max(attempt.centroid, 1.0) / max(reference.centroid, 1.0))) * 70.0)
    brightness_score = relative_score(reference.brightness, attempt.brightness, 0.18)
    resonance_score = relative_score(reference.resonance, attempt.resonance, 0.22)
    mfcc_score = cosine_score(reference.mfcc, attempt.mfcc)
    timbre_score = rounded(centroid_score * 0.28 + brightness_score * 0.18 + resonance_score * 0.24 + mfcc_score * 0.30)

    dynamics_score = rounded(100.0 - trimmed_mean(np.abs(reference.envelope - attempt.envelope), 0.15) * 12.0)
    reference_confidence = safe_median(reference.voiced_probability)
    attempt_confidence = safe_median(attempt.voiced_probability)
    periodicity_score = clamp(attempt_confidence / max(reference_confidence, 0.01) * 100.0)
    breath_score = rounded(periodicity_score * 0.35 + voiced_similarity * 0.25 + dynamics_score * 0.40)

    return {
        "pitchScore": pitch_score,
        "contourScore": contour_score,
        "melodyScore": melody_score,
        "rhythmScore": rhythm_score,
        "ornamentScore": ornament_score,
        "vibratoScore": vibrato_score,
        "vibratoRateScore": rounded(vibrato_rate_score),
        "vibratoExtentScore": rounded(vibrato_extent_score),
        "timbreScore": timbre_score,
        "timbreCentroidScore": rounded(centroid_score),
        "timbreBrightnessScore": rounded(brightness_score),
        "resonanceScore": rounded(resonance_score),
        "dynamicsScore": dynamics_score,
        "breathScore": breath_score,
        "periodicityScore": rounded(periodicity_score),
        "referenceVibratoRateHz": round(reference.vibrato_rate, 2),
        "attemptVibratoRateHz": round(attempt.vibrato_rate, 2),
        "referenceVibratoExtentCents": round(reference.vibrato_extent),
        "attemptVibratoExtentCents": round(attempt.vibrato_extent),
        "meanPitchErrorCents": round(mean_pitch_error),
        "averagePitchOffsetCents": round(pitch_offset),
        "meanContourErrorCents": round(contour_error),
        "durationSimilarity": rounded(duration_similarity),
        "voicedSimilarity": rounded(voiced_similarity),
        "warpSimilarity": rounded(warp_similarity),
        "matchedFrames": int(path.shape[0]),
        "referenceVoicedRatio": round(reference.voiced_ratio, 3),
        "attemptVoicedRatio": round(attempt.voiced_ratio, 3),
    }


def score_singing(reference_path: Path, attempt_path: Path) -> dict:
    attempt_audio = load_audio(attempt_path)
    local_analysis = analyze_audio_quality(attempt_audio)
    reference_features = extract_reference_features(
        str(reference_path), reference_path.stat().st_mtime_ns
    )
    attempt_features = extract_features(attempt_audio)
    comparison = compare_features(reference_features, attempt_features)
    return {
        "algorithmVersion": "python-librosa-pyin-dtw-v1",
        "localAnalysis": local_analysis,
        "singingComparison": comparison,
    }
