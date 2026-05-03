export function playCopySound() {
  if (typeof window === "undefined" || !window.AudioContext) {
    return;
  }

  const audioContext = new window.AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const start = audioContext.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(760, start);
  gain.gain.setValueAtTime(0.08, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + 0.1);
  oscillator.onended = () => void audioContext.close();
}
