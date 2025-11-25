import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, Music, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Song {
  id: string;
  name: string;
  artists: string[];
  album: string;
  image: string;
  previewUrl: string | null;
  spotifyUrl: string;
  bpm: number;
}

interface SongResultsProps {
  bpm: number;
}

const SongResults = ({ bpm }: SongResultsProps) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSongs = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('search-songs-by-bpm', {
          body: { bpm }
        });

        if (error) throw error;

        if (data?.songs) {
          setSongs(data.songs);
        }
      } catch (error) {
        console.error('Error fetching songs:', error);
        toast({
          title: "Search Failed",
          description: "Unable to find matching songs. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSongs();
  }, [bpm, toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Searching for songs at {bpm} BPM...</p>
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="text-center py-16">
        <Music className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <p className="text-xl text-muted-foreground">No songs found at {bpm} BPM</p>
        <p className="text-sm text-muted-foreground mt-2">Try a different rhythm</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">Matching Songs</h2>
        <p className="text-muted-foreground">Found {songs.length} tracks at ~{bpm} BPM</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {songs.map((song) => (
          <Card
            key={song.id}
            className="overflow-hidden bg-card border-primary/10 hover:border-primary/30 transition-all group"
          >
            <div className="relative aspect-square overflow-hidden">
              <img
                src={song.image}
                alt={`${song.name} album cover`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/50 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-xs text-primary font-semibold mb-1">{song.bpm} BPM</p>
                <h3 className="font-bold text-lg text-foreground line-clamp-1">{song.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {song.artists.join(", ")}
                </p>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-1">{song.album}</p>
              
              {song.previewUrl && (
                <audio
                  controls
                  className="w-full h-8"
                  src={song.previewUrl}
                  preload="none"
                />
              )}
              
              <a
                href={song.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
              >
                Open in Spotify
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SongResults;
