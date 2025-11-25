import * as MusicTempo from 'music-tempo';

export async function analyzeBPM(audioFile: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const audioContext = new AudioContext();
        
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        
        // Convert to the format expected by music-tempo
        const audioData = Array.from(channelData);
        
        // Analyze tempo
        const mt = new MusicTempo(audioData);
        const bpm = Math.round(mt.tempo);
        
        audioContext.close();
        
        if (bpm > 0 && bpm < 300) {
          resolve(bpm);
        } else {
          reject(new Error('Invalid BPM detected'));
        }
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read audio file'));
    reader.readAsArrayBuffer(audioFile);
  });
}
