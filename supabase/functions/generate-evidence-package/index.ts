import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Match {
  song_title: string;
  artist: string;
  album?: string;
  confidence: number;
  spotify_url?: string;
  apple_music_url?: string;
  youtube_url?: string;
  release_date?: string;
  popularity?: number;
  segment?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { beatName, matches, producerName } = await req.json();

    if (!matches || matches.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No matches provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Helper function to add new page if needed
    const checkPageBreak = (requiredSpace: number) => {
      if (yPosition + requiredSpace > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
        return true;
      }
      return false;
    };

    // Header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('EVIDENCE PACKAGE', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Beat Usage Detection Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Beat Information
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('BEAT INFORMATION', 20, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Beat Name: ${beatName || 'Unknown'}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Producer: ${producerName || 'Unknown'}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Report Generated: ${new Date().toLocaleString()}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Total Matches Found: ${matches.length}`, 20, yPosition);
    yPosition += 12;

    // Summary Statistics
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DETECTION SUMMARY', 20, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const highConfidence = matches.filter((m: Match) => m.confidence >= 85).length;
    const mediumConfidence = matches.filter((m: Match) => m.confidence >= 60 && m.confidence < 85).length;
    const lowConfidence = matches.filter((m: Match) => m.confidence < 60).length;

    doc.text(`High Confidence Matches (≥85%): ${highConfidence}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Medium Confidence Matches (60-84%): ${mediumConfidence}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Low Confidence Matches (<60%): ${lowConfidence}`, 20, yPosition);
    yPosition += 12;

    // Matches Detail
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DETECTED MATCHES', 20, yPosition);
    yPosition += 10;

    matches.forEach((match: Match, index: number) => {
      checkPageBreak(50);

      // Match number and title
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${match.song_title}`, 20, yPosition);
      yPosition += 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Artist: ${match.artist}`, 25, yPosition);
      yPosition += 5;

      if (match.album) {
        doc.text(`Album: ${match.album}`, 25, yPosition);
        yPosition += 5;
      }

      if (match.release_date) {
        doc.text(`Release Date: ${match.release_date}`, 25, yPosition);
        yPosition += 5;
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`Confidence Score: ${match.confidence}%`, 25, yPosition);
      doc.setFont('helvetica', 'normal');
      yPosition += 5;

      if (match.popularity) {
        doc.text(`Spotify Popularity: ${match.popularity}/100`, 25, yPosition);
        yPosition += 5;
      }

      if (match.segment) {
        doc.text(`Detected in: ${match.segment}`, 25, yPosition);
        yPosition += 5;
      }

      // Platform Links
      doc.setFont('helvetica', 'italic');
      doc.text('Available on:', 25, yPosition);
      yPosition += 5;

      if (match.spotify_url) {
        doc.setTextColor(0, 0, 255);
        doc.textWithLink('Spotify', 30, yPosition, { url: match.spotify_url });
        doc.setTextColor(0, 0, 0);
        yPosition += 5;
      }

      if (match.apple_music_url) {
        doc.setTextColor(0, 0, 255);
        doc.textWithLink('Apple Music', 30, yPosition, { url: match.apple_music_url });
        doc.setTextColor(0, 0, 0);
        yPosition += 5;
      }

      if (match.youtube_url) {
        doc.setTextColor(0, 0, 255);
        doc.textWithLink('YouTube Music', 30, yPosition, { url: match.youtube_url });
        doc.setTextColor(0, 0, 0);
        yPosition += 5;
      }

      yPosition += 8;
    });

    // DMCA Template
    doc.addPage();
    yPosition = 20;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DMCA TAKEDOWN NOTICE TEMPLATE', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const dmcaText = [
      '[Your Name]',
      '[Your Address]',
      '[Your City, State, ZIP]',
      '[Your Email]',
      '[Your Phone Number]',
      '',
      `Date: ${new Date().toLocaleDateString()}`,
      '',
      'To: [Platform] DMCA Agent',
      '',
      'Subject: DMCA Takedown Notice',
      '',
      'Dear Sir/Madam,',
      '',
      'I am writing to notify you of copyright infringement on your platform.',
      '',
      `I am the owner of the original musical composition titled "${beatName || '[Your Beat Name]'}", `,
      'which I created and own all rights to.',
      '',
      'I have identified the following unauthorized use(s) of my copyrighted work:',
      '',
      ...matches.slice(0, 5).map((m: Match, i: number) => 
        `${i + 1}. "${m.song_title}" by ${m.artist} - ${m.spotify_url || m.apple_music_url || m.youtube_url || 'URL not available'}`
      ),
      '',
      'I have a good faith belief that the use of this material is not authorized by me, ',
      'my agent, or the law.',
      '',
      'I declare under penalty of perjury that the information in this notification is ',
      'accurate and that I am the copyright owner or authorized to act on behalf of the owner.',
      '',
      'I request that you immediately remove or disable access to the infringing material.',
      '',
      'Please confirm receipt of this notice and the actions taken.',
      '',
      'Sincerely,',
      '',
      '[Your Signature]',
      `${producerName || '[Your Name]'}`,
    ];

    dmcaText.forEach(line => {
      checkPageBreak(6);
      doc.text(line, 20, yPosition, { maxWidth: pageWidth - 40 });
      yPosition += 5;
    });

    // Footer on last page
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'This report was generated by PulseFind - Beat Usage Detection Platform',
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );

    // Generate PDF
    const pdfOutput = doc.output('arraybuffer');

    return new Response(pdfOutput, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="evidence-package-${beatName?.replace(/\s+/g, '-') || 'report'}-${Date.now()}.pdf"`,
      },
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate evidence package',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
