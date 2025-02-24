export const styleDefinitions = {
  youtuber: {
    styleName: "YoutuberStyle",
    assDefinition: "Style: YoutuberStyle,Knewave-Regular,48,&H00FFFFFF,&H00FFFFFF,&HFF000000,&H00000000,1,0,0,0,100,100,0,0,3,4,2,2,10,10,100,1",
  },
  supreme: {
    styleName: "SupremeStyle",
    assDefinition: "Style: SupremeStyle,PoetsenOne-Regular,60,&H000080FF,&H00FFFFFF,&HFF000000,&H00000000,1,0,0,0,100,100,0,0,3,4,2,2,10,10,100,1"
  },
  neon: {
    styleName: "NeonStyle",
    assDefinition: "Style: NeonStyle,Arial,48,&H0000FF00,&H00FFFFFF,&HFF000000,&H00000000,1,0,0,0,100,100,0,0,3,4,2,2,10,10,100,1"
  },
  glitch: {
    styleName: "GlitchStyle",
    assDefinition: "Style: GlitchStyle,Courier New,48,&H00FF00FF,&H00FFFFFF,&HFF000000,&H00000000,1,0,0,0,100,100,0,0,3,4,2,2,10,10,100,1"
  },
  fire: {
    styleName: "FireStyle",
    assDefinition: "Style: FireStyle,Verdana,48,&H000045FF,&H00FFFFFF,&HFF000000,&H00000000,1,0,0,0,100,100,0,0,3,4,2,2,10,10,100,1"
  },
  futuristic: {
    styleName: "FuturisticStyle",
    assDefinition: "Style: FuturisticStyle,Monaco,48,&H00FFFF00,&H00FFFFFF,&HFF000000,&H00000000,1,0,0,0,100,100,0,0,3,4,2,2,10,10,100,1"
  },
  default: {
    styleName: "DefaultStyle",
    assDefinition: "Style: DefaultStyle,Roboto,52,&H00FFFFFF,&H00FFFFFF,&HFF000000,&H00000000,1,0,0,0,100,100,0,0,3,4,2,2,10,10,100,1"
  },
};


export function getAssStyleInfoFromCaptionId(captionId) {
  switch (captionId) {
    case "1": return styleDefinitions.youtuber;
    case "2": return styleDefinitions.supreme;
    case "3": return styleDefinitions.neon;
    case "4": return styleDefinitions.glitch;
    case "5": return styleDefinitions.fire;
    case "6": return styleDefinitions.futuristic;
    default: return styleDefinitions.default;
  }
}

function convertToAssTime(time) {
  const h = Math.floor(time / 3600);
  const m = Math.floor((time % 3600) / 60);
  const s = (time % 60).toFixed(2).padStart(5, "0");
  return `${h}:${m.toString().padStart(2, "0")}:${s}`;
}

/**
 * Converts full VTT content into an ASS subtitle file.
 */
export function vttToAss(vttContent, assStyleInfo) {
  const lines = vttContent.split(/\r?\n\r?\n/).filter(block => block.trim() && !block.startsWith("WEBVTT"));
  const scriptInfo = `[Script Info]
ScriptType: v4.00+
Collisions: Normal
PlayResX: 1920
PlayResY: 1080
Timer: 100.0000

`;
  const stylesSection = `[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${assStyleInfo.assDefinition}

`;
  const eventsHeader = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  let eventsContent = "";
  for (const block of lines) {
    const blockLines = block.split(/\r?\n/);
    const match = blockLines[0].match(/([\d:.]+)\s*-->\s*([\d:.]+)/);
    if (match) {
      const startTime = convertToAssTime(parseFloat(match[1].replace(/:/g, ".")));
      const endTime = convertToAssTime(parseFloat(match[2].replace(/:/g, ".")));
      let text = blockLines.slice(1).join("\\N").replace(/,/g, "\\,");
      eventsContent += `Dialogue: 0,${startTime},${endTime},${assStyleInfo.styleName},,0,0,0,,${text}\n`;
    }
  }
  return scriptInfo + stylesSection + eventsHeader + eventsContent;
}

export function wordsToAss(wordsArray, baseStyle, vttContent) {
  const scriptInfo = `[Script Info]
ScriptType: v4.00+
Collisions: Normal
PlayResX: 1920
PlayResY: 1080
Timer: 100.0000

`;

  const stylesSection = `[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${baseStyle.assDefinition}

`;

  const eventsHeader = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let eventsContent = "";

  // Loop through words in chunks of 3
  for (let i = 0; i < wordsArray.length; i += 3) {
    // Create a chunk of 3 words (or fewer if it's the last chunk)
    const chunk = wordsArray.slice(i, i + 3);

    // Set the duration for the chunk (from the start of the first word to the end of the last word)
    const chunkDuration = chunk[chunk.length - 1].end - chunk[0].start;

    // Start constructing the text for the chunk
    let chunkText = "";
    let highlightDuration = 0;

    // Apply the karaoke effect (\k) for each word in the chunk
    chunk.forEach((wordObj, index) => {
      const startTime = convertToAssTime(wordObj.start);
      const endTime = convertToAssTime(wordObj.end);

      // Calculate the duration in centiseconds for the karaoke
      const duration = Math.round((wordObj.end - wordObj.start) * 100);

      // Apply karaoke to each word sequentially, no background color applied
      let wordText = wordObj.word;
      if (index === 0) {
        wordText = `{\\k${duration}}${wordObj.word}`; // Highlight the first word
      } else if (index === 1) {
        wordText = `{\\k${duration}}${wordObj.word}`; // Highlight the second word
      } else if (index === 2) {
        wordText = `{\\k${duration}}${wordObj.word}`; // Highlight the third word
      }

      // Append the word to the chunk text
      chunkText += wordText + " ";

      // Add the word as a dialogue event (but we're controlling this at the chunk level now)
      // eventsContent += `Dialogue: 0,${startTime},${endTime},${baseStyle.styleName},,0,0,0,,${wordText}\n`;
    });

    // Add the chunk as a single subtitle event
    eventsContent += `Dialogue: 0,${convertToAssTime(chunk[0].start)},${convertToAssTime(chunk[chunk.length - 1].end)},${baseStyle.styleName},,0,0,0,,${chunkText.trim()}\n`;
  }

  return scriptInfo + stylesSection + eventsHeader + eventsContent;
}


